const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');
const { body, validationResult } = require('express-validator');
const { ethers } = require('ethers');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const crypto = require('crypto');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const config = require('./config');

const app = express();
const PORT = config.port;

// Logger configuration
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Database connection
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.isProduction ? { rejectUnauthorized: false } : false,
  max: config.db.maxConnections,
  idleTimeoutMillis: config.db.idleTimeoutMs
});

// Redis connection
const redisClient = redis.createClient({
  url: config.redisUrl,
  ...config.redis
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));

// Blockchain providers
const providers = {
  ethereum: new ethers.JsonRpcProvider(config.blockchain.ethereumRpcUrl || 'https://mainnet.infura.io/v3/your-project-id'),
  polygon: new ethers.JsonRpcProvider(config.blockchain.polygonRpcUrl || 'https://polygon-rpc.com'),
  bsc: new ethers.JsonRpcProvider(config.blockchain.bscRpcUrl || 'https://bsc-dataseed.binance.org')
};

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: { code: 'MISSING_TOKEN', message: 'Access token required' } 
    });
  }

  try {
    const user = jwt.verify(token, config.jwtSecret);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } 
    });
  }
};

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      }
    });
  }
  next();
};

// Wallet utilities
class WalletManager {
  static generateMnemonic() {
    return bip39.generateMnemonic();
  }

  static async createWalletFromMnemonic(mnemonic, index = 0) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const hdWallet = hdkey.fromMasterSeed(seed);
    const wallet = hdWallet.derive(`m/44'/60'/0'/0/${index}`);
    
    return new ethers.Wallet(wallet.privateKey);
  }

  static async createRandomWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase
    };
  }

  static async getBalance(address, network = 'ethereum') {
    try {
      const provider = providers[network];
      if (!provider) {
        throw new Error(`Unsupported network: ${network}`);
      }
      
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting balance for ${address} on ${network}:`, error);
      throw error;
    }
  }

  static async sendTransaction(fromPrivateKey, toAddress, amount, network = 'ethereum') {
    try {
      const provider = providers[network];
      if (!provider) {
        throw new Error(`Unsupported network: ${network}`);
      }

      const wallet = new ethers.Wallet(fromPrivateKey, provider);
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount.toString())
      });

      return tx;
    } catch (error) {
      logger.error(`Error sending transaction:`, error);
      throw error;
    }
  }
}

// Price fetching utility
class PriceManager {
  static async getTokenPrice(symbol) {
    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
      return response.data[symbol]?.usd || 0;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      return 0;
    }
  }

  static async getMultipleTokenPrices(symbols) {
    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbols.join(',')}&vs_currencies=usd`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching prices for ${symbols}:`, error);
      return {};
    }
  }
}

// Middleware
app.use(helmet());
if (config.corsOrigins.length > 0) {
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
} else {
  app.use(cors());
}
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Wallet Service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get user wallets
app.get('/wallets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.wallet_type, w.wallet_address, w.is_active, w.created_at, w.updated_at
       FROM wallets w
       WHERE w.user_id = $1 AND w.is_active = true
       ORDER BY w.created_at DESC`,
      [req.user.userId]
    );

    const wallets = result.rows.map(wallet => ({
      id: wallet.id,
      type: wallet.wallet_type,
      address: wallet.wallet_address,
      isActive: wallet.is_active,
      createdAt: wallet.created_at,
      updatedAt: wallet.updated_at
    }));

    res.json({
      success: true,
      data: { wallets }
    });

  } catch (error) {
    logger.error('Get wallets error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'WALLETS_FETCH_FAILED', message: 'Failed to fetch wallets' }
    });
  }
});

// Create new wallet
app.post('/wallets', authenticateToken, [
  body('type').isIn(['custodial', 'non_custodial']),
  body('securityLevel').optional().isIn(['standard', 'high'])
], validateRequest, async (req, res) => {
  try {
    const { type, securityLevel = 'standard' } = req.body;

    let walletData;
    let encryptedPrivateKey = null;
    let seedPhraseHash = null;

    if (type === 'custodial') {
      // Generate random wallet for custodial
      const randomWallet = await WalletManager.createRandomWallet();
      walletData = {
        address: randomWallet.address,
        privateKey: randomWallet.privateKey
      };
      
      // Encrypt private key (in production, use proper encryption)
      encryptedPrivateKey = crypto.createHash('sha256').update(randomWallet.privateKey).digest('hex');
    } else {
      // Generate mnemonic for non-custodial
      const mnemonic = WalletManager.generateMnemonic();
      const wallet = await WalletManager.createWalletFromMnemonic(mnemonic);
      
      walletData = {
        address: wallet.address,
        mnemonic: mnemonic
      };
      
      // Hash mnemonic (in production, use proper hashing)
      seedPhraseHash = crypto.createHash('sha256').update(mnemonic).digest('hex');
    }

    // Save wallet to database
    const result = await pool.query(
      `INSERT INTO wallets (user_id, wallet_type, wallet_address, encrypted_private_key, seed_phrase_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, wallet_type, wallet_address, is_active, created_at`,
      [req.user.userId, type, walletData.address, encryptedPrivateKey, seedPhraseHash, true]
    );

    const wallet = result.rows[0];

    // Initialize balances for supported assets
    const supportedAssets = await pool.query('SELECT id FROM assets WHERE is_active = true');
    for (const asset of supportedAssets.rows) {
      await pool.query(
        `INSERT INTO balances (user_id, wallet_id, asset_id, balance, locked_balance, updated_at)
         VALUES ($1, $2, $3, 0, 0, NOW())
         ON CONFLICT (user_id, wallet_id, asset_id) DO NOTHING`,
        [req.user.userId, wallet.id, asset.id]
      );
    }

    logger.info(`New ${type} wallet created for user ${req.user.userId}: ${walletData.address}`);

    res.status(201).json({
      success: true,
      data: {
        wallet: {
          id: wallet.id,
          type: wallet.wallet_type,
          address: wallet.wallet_address,
          isActive: wallet.is_active,
          createdAt: wallet.created_at
        },
        ...(type === 'non_custodial' && { mnemonic: walletData.mnemonic })
      },
      message: `${type} wallet created successfully`
    });

  } catch (error) {
    logger.error('Create wallet error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_CREATION_FAILED', message: 'Failed to create wallet' }
    });
  }
});

// Get wallet balances
app.get('/wallets/:walletId/balances', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;

    // Verify wallet belongs to user
    const walletCheck = await pool.query(
      'SELECT id FROM wallets WHERE id = $1 AND user_id = $2 AND is_active = true',
      [walletId, req.user.userId]
    );

    if (walletCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' }
      });
    }

    const result = await pool.query(
      `SELECT b.balance, b.locked_balance, a.symbol, a.name, a.decimals, a.asset_type, a.blockchain
       FROM balances b
       JOIN assets a ON b.asset_id = a.id
       WHERE b.user_id = $1 AND b.wallet_id = $2 AND a.is_active = true
       ORDER BY a.symbol`,
      [req.user.userId, walletId]
    );

    // Get current prices
    const symbols = result.rows.map(row => row.symbol.toLowerCase());
    const prices = await PriceManager.getMultipleTokenPrices(symbols);

    const balances = result.rows.map(balance => {
      const price = prices[balance.symbol.toLowerCase()]?.usd || 0;
      const totalBalance = parseFloat(balance.balance) + parseFloat(balance.locked_balance);
      const usdValue = totalBalance * price;

      return {
        asset: {
          symbol: balance.symbol,
          name: balance.name,
          decimals: balance.decimals,
          type: balance.asset_type,
          blockchain: balance.blockchain
        },
        balance: balance.balance,
        lockedBalance: balance.locked_balance,
        totalBalance: totalBalance.toString(),
        usdValue: usdValue.toFixed(2),
        price: price
      };
    });

    res.json({
      success: true,
      data: { balances }
    });

  } catch (error) {
    logger.error('Get balances error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'BALANCES_FETCH_FAILED', message: 'Failed to fetch balances' }
    });
  }
});

// Send cryptocurrency
app.post('/wallets/:walletId/send', authenticateToken, [
  body('toAddress').isEthereumAddress(),
  body('assetId').isUUID(),
  body('amount').isFloat({ min: 0.000001 }),
  body('memo').optional().isLength({ max: 255 })
], validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { toAddress, assetId, amount, memo } = req.body;

    // Verify wallet belongs to user
    const walletResult = await pool.query(
      'SELECT * FROM wallets WHERE id = $1 AND user_id = $2 AND is_active = true',
      [walletId, req.user.userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' }
      });
    }

    const wallet = walletResult.rows[0];

    // Get asset information
    const assetResult = await pool.query(
      'SELECT * FROM assets WHERE id = $1 AND is_active = true',
      [assetId]
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' }
      });
    }

    const asset = assetResult.rows[0];

    // Check balance
    const balanceResult = await pool.query(
      'SELECT balance FROM balances WHERE user_id = $1 AND wallet_id = $2 AND asset_id = $3',
      [req.user.userId, walletId, assetId]
    );

    if (balanceResult.rows.length === 0 || parseFloat(balanceResult.rows[0].balance) < amount) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INSUFFICIENT_BALANCE', 
          message: 'Insufficient balance',
          details: {
            required: amount.toString(),
            available: balanceResult.rows[0]?.balance || '0'
          }
        }
      });
    }

    // For custodial wallets, we would use Fireblocks or similar service
    // For non-custodial wallets, we would require user to sign the transaction
    // This is a simplified version for demonstration

    let transactionHash = null;
    let status = 'pending';

    if (wallet.wallet_type === 'custodial') {
      // In production, this would integrate with Fireblocks
      transactionHash = '0x' + crypto.randomBytes(32).toString('hex');
      status = 'completed';
    } else {
      // For non-custodial, we would return transaction data for user to sign
      status = 'pending';
    }

    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, transaction_type, from_wallet_id, from_asset_id, amount, blockchain_tx_hash, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, status, created_at`,
      [req.user.userId, 'send', walletId, assetId, amount, transactionHash, status]
    );

    const transaction = transactionResult.rows[0];

    // Update balances if transaction is completed
    if (status === 'completed') {
      await pool.query(
        'UPDATE balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND wallet_id = $3 AND asset_id = $4',
        [amount, req.user.userId, walletId, assetId]
      );
    }

    logger.info(`Transaction created: ${transaction.id} for user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          type: 'send',
          amount: amount.toString(),
          asset: {
            symbol: asset.symbol,
            name: asset.name
          },
          toAddress,
          status: transaction.status,
          blockchainTxHash: transactionHash,
          createdAt: transaction.created_at
        }
      },
      message: 'Transaction initiated successfully'
    });

  } catch (error) {
    logger.error('Send transaction error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'TRANSACTION_FAILED', message: 'Failed to send transaction' }
    });
  }
});

// Get transaction history
app.get('/wallets/:walletId/transactions', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { limit = 50, offset = 0, status, type } = req.query;

    // Verify wallet belongs to user
    const walletCheck = await pool.query(
      'SELECT id FROM wallets WHERE id = $1 AND user_id = $2 AND is_active = true',
      [walletId, req.user.userId]
    );

    if (walletCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' }
      });
    }

    let query = `
      SELECT t.id, t.transaction_type, t.amount, t.fee, t.status, t.blockchain_tx_hash, t.created_at, t.completed_at,
             a.symbol, a.name as asset_name
      FROM transactions t
      JOIN assets a ON t.from_asset_id = a.id
      WHERE t.user_id = $1 AND t.from_wallet_id = $2
    `;
    
    const params = [req.user.userId, walletId];
    let paramCount = 2;

    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
    }

    if (type) {
      paramCount++;
      query += ` AND t.transaction_type = $${paramCount}`;
      params.push(type);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const transactions = result.rows.map(tx => ({
      id: tx.id,
      type: tx.transaction_type,
      amount: tx.amount,
      fee: tx.fee,
      status: tx.status,
      blockchainTxHash: tx.blockchain_tx_hash,
      asset: {
        symbol: tx.symbol,
        name: tx.asset_name
      },
      createdAt: tx.created_at,
      completedAt: tx.completed_at
    }));

    res.json({
      success: true,
      data: { transactions }
    });

  } catch (error) {
    logger.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'TRANSACTIONS_FETCH_FAILED', message: 'Failed to fetch transactions' }
    });
  }
});

// Get wallet address for receiving
app.get('/wallets/:walletId/address', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;

    const result = await pool.query(
      'SELECT wallet_address FROM wallets WHERE id = $1 AND user_id = $2 AND is_active = true',
      [walletId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' }
      });
    }

    res.json({
      success: true,
      data: {
        address: result.rows[0].wallet_address
      }
    });

  } catch (error) {
    logger.error('Get wallet address error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ADDRESS_FETCH_FAILED', message: 'Failed to fetch wallet address' }
    });
  }
});

// Background job to update balances
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running balance update job...');
    
    // Get all active wallets
    const wallets = await pool.query(
      'SELECT id, wallet_address, wallet_type FROM wallets WHERE is_active = true'
    );

    for (const wallet of wallets.rows) {
      try {
        // Get ETH balance for Ethereum wallets
        const ethBalance = await WalletManager.getBalance(wallet.wallet_address, 'ethereum');
        
        // Update balance in database
        await pool.query(
          `UPDATE balances SET balance = $1, updated_at = NOW() 
           WHERE wallet_id = $2 AND asset_id = (SELECT id FROM assets WHERE symbol = 'ETH' AND blockchain = 'ethereum')`,
          [ethBalance, wallet.id]
        );
      } catch (error) {
        logger.error(`Error updating balance for wallet ${wallet.id}:`, error);
      }
    }

    logger.info('Balance update job completed');
  } catch (error) {
    logger.error('Balance update job failed:', error);
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
});

let server;

const ensureDatabaseConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

const ensureRedisConnection = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

const start = async () => {
  try {
    await ensureDatabaseConnection();
    await ensureRedisConnection();

    server = app.listen(PORT, () => {
      logger.info(`Wallet Service running on port ${PORT}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start Wallet Service', error);
    throw error;
  }
};

const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down Wallet Service.`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await Promise.all([
    pool.end().catch((error) => logger.error('Error closing database pool', error)),
    redisClient.isOpen ? redisClient.quit().catch((error) => logger.error('Error closing Redis connection', error)) : Promise.resolve()
  ]);

  logger.info('Shutdown complete.');
};

process.on('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));
process.on('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  shutdown('uncaughtException').then(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  shutdown('unhandledRejection').then(() => process.exit(1));
});

if (require.main === module) {
  start().catch(() => process.exit(1));
}

module.exports = {
  app,
  start,
  shutdown,
  pool,
  redisClient,
  providers
};
