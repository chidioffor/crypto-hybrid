# CryptoHybrid Bank

A comprehensive hybrid crypto-fiat banking web application that combines traditional banking with blockchain features to provide seamless management of fiat and crypto assets.

## 🚀 Features

### Core Banking Services
- **Digital Accounts**: Multi-asset wallets with custodial and non-custodial options
- **Virtual IBAN**: European banking integration with SEPA/SWIFT support
- **Crypto Payment Cards**: Physical and virtual Visa/Mastercard with real-time crypto conversion
- **Cross-border Payments**: P2P transfers via wallet address/QR code with stablecoin support

### Advanced Financial Products
- **Crypto Loans**: DeFi lending with crypto collateral and dynamic LTV ratios
- **Investment Platform**: Staking, yield farming, and robo-advisory services
- **Smart Contract Escrow**: B2B transaction security with milestone-based releases
- **Letters of Credit**: Trade finance instruments with blockchain verification
- **Asset Tokenization**: Real-world asset tokenization (real estate, precious metals, etc.)

### Governance & Compliance
- **DAO Governance**: Decentralized decision making with governance tokens
- **KYC/AML Integration**: Automated compliance with Plaid, Persona, and Alloy
- **KYT Monitoring**: Real-time transaction monitoring with Chainalysis and Elliptic
- **Regulatory Compliance**: GDPR, PCI DSS, and banking regulation compliance

## 🏗️ Architecture

### Microservices Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   User Service  │
│   (React)       │◄──►│   (Express)     │◄──►│   (Node.js)     │
│   Port 3005     │    │   Port 3000     │    │   Port 3001     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌────────┼────────┐
                       │        │        │
              ┌─────────▼──┐ ┌──▼─────┐ ┌▼──────────┐
              │ Wallet     │ │Payment │ │Card       │
              │ Service    │ │Service │ │Service    │
              │ Port 3002  │ │Port 3003│ │Port 3004  │
              └────────────┘ └────────┘ └───────────┘
```

### Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Express.js, PostgreSQL, MongoDB, Redis
- **Blockchain**: Solidity, Hardhat, Ethereum, Polygon, BSC
- **Infrastructure**: Docker, Kubernetes, Prometheus, Grafana
- **Security**: JWT, bcrypt, Helmet, Rate limiting, CORS

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm
- Git

### Option 1: Automated Deployment (Recommended)

#### For Windows:
```bash
git clone https://github.com/your-repo/cryptohybrid-bank.git
cd cryptohybrid-bank
scripts\deploy.bat
```

#### For Linux/macOS:
```bash
git clone https://github.com/your-repo/cryptohybrid-bank.git
cd cryptohybrid-bank
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Option 2: Manual Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-repo/cryptohybrid-bank.git
cd cryptohybrid-bank
```

2. **Create environment file**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Install dependencies**
```bash
npm install
```

4. **Start infrastructure services**
```bash
docker-compose up -d postgres mongodb redis
```

5. **Start application services**
```bash
docker-compose up -d
```

6. **Run database migrations**
```bash
# Wait for databases to be ready, then run migrations
docker-compose exec user-service node src/migrations/migrate.js
docker-compose exec wallet-service node src/migrations/migrate.js
docker-compose exec payment-service node src/migrations/migrate.js
docker-compose exec card-service node src/migrations/migrate.js
```

## 🌐 Access Points

After successful deployment, access the application at:

- **Frontend Application**: http://localhost:3005
- **API Gateway**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **Prometheus Monitoring**: http://localhost:9090
- **Grafana Dashboard**: http://localhost:3006 (admin/admin)

## 📊 Services Overview

| Service | Port | Description | Technology |
|---------|------|-------------|------------|
| Frontend | 3005 | React web application | React, TypeScript, Tailwind |
| API Gateway | 3000 | Request routing & authentication | Express.js, JWT |
| User Service | 3001 | User management & KYC | Node.js, PostgreSQL |
| Wallet Service | 3002 | Crypto wallet management | Node.js, Blockchain APIs |
| Payment Service | 3003 | Transaction processing | Node.js, External APIs |
| Card Service | 3004 | Payment card management | Node.js, Card Providers |
| PostgreSQL | 5432 | Primary database | PostgreSQL 15 |
| MongoDB | 27017 | Document storage | MongoDB 7 |
| Redis | 6379 | Caching & sessions | Redis 7 |
| Prometheus | 9090 | Metrics collection | Prometheus |
| Grafana | 3006 | Monitoring dashboard | Grafana |

## 🔧 Configuration

### Environment Variables

Key environment variables to configure:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password
MONGODB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_super_secret_jwt_key

# External APIs
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
FIREBLOCKS_API_KEY=your_fireblocks_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
CHAINALYSIS_API_KEY=your_chainalysis_api_key

# Blockchain
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/your_project_id
PRIVATE_KEY=your_deployment_private_key
```

### Third-Party Integrations

The application integrates with numerous third-party services:

- **KYC/Identity**: Plaid Identity, Persona, Alloy
- **Payments**: Stripe, OpenPayd, Rapyd, FinLego
- **Cards**: Column API, Marqeta API
- **Crypto**: Fireblocks, Coinbase, Binance API
- **Compliance**: Chainalysis, Elliptic
- **DeFi**: Aave, Compound, Chainlink, Lido

## 🛠️ Development

### Running in Development Mode

```bash
# Start infrastructure
docker-compose up -d postgres mongodb redis

# Start services in development mode
npm run dev:user-service
npm run dev:wallet-service
npm run dev:payment-service
npm run dev:card-service
npm run dev:api-gateway

# Start frontend
cd frontend && npm start
```

### Testing

```bash
# Run all tests
npm test

# Run specific service tests
npm run test:user-service
npm run test:wallet-service

# Run smart contract tests
cd smart-contracts && npm test
```

### Smart Contract Development

```bash
cd smart-contracts

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local network
npm run deploy

# Deploy to testnet
npm run deploy:sepolia
```

## 🔒 Security Features

- **Multi-layer Authentication**: JWT tokens with refresh mechanism
- **Rate Limiting**: API endpoint protection against abuse
- **Data Encryption**: End-to-end encryption for sensitive data
- **Multi-signature Wallets**: Enhanced security for crypto assets
- **KYT Monitoring**: Real-time transaction risk assessment
- **Compliance Automation**: Automated AML/KYC checks
- **Security Headers**: Helmet.js for HTTP security
- **Input Validation**: Comprehensive request validation

## 📈 Monitoring & Observability

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visual monitoring dashboards
- **Winston**: Structured logging across services
- **Health Checks**: Automated service health monitoring
- **Performance Metrics**: Response time and throughput tracking

## 🚀 Deployment Options

### Development
- Local Docker Compose setup
- Hot reloading for rapid development

### Staging/Production
- Kubernetes deployment with Helm charts
- Infrastructure as Code with Terraform
- CI/CD pipeline with GitHub Actions
- Auto-scaling and load balancing
- SSL/TLS termination
- Database backup and recovery

## 📚 API Documentation

Complete API documentation is available at:
- **Interactive Docs**: http://localhost:3000/api/docs
- **OpenAPI Spec**: Available in `/docs` directory

### Key API Endpoints

```bash
# Authentication
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh

# User Management
GET /api/users/profile
PUT /api/users/profile
POST /api/users/kyc

# Wallet Operations
GET /api/wallets
POST /api/wallets
GET /api/wallets/:id/balances

# Payments
POST /api/payments/send
POST /api/payments/swap
GET /api/payments/transactions

# Cards
GET /api/cards
POST /api/cards/apply
PUT /api/cards/:id/controls
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` directory
- Review the API documentation at http://localhost:3000/api/docs

## 🚨 Security Considerations

**Important**: This is a comprehensive banking application handling sensitive financial data. Before deploying to production:

1. **Update all default passwords and secrets**
2. **Configure proper SSL/TLS certificates**
3. **Set up proper firewall rules**
4. **Enable database encryption at rest**
5. **Configure backup and disaster recovery**
6. **Implement proper monitoring and alerting**
7. **Conduct security audits and penetration testing**
8. **Ensure compliance with financial regulations**

## 🏦 Regulatory Compliance

This application implements features to support compliance with:
- **KYC/AML**: Customer identification and anti-money laundering
- **GDPR**: Data protection and privacy rights
- **PCI DSS**: Payment card industry security standards
- **SOX**: Financial reporting and audit requirements
- **Banking Regulations**: Various jurisdictional banking laws

**Note**: Compliance implementation may require additional configuration and third-party service setup based on your jurisdiction and requirements.