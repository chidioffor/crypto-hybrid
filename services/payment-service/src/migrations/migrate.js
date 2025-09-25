const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const migrations = [
  {
    name: 'ensure_payment_tables',
    sql: `
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

      CREATE TABLE IF NOT EXISTS swaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        to_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
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

      CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
      CREATE INDEX IF NOT EXISTS idx_swaps_user_id ON swaps(user_id);
      CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
    `,
  },
  {
    name: 'create_payment_events_table',
    sql: `
      CREATE TABLE IF NOT EXISTS payment_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        provider VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payment_events_transaction_id ON payment_events(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_payment_events_provider ON payment_events(provider);
    `,
  },
];

async function runMigrations() {
  try {
    console.log('Starting payment service migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const executed = await pool.query('SELECT name FROM migrations');
    const executedNames = executed.rows.map((row) => row.name);

    for (const migration of migrations) {
      if (executedNames.includes(migration.name)) {
        console.log(`- Migration ${migration.name} already applied`);
        continue;
      }

      console.log(`Running migration: ${migration.name}`);
      await pool.query('BEGIN');
      try {
        await pool.query(migration.sql);
        await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        await pool.query('COMMIT');
        console.log(`✓ Migration ${migration.name} completed`);
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Payment service migrations completed successfully');
  } catch (error) {
    console.error('Payment service migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
