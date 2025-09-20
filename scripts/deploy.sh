#!/bin/bash

# CryptoHybrid Bank Deployment Script
# This script sets up and deploys the complete CryptoHybrid Bank application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    log "Docker and Docker Compose are installed"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js first."
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
    fi
    
    log "Node.js and npm are installed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    mkdir -p logs
    mkdir -p data/postgres
    mkdir -p data/mongodb
    mkdir -p data/redis
    mkdir -p backups
    mkdir -p monitoring/grafana
    mkdir -p ssl
}

# Generate environment files
generate_env_files() {
    log "Generating environment files..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 64)
    
    # Generate database passwords
    DB_PASSWORD=$(openssl rand -hex 16)
    MONGO_PASSWORD=$(openssl rand -hex 16)
    
    # Create .env file
    cat > .env << EOF
# Environment
NODE_ENV=production
APP_VERSION=1.0.0

# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=cryptohybridbank
POSTGRES_USER=admin
POSTGRES_PASSWORD=${DB_PASSWORD}

MONGODB_HOST=mongodb
MONGODB_PORT=27017
MONGODB_DB=cryptohybridbank
MONGODB_USER=admin
MONGODB_PASSWORD=${MONGO_PASSWORD}

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# API Configuration
API_GATEWAY_URL=http://api-gateway:3000
USER_SERVICE_URL=http://user-service:3001
WALLET_SERVICE_URL=http://wallet-service:3002
PAYMENT_SERVICE_URL=http://payment-service:3003
CARD_SERVICE_URL=http://card-service:3004

# Frontend Configuration
REACT_APP_API_URL=http://localhost:3000

# External API Keys (Replace with your actual keys)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox

FIREBLOCKS_API_KEY=your_fireblocks_api_key
FIREBLOCKS_SECRET_KEY=your_fireblocks_secret_key

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

CHAINALYSIS_API_KEY=your_chainalysis_api_key

COLUMN_API_KEY=your_column_api_key
MARQETA_API_KEY=your_marqeta_api_key

# Blockchain Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/your_project_id
BSC_RPC_URL=https://bsc-dataseed.binance.org/
PRIVATE_KEY=your_deployment_private_key

# Monitoring
GRAFANA_ADMIN_PASSWORD=admin123

# Security
ALLOWED_ORIGINS=http://localhost:3005,https://your-domain.com

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EOF

    log "Environment file created. Please update the API keys with your actual values."
    warn "Make sure to update the placeholder API keys in the .env file!"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install root dependencies
    if [ -f "package.json" ]; then
        npm install
    fi
    
    # Install service dependencies
    for service in services/*/; do
        if [ -f "${service}package.json" ]; then
            log "Installing dependencies for $(basename "$service")"
            (cd "$service" && npm install)
        fi
    done
    
    # Install frontend dependencies
    if [ -f "frontend/package.json" ]; then
        log "Installing frontend dependencies"
        (cd frontend && npm install)
    fi
    
    # Install smart contract dependencies
    if [ -f "smart-contracts/package.json" ]; then
        log "Installing smart contract dependencies"
        (cd smart-contracts && npm install)
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 30
    
    # Run migrations for each service
    for service in services/*/; do
        if [ -f "${service}src/migrations/migrate.js" ]; then
            log "Running migrations for $(basename "$service")"
            docker-compose exec -T $(basename "$service") node src/migrations/migrate.js || warn "Migration failed for $(basename "$service")"
        fi
    done
}

# Deploy smart contracts
deploy_contracts() {
    log "Deploying smart contracts..."
    
    if [ -d "smart-contracts" ]; then
        (cd smart-contracts && npm run deploy) || warn "Smart contract deployment failed"
    fi
}

# Build and start services
build_and_start() {
    log "Building and starting services..."
    
    # Build all services
    docker-compose build --parallel
    
    # Start infrastructure services first
    log "Starting infrastructure services..."
    docker-compose up -d postgres mongodb redis
    
    # Wait for databases to be ready
    log "Waiting for databases to initialize..."
    sleep 60
    
    # Start application services
    log "Starting application services..."
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
}

# Health check
health_check() {
    log "Performing health checks..."
    
    local services=("api-gateway:3000" "user-service:3001" "wallet-service:3002" "payment-service:3003" "card-service:3004")
    
    for service in "${services[@]}"; do
        local name=$(echo "$service" | cut -d':' -f1)
        local port=$(echo "$service" | cut -d':' -f2)
        
        if curl -f "http://localhost:${port}/health" &>/dev/null; then
            log "✓ ${name} is healthy"
        else
            warn "✗ ${name} health check failed"
        fi
    done
    
    # Check frontend
    if curl -f "http://localhost:3005" &>/dev/null; then
        log "✓ Frontend is accessible"
    else
        warn "✗ Frontend is not accessible"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create Grafana dashboards directory
    mkdir -p monitoring/grafana/dashboards
    
    # Start monitoring services
    docker-compose up -d prometheus grafana
    
    log "Monitoring setup complete"
    log "Prometheus: http://localhost:9090"
    log "Grafana: http://localhost:3006 (admin/admin)"
}

# Main deployment function
deploy() {
    log "Starting CryptoHybrid Bank deployment..."
    
    check_docker
    check_node
    create_directories
    generate_env_files
    install_dependencies
    build_and_start
    run_migrations
    deploy_contracts
    health_check
    setup_monitoring
    
    log "Deployment completed successfully!"
    log ""
    log "Access your application at:"
    log "  Frontend: http://localhost:3005"
    log "  API Gateway: http://localhost:3000"
    log "  API Documentation: http://localhost:3000/api/docs"
    log "  Prometheus: http://localhost:9090"
    log "  Grafana: http://localhost:3006"
    log ""
    log "Next steps:"
    log "1. Update API keys in the .env file"
    log "2. Configure your domain and SSL certificates"
    log "3. Set up backup procedures"
    log "4. Configure monitoring alerts"
}

# Cleanup function
cleanup() {
    log "Stopping and removing all containers..."
    docker-compose down -v
    docker system prune -f
    log "Cleanup completed"
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy    - Deploy the complete application (default)"
    echo "  cleanup   - Stop and remove all containers"
    echo "  health    - Run health checks"
    echo "  logs      - Show logs from all services"
    echo "  restart   - Restart all services"
    echo ""
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    cleanup)
        cleanup
        ;;
    health)
        health_check
        ;;
    logs)
        docker-compose logs -f
        ;;
    restart)
        docker-compose restart
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        error "Unknown command: $1"
        usage
        ;;
esac
