-- CryptoHybrid Bank Database Schema
-- This file initializes the complete database schema for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (Core user information)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    country_code VARCHAR(2),
    kyc_status VARCHAR(50) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected', 'requires_verification')),
    kyc_level INTEGER DEFAULT 0 CHECK (kyc_level BETWEEN 0 AND 3),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets table (Supported cryptocurrencies and fiat currencies)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'fiat')),
    decimals INTEGER NOT NULL DEFAULT 18,
    contract_address VARCHAR(255),
    chain_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    price_usd DECIMAL(20, 8),
    market_cap DECIMAL(30, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table (User wallets for different assets)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('custodial', 'non-custodial')),
    chain_id INTEGER,
    encrypted_private_key TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, address, chain_id)
);

-- Balances table (User asset balances)
CREATE TABLE IF NOT EXISTS balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    amount DECIMAL(30, 18) DEFAULT 0,
    locked_amount DECIMAL(30, 18) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, asset_id)
);

-- Virtual IBANs table (Virtual bank accounts)
CREATE TABLE IF NOT EXISTS virtual_ibans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    iban VARCHAR(34) UNIQUE NOT NULL,
    bic VARCHAR(11) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    provider VARCHAR(100),
    provider_account_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table (All transaction records)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_wallet_id UUID REFERENCES wallets(id),
    to_wallet_id UUID REFERENCES wallets(id),
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    asset_id UUID NOT NULL REFERENCES assets(id),
    amount DECIMAL(30, 18) NOT NULL,
    fee DECIMAL(30, 18) DEFAULT 0,
    type VARCHAR(50) NOT NULL CHECK (type IN ('send', 'receive', 'swap', 'deposit', 'withdrawal', 'stake', 'unstake')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
    tx_hash VARCHAR(255),
    block_number BIGINT,
    confirmations INTEGER DEFAULT 0,
    memo TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cards table (Crypto payment cards)
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_number VARCHAR(19) UNIQUE NOT NULL,
    cardholder_name VARCHAR(255) NOT NULL,
    expiry_month INTEGER NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year INTEGER NOT NULL,
    cvv VARCHAR(4) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('virtual', 'physical')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked', 'expired')),
    spending_limit DECIMAL(15, 2) DEFAULT 10000,
    daily_limit DECIMAL(15, 2) DEFAULT 1000,
    monthly_limit DECIMAL(15, 2) DEFAULT 10000,
    linked_wallet_id UUID REFERENCES wallets(id),
    provider VARCHAR(100),
    provider_card_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loans table (Crypto-collateralized loans)
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    collateral_asset_id UUID NOT NULL REFERENCES assets(id),
    collateral_amount DECIMAL(30, 18) NOT NULL,
    collateral_value DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 4) NOT NULL,
    term_months INTEGER NOT NULL,
    ltv_ratio DECIMAL(5, 4) NOT NULL,
    liquidation_threshold DECIMAL(5, 4) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'liquidated', 'defaulted')),
    start_date DATE,
    end_date DATE,
    monthly_payment DECIMAL(15, 2),
    total_paid DECIMAL(15, 2) DEFAULT 0,
    smart_contract_address VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investments table (Staking, yield farming, etc.)
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('staking', 'yield_farming', 'liquidity_pool', 'robo_advisory')),
    asset_id UUID NOT NULL REFERENCES assets(id),
    amount DECIMAL(30, 18) NOT NULL,
    apy DECIMAL(8, 4) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE,
    rewards_earned DECIMAL(30, 18) DEFAULT 0,
    protocol VARCHAR(100),
    pool_id VARCHAR(255),
    smart_contract_address VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrows table (Smart contract escrow services)
CREATE TABLE IF NOT EXISTS escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id),
    amount DECIMAL(30, 18) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'disputed')),
    conditions TEXT[] NOT NULL,
    smart_contract_address VARCHAR(255),
    release_conditions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Letters of Credit table (Trade finance instruments)
CREATE TABLE IF NOT EXISTS letters_of_credit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'accepted', 'completed', 'cancelled')),
    conditions TEXT[] NOT NULL,
    expiry_date DATE NOT NULL,
    smart_contract_address VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokenized Assets table (Asset tokenization)
CREATE TABLE IF NOT EXISTS tokenized_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    description TEXT,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('real_estate', 'precious_metals', 'art', 'collectibles', 'securities', 'other')),
    total_supply DECIMAL(30, 18) NOT NULL,
    price_per_token DECIMAL(15, 2) NOT NULL,
    total_value DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'cancelled')),
    smart_contract_address VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Governance Proposals table (DAO governance)
CREATE TABLE IF NOT EXISTS governance_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('fee_update', 'feature_addition', 'governance_change', 'parameter_change', 'other')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'passed', 'rejected', 'executed')),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    votes_for DECIMAL(30, 18) DEFAULT 0,
    votes_against DECIMAL(30, 18) DEFAULT 0,
    votes_abstain DECIMAL(30, 18) DEFAULT 0,
    quorum DECIMAL(30, 18) NOT NULL,
    threshold DECIMAL(5, 4) NOT NULL,
    smart_contract_address VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('bank_account', 'card', 'crypto_wallet')),
    name VARCHAR(255) NOT NULL,
    details JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Swaps table
CREATE TABLE IF NOT EXISTS swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_asset_id UUID NOT NULL REFERENCES assets(id),
    to_asset_id UUID NOT NULL REFERENCES assets(id),
    from_amount DECIMAL(30, 18) NOT NULL,
    to_amount DECIMAL(30, 18) NOT NULL,
    exchange_rate DECIMAL(30, 18) NOT NULL,
    slippage_tolerance DECIMAL(5, 4) NOT NULL,
    price_impact DECIMAL(5, 4),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    provider VARCHAR(100),
    provider_tx_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_balances_wallet_id ON balances(wallet_id);
CREATE INDEX IF NOT EXISTS idx_balances_asset_id ON balances(asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(type);
CREATE INDEX IF NOT EXISTS idx_escrows_creator_id ON escrows(creator_id);
CREATE INDEX IF NOT EXISTS idx_escrows_beneficiary_id ON escrows(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_letters_of_credit_issuer_id ON letters_of_credit(issuer_id);
CREATE INDEX IF NOT EXISTS idx_letters_of_credit_beneficiary_id ON letters_of_credit(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_owner_id ON tokenized_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_proposer_id ON governance_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_swaps_user_id ON swaps(user_id);

-- Insert default assets
INSERT INTO assets (symbol, name, type, decimals) VALUES 
    ('USD', 'US Dollar', 'fiat', 2),
    ('EUR', 'Euro', 'fiat', 2),
    ('GBP', 'British Pound', 'fiat', 2),
    ('BTC', 'Bitcoin', 'crypto', 8),
    ('ETH', 'Ethereum', 'crypto', 18),
    ('USDT', 'Tether USD', 'crypto', 6),
    ('USDC', 'USD Coin', 'crypto', 6),
    ('BNB', 'Binance Coin', 'crypto', 18),
    ('MATIC', 'Polygon', 'crypto', 18),
    ('LINK', 'Chainlink', 'crypto', 18)
ON CONFLICT (symbol) DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrows_updated_at BEFORE UPDATE ON escrows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_letters_of_credit_updated_at BEFORE UPDATE ON letters_of_credit FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tokenized_assets_updated_at BEFORE UPDATE ON tokenized_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_governance_proposals_updated_at BEFORE UPDATE ON governance_proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_swaps_updated_at BEFORE UPDATE ON swaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
