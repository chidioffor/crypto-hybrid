const { Client } = require('pg');

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'cryptohybrid_bank',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        from_wallet_id UUID,
        to_wallet_id UUID,
        from_address VARCHAR(255),
        to_address VARCHAR(255),
        asset_id UUID NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        fee DECIMAL(20, 8) DEFAULT 0,
        type VARCHAR(50) NOT NULL CHECK (type IN ('send', 'receive', 'swap', 'deposit', 'withdrawal')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
        tx_hash VARCHAR(255),
        block_number BIGINT,
        confirmations INTEGER DEFAULT 0,
        memo TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create payment_methods table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('bank_account', 'card', 'crypto_wallet')),
        name VARCHAR(255) NOT NULL,
        details JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create swaps table
    await client.query(`
      CREATE TABLE IF NOT EXISTS swaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        from_asset_id UUID NOT NULL,
        to_asset_id UUID NOT NULL,
        from_amount DECIMAL(20, 8) NOT NULL,
        to_amount DECIMAL(20, 8) NOT NULL,
        exchange_rate DECIMAL(20, 8) NOT NULL,
        slippage_tolerance DECIMAL(5, 4) NOT NULL,
        price_impact DECIMAL(5, 4),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
        provider VARCHAR(100),
        provider_tx_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
      CREATE INDEX IF NOT EXISTS idx_swaps_user_id ON swaps(user_id);
      CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
    `);

    console.log('Payment service migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
