const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: { code: 'MISSING_TOKEN', message: 'Access token required' } 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } 
      });
    }
    req.user = user;
    next();
  });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API Gateway is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Service discovery and proxy configuration
const services = {
  user: {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    pathRewrite: { '^/api/users': '' },
    changeOrigin: true
  },
  wallet: {
    target: process.env.WALLET_SERVICE_URL || 'http://wallet-service:3002',
    pathRewrite: { '^/api/wallets': '' },
    changeOrigin: true
  },
  payment: {
    target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003',
    pathRewrite: { '^/api/payments': '' },
    changeOrigin: true
  },
  card: {
    target: process.env.CARD_SERVICE_URL || 'http://card-service:3004',
    pathRewrite: { '^/api/cards': '' },
    changeOrigin: true
  }
};

// Authentication endpoints (no auth required)
app.use('/api/auth', createProxyMiddleware({
  target: services.user.target,
  pathRewrite: { '^/api/auth': '/auth' },
  changeOrigin: true,
  onError: (err, req, res) => {
    logger.error('Auth service error:', err);
    res.status(500).json({ 
      success: false, 
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Authentication service unavailable' } 
    });
  }
}));

// User service endpoints
app.use('/api/users', authenticateToken, createProxyMiddleware({
  ...services.user,
  onError: (err, req, res) => {
    logger.error('User service error:', err);
    res.status(500).json({ 
      success: false, 
      error: { code: 'SERVICE_UNAVAILABLE', message: 'User service unavailable' } 
    });
  }
}));

// Wallet service endpoints
app.use('/api/wallets', authenticateToken, createProxyMiddleware({
  ...services.wallet,
  onError: (err, req, res) => {
    logger.error('Wallet service error:', err);
    res.status(500).json({ 
      success: false, 
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Wallet service unavailable' } 
    });
  }
}));

// Payment service endpoints
app.use('/api/payments', authenticateToken, createProxyMiddleware({
  ...services.payment,
  onError: (err, req, res) => {
    logger.error('Payment service error:', err);
    res.status(500).json({ 
      success: false, 
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Payment service unavailable' } 
    });
  }
}));

// Card service endpoints
app.use('/api/cards', authenticateToken, createProxyMiddleware({
  ...services.card,
  onError: (err, req, res) => {
    logger.error('Card service error:', err);
    res.status(500).json({ 
      success: false, 
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Card service unavailable' } 
    });
  }
}));

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'CryptoHybrid Bank API',
      version: '1.0.0',
      description: 'Comprehensive crypto-fiat banking platform API',
      endpoints: {
        auth: {
          'POST /api/auth/register': 'Register a new user',
          'POST /api/auth/login': 'Login user',
          'POST /api/auth/refresh': 'Refresh access token',
          'POST /api/auth/logout': 'Logout user'
        },
        users: {
          'GET /api/users/profile': 'Get user profile',
          'PUT /api/users/profile': 'Update user profile',
          'POST /api/users/kyc': 'Submit KYC documents'
        },
        wallets: {
          'GET /api/wallets': 'Get user wallets',
          'POST /api/wallets': 'Create new wallet',
          'GET /api/wallets/:id/balances': 'Get wallet balances',
          'POST /api/wallets/:id/send': 'Send cryptocurrency'
        },
        payments: {
          'GET /api/payments/transactions': 'Get transaction history',
          'POST /api/payments/send': 'Send payment',
          'POST /api/payments/swap': 'Swap cryptocurrencies'
        },
        cards: {
          'GET /api/cards': 'Get user cards',
          'POST /api/cards/apply': 'Apply for new card',
          'PUT /api/cards/:id/controls': 'Update card controls'
        }
      }
    }
  });
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
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
