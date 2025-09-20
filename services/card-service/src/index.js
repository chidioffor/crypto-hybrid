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
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

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

// Card utilities
class CardManager {
  static async createVirtualCard(userId, cardData) {
    try {
      // In production, this would integrate with Column API or Marqeta API
      // For demo purposes, we'll simulate card creation
      const card = {
        id: `card_${Date.now()}`,
        cardNumber: this.generateCardNumber(),
        expiryMonth: new Date().getMonth() + 1 + 12, // 1 year from now
        expiryYear: new Date().getFullYear() + 1,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        type: cardData.cardType,
        network: cardData.network || 'visa',
        status: 'active',
        dailyLimit: cardData.dailyLimit || 1000,
        monthlyLimit: cardData.monthlyLimit || 10000,
        currency: cardData.currency || 'USD',
        createdAt: new Date().toISOString()
      };

      return card;
    } catch (error) {
      logger.error('Virtual card creation failed:', error);
      throw error;
    }
  }

  static async createPhysicalCard(userId, cardData) {
    try {
      // In production, this would integrate with card issuing APIs
      const card = {
        id: `card_${Date.now()}`,
        cardNumber: this.generateCardNumber(),
        expiryMonth: new Date().getMonth() + 1 + 12,
        expiryYear: new Date().getFullYear() + 1,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        type: 'physical',
        network: cardData.network || 'visa',
        status: 'pending_shipping',
        dailyLimit: cardData.dailyLimit || 2000,
        monthlyLimit: cardData.monthlyLimit || 20000,
        currency: cardData.currency || 'USD',
        shippingAddress: cardData.shippingAddress,
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        createdAt: new Date().toISOString()
      };

      return card;
    } catch (error) {
      logger.error('Physical card creation failed:', error);
      throw error;
    }
  }

  static generateCardNumber() {
    // Generate a valid card number (simplified Luhn algorithm)
    const prefix = '4'; // Visa prefix
    let cardNumber = prefix;
    
    for (let i = 1; i < 15; i++) {
      cardNumber += Math.floor(Math.random() * 10).toString();
    }
    
    // Calculate check digit using Luhn algorithm
    const checkDigit = this.calculateLuhnCheckDigit(cardNumber);
    return cardNumber + checkDigit;
  }

  static calculateLuhnCheckDigit(cardNumber) {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return (10 - (sum % 10)) % 10;
  }

  static async processTransaction(cardId, transactionData) {
    try {
      // In production, this would integrate with card networks
      const transaction = {
        id: `txn_${Date.now()}`,
        cardId,
        amount: transactionData.amount,
        currency: transactionData.currency,
        merchant: transactionData.merchant,
        category: transactionData.category,
        status: 'approved',
        timestamp: new Date().toISOString()
      };

      return transaction;
    } catch (error) {
      logger.error('Transaction processing failed:', error);
      throw error;
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Card Service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get user cards
app.get('/cards', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.card_type, c.card_network, c.status, c.daily_limit, c.monthly_limit, 
              c.currency, c.created_at, c.expires_at,
              COALESCE(SUM(ct.amount), 0) as daily_spent,
              COALESCE(SUM(CASE WHEN ct.created_at >= date_trunc('month', CURRENT_DATE) THEN ct.amount ELSE 0 END), 0) as monthly_spent
       FROM cards c
       LEFT JOIN card_transactions ct ON c.id = ct.card_id AND ct.status = 'completed'
       WHERE c.user_id = $1
       GROUP BY c.id, c.card_type, c.card_network, c.status, c.daily_limit, c.monthly_limit, c.currency, c.created_at, c.expires_at
       ORDER BY c.created_at DESC`,
      [req.user.userId]
    );

    const cards = result.rows.map(card => ({
      id: card.id,
      type: card.card_type,
      network: card.card_network,
      status: card.status,
      dailyLimit: parseFloat(card.daily_limit),
      monthlyLimit: parseFloat(card.monthly_limit),
      currency: card.currency,
      dailySpent: parseFloat(card.daily_spent),
      monthlySpent: parseFloat(card.monthly_spent),
      dailyRemaining: parseFloat(card.daily_limit) - parseFloat(card.daily_spent),
      monthlyRemaining: parseFloat(card.monthly_limit) - parseFloat(card.monthly_spent),
      createdAt: card.created_at,
      expiresAt: card.expires_at
    }));

    res.json({
      success: true,
      data: { cards }
    });

  } catch (error) {
    logger.error('Get cards error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CARDS_FETCH_FAILED', message: 'Failed to fetch cards' }
    });
  }
});

// Apply for new card
app.post('/cards/apply', authenticateToken, [
  body('cardType').isIn(['virtual', 'physical']),
  body('network').isIn(['visa', 'mastercard']),
  body('currency').isIn(['USD', 'EUR', 'GBP']),
  body('dailyLimit').isFloat({ min: 100, max: 50000 }),
  body('monthlyLimit').isFloat({ min: 1000, max: 500000 }),
  body('shippingAddress').optional().isObject()
], validateRequest, async (req, res) => {
  try {
    const { cardType, network, currency, dailyLimit, monthlyLimit, shippingAddress } = req.body;

    // Check if user has reached card limit
    const existingCards = await pool.query(
      'SELECT COUNT(*) FROM cards WHERE user_id = $1',
      [req.user.userId]
    );

    const maxCards = 5; // Maximum cards per user
    if (parseInt(existingCards.rows[0].count) >= maxCards) {
      return res.status(400).json({
        success: false,
        error: { code: 'CARD_LIMIT_REACHED', message: `Maximum ${maxCards} cards allowed per user` }
      });
    }

    let card;
    if (cardType === 'virtual') {
      card = await CardManager.createVirtualCard(req.user.userId, {
        cardType,
        network,
        currency,
        dailyLimit,
        monthlyLimit
      });
    } else {
      if (!shippingAddress) {
        return res.status(400).json({
          success: false,
          error: { code: 'SHIPPING_ADDRESS_REQUIRED', message: 'Shipping address required for physical cards' }
        });
      }
      
      card = await CardManager.createPhysicalCard(req.user.userId, {
        cardType,
        network,
        currency,
        dailyLimit,
        monthlyLimit,
        shippingAddress
      });
    }

    // Save card to database
    const result = await pool.query(
      `INSERT INTO cards (user_id, card_number_hash, card_type, card_network, status, daily_limit, monthly_limit, currency, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
       RETURNING id, card_type, card_network, status, daily_limit, monthly_limit, currency, created_at, expires_at`,
      [
        req.user.userId,
        require('crypto').createHash('sha256').update(card.cardNumber).digest('hex'),
        card.type,
        card.network,
        card.status,
        card.dailyLimit,
        card.monthlyLimit,
        card.currency,
        new Date(card.expiryYear, card.expiryMonth - 1, 1)
      ]
    );

    const savedCard = result.rows[0];

    logger.info(`New ${cardType} card created for user ${req.user.userId}: ${savedCard.id}`);

    res.status(201).json({
      success: true,
      data: {
        card: {
          id: savedCard.id,
          type: savedCard.card_type,
          network: savedCard.card_network,
          status: savedCard.status,
          dailyLimit: parseFloat(savedCard.daily_limit),
          monthlyLimit: parseFloat(savedCard.monthly_limit),
          currency: savedCard.currency,
          createdAt: savedCard.created_at,
          expiresAt: savedCard.expires_at
        },
        ...(cardType === 'virtual' && {
          cardDetails: {
            cardNumber: card.cardNumber,
            expiryMonth: card.expiryMonth,
            expiryYear: card.expiryYear,
            cvv: card.cvv
          }
        }),
        ...(cardType === 'physical' && {
          estimatedDelivery: card.estimatedDelivery
        })
      },
      message: `${cardType} card application submitted successfully`
    });

  } catch (error) {
    logger.error('Card application error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CARD_APPLICATION_FAILED', message: 'Failed to apply for card' }
    });
  }
});

// Update card controls
app.put('/cards/:cardId/controls', authenticateToken, [
  body('dailyLimit').optional().isFloat({ min: 100, max: 50000 }),
  body('monthlyLimit').optional().isFloat({ min: 1000, max: 500000 }),
  body('merchantCategories').optional().isArray(),
  body('geographicRestrictions').optional().isArray(),
  body('status').optional().isIn(['active', 'frozen', 'cancelled'])
], validateRequest, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { dailyLimit, monthlyLimit, merchantCategories, geographicRestrictions, status } = req.body;

    // Verify card belongs to user
    const cardCheck = await pool.query(
      'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
      [cardId, req.user.userId]
    );

    if (cardCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Card not found' }
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (dailyLimit !== undefined) {
      updates.push(`daily_limit = $${paramCount++}`);
      values.push(dailyLimit);
    }

    if (monthlyLimit !== undefined) {
      updates.push(`monthly_limit = $${paramCount++}`);
      values.push(monthlyLimit);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_UPDATES', message: 'No valid fields to update' }
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(cardId);

    const query = `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    const card = result.rows[0];

    // Update card controls if provided
    if (merchantCategories || geographicRestrictions) {
      await pool.query(
        `INSERT INTO card_controls (card_id, merchant_categories, geographic_restrictions, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (card_id) DO UPDATE SET
         merchant_categories = EXCLUDED.merchant_categories,
         geographic_restrictions = EXCLUDED.geographic_restrictions,
         updated_at = NOW()`,
        [cardId, merchantCategories || null, geographicRestrictions || null]
      );
    }

    logger.info(`Card controls updated for card ${cardId} by user ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        card: {
          id: card.id,
          type: card.card_type,
          network: card.card_network,
          status: card.status,
          dailyLimit: parseFloat(card.daily_limit),
          monthlyLimit: parseFloat(card.monthly_limit),
          currency: card.currency,
          updatedAt: card.updated_at
        }
      },
      message: 'Card controls updated successfully'
    });

  } catch (error) {
    logger.error('Update card controls error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CARD_CONTROLS_UPDATE_FAILED', message: 'Failed to update card controls' }
    });
  }
});

// Get card transaction history
app.get('/cards/:cardId/transactions', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { limit = 50, offset = 0, status } = req.query;

    // Verify card belongs to user
    const cardCheck = await pool.query(
      'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
      [cardId, req.user.userId]
    );

    if (cardCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Card not found' }
      });
    }

    let query = `
      SELECT id, amount, currency, merchant, category, status, created_at
      FROM card_transactions
      WHERE card_id = $1
    `;
    
    const params = [cardId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const transactions = result.rows.map(tx => ({
      id: tx.id,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      merchant: tx.merchant,
      category: tx.category,
      status: tx.status,
      createdAt: tx.created_at
    }));

    res.json({
      success: true,
      data: { transactions }
    });

  } catch (error) {
    logger.error('Get card transactions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CARD_TRANSACTIONS_FETCH_FAILED', message: 'Failed to fetch card transactions' }
    });
  }
});

// Freeze/unfreeze card
app.post('/cards/:cardId/freeze', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;

    // Verify card belongs to user
    const cardResult = await pool.query(
      'SELECT status FROM cards WHERE id = $1 AND user_id = $2',
      [cardId, req.user.userId]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Card not found' }
      });
    }

    const currentStatus = cardResult.rows[0].status;
    const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';

    await pool.query(
      'UPDATE cards SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, cardId]
    );

    logger.info(`Card ${cardId} ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'} by user ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        cardId,
        status: newStatus
      },
      message: `Card ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'} successfully`
    });

  } catch (error) {
    logger.error('Freeze/unfreeze card error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CARD_FREEZE_FAILED', message: 'Failed to freeze/unfreeze card' }
    });
  }
});

// Cancel card
app.post('/cards/:cardId/cancel', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;

    // Verify card belongs to user
    const cardResult = await pool.query(
      'SELECT status FROM cards WHERE id = $1 AND user_id = $2',
      [cardId, req.user.userId]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Card not found' }
      });
    }

    if (cardResult.rows[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: { code: 'CARD_ALREADY_CANCELLED', message: 'Card is already cancelled' }
      });
    }

    await pool.query(
      'UPDATE cards SET status = $1, updated_at = NOW() WHERE id = $2',
      ['cancelled', cardId]
    );

    logger.info(`Card ${cardId} cancelled by user ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        cardId,
        status: 'cancelled'
      },
      message: 'Card cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel card error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CARD_CANCEL_FAILED', message: 'Failed to cancel card' }
    });
  }
});

// Background job to process card transactions
cron.schedule('*/1 * * * *', async () => {
  try {
    logger.info('Processing card transactions...');
    
    // Simulate incoming card transactions
    const activeCards = await pool.query(
      'SELECT id FROM cards WHERE status = $1',
      ['active']
    );

    // Randomly process some transactions for demo
    if (Math.random() < 0.1 && activeCards.rows.length > 0) {
      const randomCard = activeCards.rows[Math.floor(Math.random() * activeCards.rows.length)];
      
      const transaction = await CardManager.processTransaction(randomCard.id, {
        amount: Math.floor(Math.random() * 500) + 10,
        currency: 'USD',
        merchant: 'Demo Merchant',
        category: 'retail'
      });

      // Save transaction to database
      await pool.query(
        `INSERT INTO card_transactions (card_id, amount, currency, merchant, category, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomCard.id, transaction.amount, transaction.currency, transaction.merchant, transaction.category, transaction.status]
      );

      logger.info(`Card transaction processed: ${transaction.id} for card ${randomCard.id}`);
    }

  } catch (error) {
    logger.error('Card transaction processing job failed:', error);
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
  logger.info(`Card Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
