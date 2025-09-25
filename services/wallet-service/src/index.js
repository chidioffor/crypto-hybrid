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
const promClient = require('../../shared/metrics');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const ENCRYPTION_VERSION = 1;
<<<<<<< ours
<<<<<<< ours
=======
const enableMockIntegrations = process.env.ENABLE_MOCK_INTEGRATIONS === 'true';
const metricsEnabled = process.env.ENABLE_PROMETHEUS_METRICS !== 'false';
>>>>>>> theirs
=======
const enableMockIntegrations = process.env.ENABLE_MOCK_INTEGRATIONS === 'true';
const metricsEnabled = process.env.ENABLE_PROMETHEUS_METRICS !== 'false';
>>>>>>> theirs

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
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

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'WALLET_ENCRYPTION_KEY'];
const missingEnvVars = REQUIRED_ENV_VARS.filter(name => !process.env[name]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const deriveEncryptionKey = (rawValue, label) => {
  const value = rawValue.trim();

  if (!value) {
    throw new Error(`${label} cannot be empty`);
  }

  try {
    const base64Buffer = Buffer.from(value, 'base64');
    if (base64Buffer.length === 32) {
      return base64Buffer;
    }
  } catch (error) {
    logger.debug(`${label} is not valid base64: ${error.message}`);
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }

  throw new Error(`${label} must be a 32-byte key encoded in base64 or 64 hex characters`);
};

let walletEncryptionKey;

try {
  walletEncryptionKey = deriveEncryptionKey(process.env.WALLET_ENCRYPTION_KEY, 'WALLET_ENCRYPTION_KEY');
} catch (error) {
  logger.error(`Failed to initialise wallet encryption key: ${error.message}`);
  process.exit(1);
}

const encryptSensitiveValue = (plaintext) => {
  if (!plaintext) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', walletEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    v: ENCRYPTION_VERSION,
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    tag: authTag.toString('base64')
  });
};

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));

(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    process.exit(1);
  }
})();

// Blockchain providers
const providers = {
  ethereum: new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your-project-id'),
  polygon: new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
  bsc: new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org')
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
    const user = jwt.verify(token, process.env.JWT_SECRET);
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
    if (enableMockIntegrations) {
      const mockPrices = { btc: 42000, eth: 3200, usdc: 1, usdt: 1, usd: 1 };
      return mockPrices[symbol] || 1;
    }

    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
      return response.data[symbol]?.usd || 0;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      return 0;
    }
  }

  static async getMultipleTokenPrices(symbols) {
    if (enableMockIntegrations) {
      const prices = {};
      for (const symbol of symbols) {
        prices[symbol] = { usd: await this.getTokenPrice(symbol) };
      }
      return prices;
    }

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
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let metricsRegistry;
let httpHistogram;

if (metricsEnabled) {
  metricsRegistry = new promClient.Registry();
  promClient.collectDefaultMetrics({ register: metricsRegistry, prefix: 'wallet_service_' });
  httpHistogram = new promClient.Histogram({
    name: 'wallet_service_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry]
  });

  app.use((req, res, next) => {
    const end = httpHistogram.startTimer();
    res.on('finish', () => {
      const route = req.route?.path || req.originalUrl || 'unknown';
      end({ method: req.method, route, status: res.statusCode });
    });
    next();
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });
} else {
  app.get('/metrics', (req, res) => {
    res.status(503).json({
      success: false,
      error: { code: 'METRICS_DISABLED', message: 'Prometheus metrics are disabled' }
    });
  });
}

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
    let encryptedSeedPhrase = null;

    if (type === 'custodial') {
      // Generate random wallet for custodial
      const randomWallet = await WalletManager.createRandomWallet();
      walletData = {
        address: randomWallet.address,
        privateKey: randomWallet.privateKey
      };

      encryptedPrivateKey = encryptSensitiveValue(randomWallet.privateKey);
    } else {
      // Generate mnemonic for non-custodial
      const mnemonic = WalletManager.generateMnemonic();
      const wallet = await WalletManager.createWalletFromMnemonic(mnemonic);

      walletData = {
        address: wallet.address,
        mnemonic: mnemonic
      };

      encryptedSeedPhrase = encryptSensitiveValue(mnemonic);
    }

    // Save wallet to database
    const result = await pool.query(
      `INSERT INTO wallets (user_id, wallet_type, wallet_address, encrypted_private_key, encrypted_seed_phrase, is_active, created_at, updated_at, encryption_version)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)
       RETURNING id, wallet_type, wallet_address, is_active, created_at`,
      [req.user.userId, type, walletData.address, encryptedPrivateKey, encryptedSeedPhrase, true, ENCRYPTION_VERSION]
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

// Start server
app.listen(PORT, () => {
  logger.info(`Wallet Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
