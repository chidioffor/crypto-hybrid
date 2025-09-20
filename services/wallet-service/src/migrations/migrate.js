const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  {
    name: 'create_wallets_table',
    sql: `
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_type VARCHAR(20) NOT NULL,
        wallet_address VARCHAR(255),
        encrypted_private_key TEXT,
        seed_phrase_hash VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_wallets_type ON wallets(wallet_type);
    `
  },
  {
    name: 'create_assets_table',
    sql: `
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        asset_type VARCHAR(20) NOT NULL,
        blockchain VARCHAR(50),
        contract_address VARCHAR(255),
        decimals INTEGER DEFAULT 18,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
      CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
      CREATE INDEX IF NOT EXISTS idx_assets_blockchain ON assets(blockchain);

      -- Insert default assets
      INSERT INTO assets (symbol, name, asset_type, blockchain, decimals) VALUES
      ('ETH', 'Ethereum', 'crypto', 'ethereum', 18),
      ('BTC', 'Bitcoin', 'crypto', 'bitcoin', 8),
      ('USDC', 'USD Coin', 'crypto', 'ethereum', 6),
      ('USDT', 'Tether', 'crypto', 'ethereum', 6),
      ('MATIC', 'Polygon', 'crypto', 'polygon', 18),
      ('BNB', 'Binance Coin', 'crypto', 'bsc', 18),
      ('USD', 'US Dollar', 'fiat', 'fiat', 2),
      ('EUR', 'Euro', 'fiat', 'fiat', 2)
      ON CONFLICT (symbol) DO NOTHING;
    `
  },
  {
    name: 'create_balances_table',
    sql: `
      CREATE TABLE IF NOT EXISTS balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        balance DECIMAL(36,18) NOT NULL DEFAULT 0,
        locked_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, wallet_id, asset_id)
      );

      CREATE INDEX IF NOT EXISTS idx_balances_user_id ON balances(user_id);
      CREATE INDEX IF NOT EXISTS idx_balances_asset_id ON balances(asset_id);
      CREATE INDEX IF NOT EXISTS idx_balances_wallet_id ON balances(wallet_id);
    `
  },
  {
    name: 'create_transactions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_type VARCHAR(20) NOT NULL,
        from_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
        to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
        from_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        to_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        amount DECIMAL(36,18) NOT NULL,
        fee DECIMAL(36,18) DEFAULT 0,
        exchange_rate DECIMAL(36,18),
        blockchain_tx_hash VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        risk_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(blockchain_tx_hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    `
  },
  {
    name: 'create_virtual_ibans_table',
    sql: `
      CREATE TABLE IF NOT EXISTS virtual_ibans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        iban VARCHAR(34) UNIQUE NOT NULL,
        bank_code VARCHAR(20),
        account_number VARCHAR(50),
        currency VARCHAR(3) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_virtual_ibans_user_id ON virtual_ibans(user_id);
      CREATE INDEX IF NOT EXISTS idx_virtual_ibans_iban ON virtual_ibans(iban);
      CREATE INDEX IF NOT EXISTS idx_virtual_ibans_currency ON virtual_ibans(currency);
    `
  }
];

async function runMigrations() {
  try {
    console.log('Starting wallet service database migrations...');

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get executed migrations
    const executedMigrations = await pool.query('SELECT name FROM migrations');
    const executedNames = executedMigrations.rows.map(row => row.name);

    // Run pending migrations
    for (const migration of migrations) {
      if (!executedNames.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        
        await pool.query('BEGIN');
        try {
          await pool.query(migration.sql);
          await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
          await pool.query('COMMIT');
          console.log(`✓ Migration ${migration.name} completed successfully`);
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`- Migration ${migration.name} already executed`);
      }
    }

    console.log('All wallet service migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
