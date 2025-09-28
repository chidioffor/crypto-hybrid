const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
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

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(403).json({ 
        success: false, 
        error: { code: 'TOKEN_BLACKLISTED', message: 'Token has been revoked' } 
      });
    }

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User Service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// User Registration
app.post('/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('firstName').trim().isLength({ min: 1, max: 100 }),
  body('lastName').trim().isLength({ min: 1, max: 100 }),
  body('dateOfBirth').isISO8601(),
  body('countryCode').isLength({ min: 2, max: 3 })
], validateRequest, async (req, res) => {
  try {
    const { email, password, firstName, lastName, dateOfBirth, countryCode } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' }
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, country_code, kyc_status, kyc_level, risk_score, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING id, email, first_name, last_name, kyc_status, kyc_level, created_at`,
      [email, hashedPassword, firstName, lastName, dateOfBirth, countryCode, 'pending', 1, 0.0, true]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token in Redis
    await redisClient.setEx(`refresh:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          kycStatus: user.kyc_status,
          kycLevel: user.kyc_level,
          createdAt: user.created_at
        },
        token,
        refreshToken
      },
      message: 'User registered successfully'
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: 'Failed to register user' }
    });
  }
});

// User Login
app.post('/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Check MFA if enabled
    if (user.mfa_enabled) {
      if (!mfaCode) {
        return res.status(401).json({
          success: false,
          error: { code: 'MFA_REQUIRED', message: 'MFA code required' }
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: mfaCode,
        window: 2
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_MFA', message: 'Invalid MFA code' }
        });
      }
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token in Redis
    await redisClient.setEx(`refresh:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          kycStatus: user.kyc_status,
          kycLevel: user.kyc_level,
          riskScore: user.risk_score,
          mfaEnabled: user.mfa_enabled,
          createdAt: user.created_at,
          lastLogin: user.last_login
        },
        token,
        refreshToken
      },
      message: 'Login successful'
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: 'Failed to login' }
    });
  }
});

// Refresh Token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token required' }
      });
    }

    const decoded = jwt.verify(refreshToken, config.jwtSecret);
    
    // Check if refresh token exists in Redis
    const storedToken = await redisClient.get(`refresh:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' }
      });
    }

    // Generate new access token
    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: { token: newToken },
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(403).json({
      success: false,
      error: { code: 'REFRESH_FAILED', message: 'Failed to refresh token' }
    });
  }
});

// Logout
app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Blacklist the token
    await redisClient.setEx(`blacklist:${token}`, 3600, 'true');

    // Remove refresh token
    await redisClient.del(`refresh:${req.user.userId}`);

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGOUT_FAILED', message: 'Failed to logout' }
    });
  }
});

// Get User Profile
app.get('/users/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, date_of_birth, country_code, 
              kyc_status, kyc_level, risk_score, mfa_enabled, created_at, updated_at, last_login
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        countryCode: user.country_code,
        kycStatus: user.kyc_status,
        kycLevel: user.kyc_level,
        riskScore: user.risk_score,
        mfaEnabled: user.mfa_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PROFILE_FETCH_FAILED', message: 'Failed to fetch profile' }
    });
  }
});

// Update User Profile
app.put('/users/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
  body('dateOfBirth').optional().isISO8601()
], validateRequest, async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (dateOfBirth) {
      updates.push(`date_of_birth = $${paramCount++}`);
      values.push(dateOfBirth);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_UPDATES', message: 'No valid fields to update' }
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        countryCode: user.country_code,
        kycStatus: user.kyc_status,
        kycLevel: user.kyc_level,
        riskScore: user.risk_score,
        mfaEnabled: user.mfa_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login
      },
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PROFILE_UPDATE_FAILED', message: 'Failed to update profile' }
    });
  }
});

// Setup MFA
app.post('/users/mfa/setup', authenticateToken, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `CryptoHybrid Bank (${req.user.email})`,
      issuer: 'CryptoHybrid Bank'
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (user needs to verify before enabling)
    await redisClient.setEx(`mfa_temp:${req.user.userId}`, 300, secret.base32); // 5 minutes

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      },
      message: 'MFA setup initiated. Verify with a code to enable.'
    });

  } catch (error) {
    logger.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'MFA_SETUP_FAILED', message: 'Failed to setup MFA' }
    });
  }
});

// Verify and Enable MFA
app.post('/users/mfa/verify', authenticateToken, [
  body('token').isLength({ min: 6, max: 6 }).isNumeric()
], validateRequest, async (req, res) => {
  try {
    const { token } = req.body;

    // Get temporary secret
    const tempSecret = await redisClient.get(`mfa_temp:${req.user.userId}`);
    if (!tempSecret) {
      return res.status(400).json({
        success: false,
        error: { code: 'MFA_SETUP_EXPIRED', message: 'MFA setup session expired' }
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MFA_TOKEN', message: 'Invalid MFA token' }
      });
    }

    // Enable MFA for user
    await pool.query(
      'UPDATE users SET mfa_enabled = true, mfa_secret = $1, updated_at = NOW() WHERE id = $2',
      [tempSecret, req.user.userId]
    );

    // Clean up temporary secret
    await redisClient.del(`mfa_temp:${req.user.userId}`);

    logger.info(`MFA enabled for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'MFA enabled successfully'
    });

  } catch (error) {
    logger.error('MFA verify error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'MFA_VERIFY_FAILED', message: 'Failed to verify MFA' }
    });
  }
});

// Disable MFA
app.post('/users/mfa/disable', authenticateToken, [
  body('token').isLength({ min: 6, max: 6 }).isNumeric()
], validateRequest, async (req, res) => {
  try {
    const { token } = req.body;

    // Get user's MFA secret
    const result = await pool.query(
      'SELECT mfa_secret FROM users WHERE id = $1 AND mfa_enabled = true',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled' }
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: result.rows[0].mfa_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MFA_TOKEN', message: 'Invalid MFA token' }
      });
    }

    // Disable MFA
    await pool.query(
      'UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.userId]
    );

    logger.info(`MFA disabled for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });

  } catch (error) {
    logger.error('MFA disable error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'MFA_DISABLE_FAILED', message: 'Failed to disable MFA' }
    });
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
      logger.info(`User Service running on port ${PORT}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service', error);
    throw error;
  }
};

const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down User Service.`);

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
  redisClient
};
