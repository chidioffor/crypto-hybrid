@echo off
REM CryptoHybrid Bank Deployment Script for Windows
REM This script sets up and deploys the complete CryptoHybrid Bank application

setlocal enabledelayedexpansion

echo [%date% %time%] Starting CryptoHybrid Bank deployment...

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose is not installed. Please install Docker Compose first.
    exit /b 1
)

echo [%date% %time%] Docker and Docker Compose are installed

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed. Please install npm first.
    exit /b 1
)

echo [%date% %time%] Node.js and npm are installed

REM Create necessary directories
echo [%date% %time%] Creating necessary directories...
if not exist logs mkdir logs
if not exist data\postgres mkdir data\postgres
if not exist data\mongodb mkdir data\mongodb
if not exist data\redis mkdir data\redis
if not exist backups mkdir backups
if not exist monitoring\grafana mkdir monitoring\grafana
if not exist ssl mkdir ssl

REM Generate environment file
echo [%date% %time%] Generating environment file...
(
echo # Environment
echo NODE_ENV=production
echo APP_VERSION=1.0.0
echo.
echo # Database Configuration
echo POSTGRES_HOST=postgres
echo POSTGRES_PORT=5432
echo POSTGRES_DB=cryptohybridbank
echo POSTGRES_USER=admin
echo POSTGRES_PASSWORD=secure_password_123
echo.
echo MONGODB_HOST=mongodb
echo MONGODB_PORT=27017
echo MONGODB_DB=cryptohybridbank
echo MONGODB_USER=admin
echo MONGODB_PASSWORD=secure_mongo_password_123
echo.
echo REDIS_HOST=redis
echo REDIS_PORT=6379
echo REDIS_PASSWORD=
echo.
echo # JWT Configuration
echo JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
echo JWT_EXPIRES_IN=1h
echo REFRESH_TOKEN_EXPIRES_IN=7d
echo.
echo # API Configuration
echo API_GATEWAY_URL=http://api-gateway:3000
echo USER_SERVICE_URL=http://user-service:3001
echo WALLET_SERVICE_URL=http://wallet-service:3002
echo PAYMENT_SERVICE_URL=http://payment-service:3003
echo CARD_SERVICE_URL=http://card-service:3004
echo.
echo # Frontend Configuration
echo REACT_APP_API_URL=http://localhost:3000
echo.
echo # External API Keys ^(Replace with your actual keys^)
echo PLAID_CLIENT_ID=your_plaid_client_id
echo PLAID_SECRET=your_plaid_secret
echo PLAID_ENV=sandbox
echo.
echo FIREBLOCKS_API_KEY=your_fireblocks_api_key
echo FIREBLOCKS_SECRET_KEY=your_fireblocks_secret_key
echo.
echo STRIPE_SECRET_KEY=your_stripe_secret_key
echo STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
echo.
echo CHAINALYSIS_API_KEY=your_chainalysis_api_key
echo.
echo COLUMN_API_KEY=your_column_api_key
echo MARQETA_API_KEY=your_marqeta_api_key
echo.
echo # Blockchain Configuration
echo ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
echo POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/your_project_id
echo BSC_RPC_URL=https://bsc-dataseed.binance.org/
echo PRIVATE_KEY=your_deployment_private_key
echo.
echo # Monitoring
echo GRAFANA_ADMIN_PASSWORD=admin123
echo.
echo # Security
echo ALLOWED_ORIGINS=http://localhost:3005,https://your-domain.com
) > .env

echo [%date% %time%] Environment file created. Please update the API keys with your actual values.

REM Install dependencies
echo [%date% %time%] Installing dependencies...

if exist package.json (
    npm install
)

REM Install service dependencies
for /d %%i in (services\*) do (
    if exist "%%i\package.json" (
        echo Installing dependencies for %%i
        pushd "%%i"
        npm install
        popd
    )
)

REM Install frontend dependencies
if exist frontend\package.json (
    echo Installing frontend dependencies
    pushd frontend
    npm install
    popd
)

REM Install smart contract dependencies
if exist smart-contracts\package.json (
    echo Installing smart contract dependencies
    pushd smart-contracts
    npm install
    popd
)

REM Build and start services
echo [%date% %time%] Building and starting services...

REM Build all services
docker-compose build --parallel

REM Start infrastructure services first
echo [%date% %time%] Starting infrastructure services...
docker-compose up -d postgres mongodb redis

REM Wait for databases to be ready
echo [%date% %time%] Waiting for databases to initialize...
timeout /t 60 /nobreak

REM Start application services
echo [%date% %time%] Starting application services...
docker-compose up -d

REM Wait for services to be ready
echo [%date% %time%] Waiting for services to start...
timeout /t 30 /nobreak

REM Health check
echo [%date% %time%] Performing health checks...
curl -f http://localhost:3000/health >nul 2>&1 && (
    echo ✓ API Gateway is healthy
) || (
    echo ✗ API Gateway health check failed
)

curl -f http://localhost:3005 >nul 2>&1 && (
    echo ✓ Frontend is accessible
) || (
    echo ✗ Frontend is not accessible
)

REM Start monitoring services
echo [%date% %time%] Setting up monitoring...
docker-compose up -d prometheus grafana

echo.
echo [%date% %time%] Deployment completed successfully!
echo.
echo Access your application at:
echo   Frontend: http://localhost:3005
echo   API Gateway: http://localhost:3000
echo   API Documentation: http://localhost:3000/api/docs
echo   Prometheus: http://localhost:9090
echo   Grafana: http://localhost:3006
echo.
echo Next steps:
echo 1. Update API keys in the .env file
echo 2. Configure your domain and SSL certificates
echo 3. Set up backup procedures
echo 4. Configure monitoring alerts
echo.
echo WARNING: Make sure to update the placeholder API keys in the .env file!

pause
