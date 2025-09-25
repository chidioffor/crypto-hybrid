#!/usr/bin/env node
/*
 * Orchestrates database migrations across the monorepo so services share a single schema.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL must be set to run migrations.');
  process.exit(1);
}

const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

const pool = new Pool({ connectionString, ssl });

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function hasExecuted(name) {
  const result = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
  return result.rowCount > 0;
}

async function recordExecution(name) {
  await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
}

async function runGlobalSchema() {
  const schemaName = '001_global_schema';
  if (await hasExecuted(schemaName)) {
    console.log('• Global schema already applied');
    return;
  }

  console.log('▶ Applying global schema...');
  const schemaPath = path.join(projectRoot, 'database', 'init.sql');
  await runSqlFile(schemaPath);
  await recordExecution(schemaName);
  console.log('✓ Global schema applied');
}

async function runServiceMigrations() {
  const migrations = [
    {
      name: 'user-service',
      run: async () => {
        const { runMigrations } = require('../services/user-service/src/migrations/migrate');
        await runMigrations();
      },
    },
    {
      name: 'wallet-service',
      run: async () => {
        const { runMigrations } = require('../services/wallet-service/src/migrations/migrate');
        await runMigrations();
      },
    },
    {
      name: 'payment-service',
      run: async () => {
        const migrate = require('../services/payment-service/src/migrations/migrate');
        if (typeof migrate.runMigrations === 'function') {
          await migrate.runMigrations();
        } else if (typeof migrate === 'function') {
          await migrate();
        }
      },
    },
    {
      name: 'card-service',
      run: async () => {
        const { runMigrations } = require('../services/card-service/src/migrations/migrate');
        await runMigrations();
      },
    },
  ];

  for (const migration of migrations) {
    const label = `service:${migration.name}`;
    if (await hasExecuted(label)) {
      console.log(`• ${migration.name} migrations already executed`);
      continue;
    }

    console.log(`▶ Running ${migration.name} migrations...`);
    await migration.run();
    await recordExecution(label);
    console.log(`✓ ${migration.name} migrations complete`);
  }
}

(async () => {
  try {
    await ensureMigrationsTable();
    await runGlobalSchema();
    await runServiceMigrations();
    console.log('All migrations executed successfully');
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
