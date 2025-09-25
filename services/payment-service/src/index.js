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
const Stripe = require('stripe');
const axios = require('axios');
const cron = require('node-cron');
const { Kafka } = require('kafkajs');
const promClient = require('../../shared/metrics');
const { ethers } = require('../../wallet-service/node_modules/ethers');
const path = require('path');
const escrowAbi = require(path.join(__dirname, '../../../smart-contracts/abi/Escrow.json'));
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;
const metricsEnabled = process.env.ENABLE_PROMETHEUS_METRICS !== 'false';
const enableMockIntegrations = process.env.ENABLE_MOCK_INTEGRATIONS === 'true';
const enableSmartContractSettlement = process.env.ENABLE_SMART_CONTRACT_SETTLEMENT === 'true';
const chainalysisApiKey = process.env.CHAINALYSIS_API_KEY;
const escrowArbiterAddress = process.env.ESCROW_ARBITER_ADDRESS;

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
redisClient.connect();

// Stripe configuration
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = !enableMockIntegrations && stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

// Kafka configuration
const kafkaBrokers = (process.env.KAFKA_BROKER || 'localhost:9092')
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'payment-service',
  brokers: kafkaBrokers.length ? kafkaBrokers : ['localhost:9092']
};

if (process.env.KAFKA_SASL_MECHANISM && process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
  kafkaConfig.ssl = true;
  kafkaConfig.sasl = {
    mechanism: process.env.KAFKA_SASL_MECHANISM,
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD
  };
}

const kafka = new Kafka(kafkaConfig);

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'payment-service-group' });

let escrowContract = null;

if (enableSmartContractSettlement) {
  const rpcUrl = process.env.SMART_CONTRACT_RPC_URL;
  const contractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
  const mnemonic = process.env.HARDHAT_DEPLOYER_MNEMONIC;

  if (rpcUrl && contractAddress && mnemonic && escrowArbiterAddress) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
      escrowContract = new ethers.Contract(contractAddress, escrowAbi, wallet);
      logger.info(`Smart contract settlement enabled using ${process.env.SMART_CONTRACT_NETWORK || 'unknown'} network`);
    } catch (error) {
      logger.warn('Failed to initialise escrow contract integration:', error);
      escrowContract = null;
    }
  } else {
    logger.warn('Smart contract settlement enabled but configuration is incomplete; skipping contract binding.');
  }
}

const recordEscrowSettlement = async ({ payee, amount, description }) => {
  if (!escrowContract || !ethers.isAddress(payee)) {
    return null;
  }

  try {
    const normalizedAmount = typeof amount === 'number' ? amount : parseFloat(amount || '0');
    const depositAmount = ethers.parseUnits(normalizedAmount.toString(), 18);
    const nextId = await escrowContract.nextEscrowId();
    const tx = await escrowContract.createEscrow(
      payee,
      escrowArbiterAddress,
      depositAmount,
      ethers.ZeroAddress,
      Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      description || 'Off-chain payment settlement',
      [ethers.id('final_milestone')]
    );
    await tx.wait();

    return { escrowId: nextId.toString(), transactionHash: tx.hash };
  } catch (error) {
    logger.warn('Escrow settlement registration failed:', error);
    return null;
  }
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

// Payment utilities
class PaymentManager {
  static async createStripePaymentIntent(amount, currency, metadata = {}) {
    try {
      if (!stripe) {
        return {
          id: `mock_pi_${Date.now()}`,
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          status: 'requires_confirmation',
          metadata,
          livemode: false,
        };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Stripe payment intent creation failed:', error);
      throw error;
    }
  }

  static async confirmStripePaymentIntent(paymentIntentId) {
    try {
      if (!stripe) {
        return {
          id: paymentIntentId,
          status: 'succeeded',
          amount_received: 0,
          currency: 'usd',
        };
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Stripe payment intent confirmation failed:', error);
      throw error;
    }
  }

  static async createSEPATransfer(amount, currency, recipientIban, description) {
    try {
      // In production, this would integrate with a SEPA provider like Stripe or FinLego
      // For demo purposes, we'll simulate the transfer
      const transfer = {
        id: `sepa_${Date.now()}`,
        amount: amount,
        currency: currency,
        recipientIban: recipientIban,
        description: description,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      return transfer;
    } catch (error) {
      logger.error('SEPA transfer creation failed:', error);
      throw error;
    }
  }

  static async createSWIFTTransfer(amount, currency, recipientBank, description) {
    try {
      // In production, this would integrate with a SWIFT provider
      const transfer = {
        id: `swift_${Date.now()}`,
        amount: amount,
        currency: currency,
        recipientBank: recipientBank,
        description: description,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      return transfer;
    } catch (error) {
      logger.error('SWIFT transfer creation failed:', error);
      throw error;
    }
  }
}

// Transaction monitoring utilities
class TransactionMonitor {
  static async checkTransactionRisk(transaction) {
    try {
      // In production, this would integrate with Chainalysis or Elliptic
      // For demo purposes, we'll implement basic risk scoring
      let riskScore = 0;
      const riskFactors = [];

      // Check amount
      if (transaction.amount > 10000) {
        riskScore += 30;
        riskFactors.push('High amount transaction');
      }

      // Check frequency (simplified)
      const recentTransactions = await pool.query(
        'SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
        [transaction.userId]
      );

      if (recentTransactions.rows[0].count > 10) {
        riskScore += 20;
        riskFactors.push('High transaction frequency');
      }

      // Check destination (simplified)
      if (transaction.toAddress && transaction.toAddress.startsWith('0x')) {
        // This would check against known risky addresses
        riskScore += 10;
        riskFactors.push('Crypto address destination');
      }

      if (chainalysisApiKey && !enableMockIntegrations && transaction.toAddress) {
        try {
          const response = await axios.post(
            'https://api.chainalysis.com/transaction/screen',
            { address: transaction.toAddress },
            {
              headers: {
                'X-API-Key': chainalysisApiKey
              }
            }
          );

          if (response.data?.riskScore) {
            riskScore = Math.max(riskScore, response.data.riskScore);
            if (response.data.riskScore >= 70) {
              riskFactors.push('Chainalysis high-risk address');
            }
          }
        } catch (chainalysisError) {
          logger.warn('Chainalysis risk lookup failed:', chainalysisError.message);
        }
      }

      return {
        riskScore: Math.min(riskScore, 100),
        riskLevel: riskScore > 70 ? 'high' : riskScore > 30 ? 'medium' : 'low',
        riskFactors
      };
    } catch (error) {
      logger.error('Transaction risk assessment failed:', error);
      return {
        riskScore: 50,
        riskLevel: 'medium',
        riskFactors: ['Risk assessment failed']
      };
    }
  }

  static async monitorTransaction(transactionId) {
    try {
      // In production, this would integrate with blockchain monitoring services
      logger.info(`Monitoring transaction: ${transactionId}`);
      
      // Simulate monitoring process
      setTimeout(async () => {
        try {
          await pool.query(
            'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
            ['completed', transactionId]
          );

          // Publish transaction completion event
          await producer.send({
            topic: 'transaction-completed',
            messages: [{
              key: transactionId,
              value: JSON.stringify({
                transactionId,
                status: 'completed',
                timestamp: new Date().toISOString()
              })
            }]
          });

          logger.info(`Transaction ${transactionId} completed successfully`);
        } catch (error) {
          logger.error(`Error completing transaction ${transactionId}:`, error);
        }
      }, 30000); // 30 seconds delay for demo

    } catch (error) {
      logger.error('Transaction monitoring failed:', error);
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
  promClient.collectDefaultMetrics({ register: metricsRegistry, prefix: 'payment_service_' });
  httpHistogram = new promClient.Histogram({
    name: 'payment_service_request_duration_seconds',
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
    message: 'Payment Service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Send payment
app.post('/payments/send', authenticateToken, [
  body('fromWalletId').isUUID(),
  body('toAddress').notEmpty(),
  body('assetId').isUUID(),
  body('amount').isFloat({ min: 0.000001 }),
  body('memo').optional().isLength({ max: 255 })
], validateRequest, async (req, res) => {
  try {
    const { fromWalletId, toAddress, assetId, amount, memo } = req.body;

    // Verify wallet belongs to user
    const walletResult = await pool.query(
      'SELECT * FROM wallets WHERE id = $1 AND user_id = $2 AND is_active = true',
      [fromWalletId, req.user.userId]
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
      [req.user.userId, fromWalletId, assetId]
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

    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, transaction_type, from_wallet_id, from_asset_id, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, status, created_at`,
      [req.user.userId, 'send', fromWalletId, assetId, amount, 'pending']
    );

    const transaction = transactionResult.rows[0];

    // Risk assessment
    const riskAssessment = await TransactionMonitor.checkTransactionRisk({
      userId: req.user.userId,
      amount,
      toAddress,
      asset: asset.symbol
    });

    // Update transaction with risk score
    await pool.query(
      'UPDATE transactions SET risk_score = $1 WHERE id = $2',
      [riskAssessment.riskScore, transaction.id]
    );

    // If high risk, require manual approval
    if (riskAssessment.riskLevel === 'high') {
      await pool.query(
        'UPDATE transactions SET status = $1 WHERE id = $2',
        ['pending_approval', transaction.id]
      );

      // Publish high-risk transaction event
      await producer.send({
        topic: 'high-risk-transaction',
        messages: [{
          key: transaction.id,
          value: JSON.stringify({
            transactionId: transaction.id,
            userId: req.user.userId,
            amount,
            toAddress,
            riskScore: riskAssessment.riskScore,
            riskFactors: riskAssessment.riskFactors,
            timestamp: new Date().toISOString()
          })
        }]
      });

      return res.status(201).json({
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
            status: 'pending_approval',
            riskAssessment,
            createdAt: transaction.created_at
          }
        },
        message: 'Transaction created but requires manual approval due to high risk'
      });
    }

    let onChainSettlement = null;
    if (enableSmartContractSettlement && escrowContract) {
      onChainSettlement = await recordEscrowSettlement({
        payee: toAddress,
        amount,
        description: memo
      });

      if (onChainSettlement) {
        await pool.query(
          "UPDATE transactions SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2",
          [JSON.stringify({ escrow: onChainSettlement }), transaction.id]
        );
      }
    }

    // Start monitoring the transaction
    TransactionMonitor.monitorTransaction(transaction.id);

    logger.info(`Payment transaction created: ${transaction.id} for user ${req.user.userId}`);

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
          riskAssessment,
          ...(onChainSettlement && { onChainSettlement }),
          createdAt: transaction.created_at
        }
      },
      message: 'Payment initiated successfully'
    });

  } catch (error) {
    logger.error('Send payment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PAYMENT_FAILED', message: 'Failed to send payment' }
    });
  }
});

// Swap cryptocurrencies
app.post('/payments/swap', authenticateToken, [
  body('fromAssetId').isUUID(),
  body('toAssetId').isUUID(),
  body('amount').isFloat({ min: 0.000001 }),
  body('slippageTolerance').optional().isFloat({ min: 0, max: 50 })
], validateRequest, async (req, res) => {
  try {
    const { fromAssetId, toAssetId, amount, slippageTolerance = 0.5 } = req.body;

    // Get asset information
    const assetsResult = await pool.query(
      'SELECT * FROM assets WHERE id IN ($1, $2) AND is_active = true',
      [fromAssetId, toAssetId]
    );

    if (assetsResult.rows.length !== 2) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSET_NOT_FOUND', message: 'One or more assets not found' }
      });
    }

    const fromAsset = assetsResult.rows.find(a => a.id === fromAssetId);
    const toAsset = assetsResult.rows.find(a => a.id === toAssetId);

    // In production, this would integrate with DEX aggregators like 1inch or 0x
    // For demo purposes, we'll simulate the swap
    const exchangeRate = 0.95; // Simulated exchange rate
    const expectedAmount = amount * exchangeRate;
    const minimumAmount = expectedAmount * (1 - slippageTolerance / 100);

    // Create swap transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, transaction_type, from_asset_id, to_asset_id, amount, exchange_rate, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, status, created_at`,
      [req.user.userId, 'swap', fromAssetId, toAssetId, amount, exchangeRate, 'pending']
    );

    const transaction = transactionResult.rows[0];

    // Start monitoring the swap
    TransactionMonitor.monitorTransaction(transaction.id);

    logger.info(`Swap transaction created: ${transaction.id} for user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          type: 'swap',
          fromAsset: {
            symbol: fromAsset.symbol,
            name: fromAsset.name
          },
          toAsset: {
            symbol: toAsset.symbol,
            name: toAsset.name
          },
          amount: amount.toString(),
          expectedAmount: expectedAmount.toString(),
          minimumAmount: minimumAmount.toString(),
          exchangeRate: exchangeRate.toString(),
          slippageTolerance: slippageTolerance.toString(),
          status: transaction.status,
          createdAt: transaction.created_at
        }
      },
      message: 'Swap initiated successfully'
    });

  } catch (error) {
    logger.error('Swap error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SWAP_FAILED', message: 'Failed to initiate swap' }
    });
  }
});

// Get transaction history
app.get('/payments/transactions', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, type } = req.query;

    let query = `
      SELECT t.id, t.transaction_type, t.amount, t.fee, t.exchange_rate, t.status, t.blockchain_tx_hash, t.risk_score, t.created_at, t.completed_at,
             fa.symbol as from_symbol, fa.name as from_name,
             ta.symbol as to_symbol, ta.name as to_name
      FROM transactions t
      LEFT JOIN assets fa ON t.from_asset_id = fa.id
      LEFT JOIN assets ta ON t.to_asset_id = ta.id
      WHERE t.user_id = $1
    `;
    
    const params = [req.user.userId];
    let paramCount = 1;

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
      exchangeRate: tx.exchange_rate,
      status: tx.status,
      blockchainTxHash: tx.blockchain_tx_hash,
      riskScore: tx.risk_score,
      fromAsset: tx.from_symbol ? {
        symbol: tx.from_symbol,
        name: tx.from_name
      } : null,
      toAsset: tx.to_symbol ? {
        symbol: tx.to_symbol,
        name: tx.to_name
      } : null,
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

// Create SEPA transfer
app.post('/payments/sepa', authenticateToken, [
  body('amount').isFloat({ min: 0.01 }),
  body('currency').isIn(['EUR', 'USD']),
  body('recipientIban').isIBAN(),
  body('recipientName').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 140 })
], validateRequest, async (req, res) => {
  try {
    const { amount, currency, recipientIban, recipientName, description } = req.body;

    // Create SEPA transfer
    const transfer = await PaymentManager.createSEPATransfer(
      amount,
      currency,
      recipientIban,
      description || `Transfer to ${recipientName}`
    );

    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, status, created_at`,
      [req.user.userId, 'sepa', amount, 'pending']
    );

    const transaction = transactionResult.rows[0];

    logger.info(`SEPA transfer created: ${transaction.id} for user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          type: 'sepa',
          amount: amount.toString(),
          currency,
          recipientIban,
          recipientName,
          description: transfer.description,
          status: transaction.status,
          createdAt: transaction.created_at
        }
      },
      message: 'SEPA transfer initiated successfully'
    });

  } catch (error) {
    logger.error('SEPA transfer error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SEPA_FAILED', message: 'Failed to initiate SEPA transfer' }
    });
  }
});

// Create SWIFT transfer
app.post('/payments/swift', authenticateToken, [
  body('amount').isFloat({ min: 0.01 }),
  body('currency').isIn(['USD', 'EUR', 'GBP']),
  body('recipientBank').isObject(),
  body('recipientName').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 140 })
], validateRequest, async (req, res) => {
  try {
    const { amount, currency, recipientBank, recipientName, description } = req.body;

    // Create SWIFT transfer
    const transfer = await PaymentManager.createSWIFTTransfer(
      amount,
      currency,
      recipientBank,
      description || `Transfer to ${recipientName}`
    );

    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, status, created_at`,
      [req.user.userId, 'swift', amount, 'pending']
    );

    const transaction = transactionResult.rows[0];

    logger.info(`SWIFT transfer created: ${transaction.id} for user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          type: 'swift',
          amount: amount.toString(),
          currency,
          recipientBank,
          recipientName,
          description: transfer.description,
          status: transaction.status,
          createdAt: transaction.created_at
        }
      },
      message: 'SWIFT transfer initiated successfully'
    });

  } catch (error) {
    logger.error('SWIFT transfer error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SWIFT_FAILED', message: 'Failed to initiate SWIFT transfer' }
    });
  }
});

// Background job to process pending transactions
cron.schedule('*/2 * * * *', async () => {
  try {
    logger.info('Processing pending transactions...');
    
    // Get pending transactions
    const pendingTransactions = await pool.query(
      'SELECT * FROM transactions WHERE status = $1 AND created_at < NOW() - INTERVAL \'5 minutes\'',
      ['pending']
    );

    for (const transaction of pendingTransactions.rows) {
      try {
        // Simulate transaction processing
        await pool.query(
          'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', transaction.id]
        );

        // Publish transaction completion event
        await producer.send({
          topic: 'transaction-completed',
          messages: [{
            key: transaction.id,
            value: JSON.stringify({
              transactionId: transaction.id,
              userId: transaction.user_id,
              status: 'completed',
              timestamp: new Date().toISOString()
            })
          }]
        });

        logger.info(`Transaction ${transaction.id} processed successfully`);
      } catch (error) {
        logger.error(`Error processing transaction ${transaction.id}:`, error);
      }
    }

    logger.info('Pending transactions processing completed');
  } catch (error) {
    logger.error('Transaction processing job failed:', error);
  }
});

// Kafka consumer setup
async function setupKafkaConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'transaction-completed' });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          logger.info(`Received message from ${topic}:`, data);
          
          // Handle transaction completion
          if (topic === 'transaction-completed') {
            // Update user balances, send notifications, etc.
            logger.info(`Transaction ${data.transactionId} completed`);
          }
        } catch (error) {
          logger.error('Error processing Kafka message:', error);
        }
      },
    });

    logger.info('Kafka consumer setup completed');
  } catch (error) {
    logger.error('Kafka consumer setup failed:', error);
  }
}

// Initialize Kafka producer
async function setupKafkaProducer() {
  try {
    await producer.connect();
    logger.info('Kafka producer connected');
  } catch (error) {
    logger.error('Kafka producer connection failed:', error);
  }
}

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
app.listen(PORT, async () => {
  logger.info(`Payment Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Setup Kafka
  await setupKafkaProducer();
  await setupKafkaConsumer();
});

module.exports = app;
