const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock users database
const users = [];
let userIdCounter = 1;

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Mock API Gateway is healthy',
    timestamp: new Date().toISOString()
  });
});

// Mock registration endpoint
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, firstName, lastName, dateOfBirth, countryCode } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' }
      });
    }

    // Create new user
    const newUser = {
      id: userIdCounter++,
      email,
      firstName,
      lastName,
      dateOfBirth,
      countryCode,
      kycStatus: 'pending',
      kycLevel: 1,
      riskScore: 0.0,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    users.push(newUser);

    // Generate mock tokens
    const token = `mock_token_${newUser.id}_${Date.now()}`;
    const refreshToken = `mock_refresh_${newUser.id}_${Date.now()}`;

    console.log(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: newUser,
        token,
        refreshToken
      },
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: 'Failed to register user' }
    });
  }
});

// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();

    // Generate mock tokens
    const token = `mock_token_${user.id}_${Date.now()}`;
    const refreshToken = `mock_refresh_${user.id}_${Date.now()}`;

    console.log(`User logged in: ${email}`);

    res.json({
      success: true,
      data: {
        user,
        token,
        refreshToken
      },
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: 'Failed to login' }
    });
  }
});

// Mock refresh token endpoint
app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token required' }
      });
    }

    // Generate new token
    const newToken = `mock_token_refreshed_${Date.now()}`;

    res.json({
      success: true,
      data: { token: newToken },
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(403).json({
      success: false,
      error: { code: 'REFRESH_FAILED', message: 'Failed to refresh token' }
    });
  }
});

// Mock logout endpoint
app.post('/api/auth/logout', (req, res) => {
  console.log('User logged out');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'CryptoHybrid Bank Mock API',
      version: '1.0.0',
      description: 'Mock API for development',
      endpoints: {
        auth: {
          'POST /api/auth/register': 'Register a new user',
          'POST /api/auth/login': 'Login user',
          'POST /api/auth/refresh': 'Refresh access token',
          'POST /api/auth/logout': 'Logout user'
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

// Start server
app.listen(PORT, () => {
  console.log(`Mock API Gateway running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
