const request = require('supertest');
const axios = require('axios');
const { expect } = require('chai');

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('CryptoHybrid Bank API Integration Tests', () => {
  let authToken;
  let userId;

  before(async function() {
    this.timeout(15000);

    try {
      await axios.get(`${API_BASE_URL}/health`, { timeout: 3000 });
    } catch (error) {
      console.warn(
        `Skipping API integration tests: unable to reach ${API_BASE_URL} (${error.message})`
      );
      this.skip();
    }

    // Wait for services to be ready
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  describe('Authentication', () => {
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      countryCode: 'US'
    };

    it('should register a new user', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('token');
      expect(response.body.data).to.have.property('user');
      expect(response.body.data.user).to.have.property('email', testUser.email);

      authToken = response.body.data.token;
      userId = response.body.data.user.id;
    });

    it('should login with valid credentials', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('token');
      expect(response.body.data).to.have.property('user');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).to.have.property('success', false);
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('User Profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('id', userId);
      expect(response.body.data).to.have.property('email');
    });

    it('should reject profile request without token', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).to.have.property('success', false);
    });

    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(API_BASE_URL)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('firstName', 'Updated');
      expect(response.body.data).to.have.property('lastName', 'Name');
    });
  });

  describe('Wallet Operations', () => {
    let walletId;

    it('should create a new wallet', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'custodial'
        })
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('wallet');
      expect(response.body.data.wallet).to.have.property('id');
      expect(response.body.data.wallet).to.have.property('type', 'custodial');

      walletId = response.body.data.wallet.id;
    });

    it('should get user wallets', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
    });

    it('should get wallet balances', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/wallets/${walletId}/balances`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
    });
  });

  describe('Payment Operations', () => {
    it('should get transaction history', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/payments/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
    });

    it('should reject send payment without sufficient balance', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/payments/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId: 'test-wallet-id',
          assetId: 'test-asset-id',
          amount: '1000',
          toAddress: '0x742d35cc6634c0532925a3b8d60c9a0d4b9b5c30'
        })
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Card Operations', () => {
    it('should get user cards', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/cards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
    });

    it('should apply for a new card', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/cards/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'virtual',
          cardholderName: 'Test User'
        })
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('application');
    });
  });

  describe('API Documentation', () => {
    it('should serve API documentation', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/docs')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('title');
      expect(response.body.data).to.have.property('endpoints');
    });
  });

  describe('Health Checks', () => {
    it('should return health status', async () => {
      const response = await request(API_BASE_URL)
        .get('/health')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async function() {
      this.timeout(10000); // Increase timeout for this test

      // Make multiple requests to trigger rate limit
      const requests = [];
      for (let i = 0; i < 110; i++) { // Exceed the 100 request limit
        requests.push(
          request(API_BASE_URL)
            .get('/health')
        );
      }

      const responses = await Promise.all(requests);
      
      // Check that some requests were rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });
  });
});
