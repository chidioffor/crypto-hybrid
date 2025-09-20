const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  {
    name: 'create_cards_table',
    sql: `
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_number_hash VARCHAR(255) NOT NULL,
        card_type VARCHAR(20) NOT NULL,
        card_network VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        daily_limit DECIMAL(15,2),
        monthly_limit DECIMAL(15,2),
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
      CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
      CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type);
    `
  },
  {
    name: 'create_card_controls_table',
    sql: `
      CREATE TABLE IF NOT EXISTS card_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        merchant_categories TEXT[],
        geographic_restrictions TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(card_id)
      );

      CREATE INDEX IF NOT EXISTS idx_card_controls_card_id ON card_controls(card_id);
    `
  },
  {
    name: 'create_card_transactions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS card_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        merchant VARCHAR(255),
        category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON card_transactions(card_id);
      CREATE INDEX IF NOT EXISTS idx_card_transactions_status ON card_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_card_transactions_created_at ON card_transactions(created_at);
    `
  }
];

async function runMigrations() {
  try {
    console.log('Starting card service database migrations...');

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

    console.log('All card service migrations completed successfully!');
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
