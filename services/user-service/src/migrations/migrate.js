const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  {
    name: 'create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE,
        country_code VARCHAR(3) NOT NULL,
        kyc_status VARCHAR(20) DEFAULT 'pending',
        kyc_level INTEGER DEFAULT 1,
        risk_score DECIMAL(5,2) DEFAULT 0.0,
        is_active BOOLEAN DEFAULT true,
        mfa_enabled BOOLEAN DEFAULT false,
        mfa_secret VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
      CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_code);
    `
  },
  {
    name: 'create_kyc_documents_table',
    sql: `
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        document_url VARCHAR(500) NOT NULL,
        document_hash VARCHAR(255) NOT NULL,
        verification_status VARCHAR(20) DEFAULT 'pending',
        verification_provider VARCHAR(50),
        verification_id VARCHAR(255),
        confidence_score DECIMAL(5,2),
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
      CREATE INDEX IF NOT EXISTS idx_kyc_documents_type ON kyc_documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(verification_status);
    `
  },
  {
    name: 'create_user_sessions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(500) NOT NULL,
        refresh_token VARCHAR(500),
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    `
  },
  {
    name: 'create_audit_logs_table',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        metadata JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `
  }
];

async function runMigrations() {
  try {
    console.log('Starting database migrations...');

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

    console.log('All migrations completed successfully!');
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
