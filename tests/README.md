# CryptoHybrid Bank Testing Suite

This directory contains comprehensive tests for the CryptoHybrid Bank application, including integration tests, end-to-end tests, and performance tests.

## Test Structure

```
tests/
├── integration/          # API integration tests
│   └── api.test.js       # Main API test suite
├── e2e/                  # End-to-end frontend tests
│   └── frontend.test.js  # Frontend E2E tests
├── package.json          # Test dependencies
└── README.md            # This file
```

## Prerequisites

1. **Running Application**: Ensure all services are running:
   ```bash
   docker-compose up -d
   ```

2. **Install Test Dependencies**:
   ```bash
   cd tests
   npm install
   ```

## Running Tests

### All Tests
```bash
npm test
```

### Integration Tests Only
```bash
npm run test:integration
```

### End-to-End Tests Only
```bash
npm run test:e2e
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Categories

### 1. Integration Tests (`integration/api.test.js`)

Tests the API endpoints and business logic:

- **Authentication Tests**
  - User registration
  - User login/logout
  - Token validation
  - Password reset

- **User Profile Tests**
  - Profile retrieval
  - Profile updates
  - KYC document upload

- **Wallet Tests**
  - Wallet creation
  - Balance queries
  - Multi-asset support

- **Payment Tests**
  - Transaction history
  - Payment processing
  - Balance validation

- **Card Tests**
  - Card application
  - Card management
  - Transaction limits

- **System Tests**
  - Health checks
  - Rate limiting
  - Error handling
  - API documentation

### 2. End-to-End Tests (`e2e/frontend.test.js`)

Tests the complete user journey through the web interface:

- **Navigation Tests**
  - Page routing
  - Authentication redirects
  - Menu navigation

- **User Registration Flow**
  - Form validation
  - Successful registration
  - Error handling

- **Login Flow**
  - Valid/invalid credentials
  - Session management
  - Dashboard access

- **Responsive Design**
  - Mobile compatibility
  - Tablet compatibility
  - Desktop optimization

- **Accessibility**
  - Form labels
  - Heading structure
  - Keyboard navigation

- **Performance**
  - Page load times
  - Console errors
  - Resource optimization

## Test Configuration

### Environment Variables

Set these environment variables for testing:

```bash
# API Testing
API_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPassword123!

# E2E Testing
FRONTEND_URL=http://localhost:3005
HEADLESS=true  # Set to false for visual debugging
```

### Test Data

Tests use dynamically generated test data to avoid conflicts:
- Email addresses include timestamps
- User data is randomly generated
- Database cleanup is handled automatically

## Debugging Tests

### Integration Tests

1. **Enable Detailed Logging**:
   ```bash
   DEBUG=test:* npm run test:integration
   ```

2. **Run Single Test**:
   ```bash
   npx mocha integration/api.test.js --grep "should register a new user"
   ```

3. **Inspect API Responses**:
   Add `console.log(response.body)` in test files

### E2E Tests

1. **Visual Debugging** (disable headless mode):
   ```bash
   HEADLESS=false npm run test:e2e
   ```

2. **Screenshot on Failure**:
   ```javascript
   afterEach(async function() {
     if (this.currentTest.state === 'failed') {
       await page.screenshot({ path: `error-${Date.now()}.png` });
     }
   });
   ```

3. **Slow Motion**:
   ```javascript
   const browser = await puppeteer.launch({
     headless: false,
     slowMo: 250  // Slow down by 250ms
   });
   ```

## Continuous Integration

### GitHub Actions

Example workflow for automated testing:

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Start services
        run: docker-compose up -d
      - name: Wait for services
        run: sleep 30
      - name: Run tests
        run: |
          cd tests
          npm install
          npm test
```

### Docker Testing

Run tests in Docker environment:

```bash
# Build test image
docker build -t cryptohybrid-tests -f tests/Dockerfile .

# Run tests
docker run --network cryptohybrid-network cryptohybrid-tests
```

## Test Reports

### HTML Reports

Generate HTML test reports:

```bash
npm test -- --reporter mochawesome
```

### JUnit Reports

For CI/CD integration:

```bash
npm test -- --reporter xunit --reporter-options output=test-results.xml
```

### Coverage Reports

Generate coverage reports:

```bash
npm run test:coverage
open coverage/index.html
```

## Performance Testing

### Load Testing

Use Artillery.js for load testing:

```bash
npm install -g artillery
artillery quick --count 10 --num 100 http://localhost:3000/api/health
```

### Memory Profiling

Monitor memory usage during tests:

```bash
node --inspect tests/integration/api.test.js
```

## Best Practices

### Writing Tests

1. **Descriptive Names**: Use clear, descriptive test names
2. **Independent Tests**: Each test should be independent
3. **Cleanup**: Always clean up test data
4. **Assertions**: Use meaningful assertions with clear error messages
5. **Timeouts**: Set appropriate timeouts for async operations

### Test Data Management

1. **Dynamic Data**: Generate unique test data
2. **Isolation**: Avoid shared test data between tests
3. **Cleanup**: Remove test data after tests complete
4. **Fixtures**: Use fixtures for complex test scenarios

### Error Handling

1. **Expected Errors**: Test both success and failure scenarios
2. **Edge Cases**: Test boundary conditions
3. **Timeouts**: Handle network timeouts gracefully
4. **Retries**: Implement retry logic for flaky tests

## Troubleshooting

### Common Issues

1. **Services Not Ready**:
   - Increase wait time before running tests
   - Check service health endpoints
   - Verify Docker containers are running

2. **Database Connection**:
   - Ensure database is initialized
   - Check connection strings
   - Verify migrations have run

3. **Authentication Failures**:
   - Check JWT secret configuration
   - Verify token expiration settings
   - Ensure user creation is successful

4. **E2E Test Failures**:
   - Check browser compatibility
   - Verify frontend is accessible
   - Ensure proper element selectors

### Getting Help

1. Check service logs: `docker-compose logs [service-name]`
2. Verify service health: `curl http://localhost:3000/health`
3. Run tests in debug mode: `DEBUG=* npm test`
4. Check database connectivity: `docker-compose exec postgres psql -U admin -d cryptohybridbank`

## Contributing

When adding new tests:

1. Follow existing test structure
2. Add appropriate documentation
3. Ensure tests are reliable and not flaky
4. Include both positive and negative test cases
5. Update this README if adding new test categories
