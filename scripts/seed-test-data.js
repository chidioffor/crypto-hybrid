#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const bcrypt = require(path.join(projectRoot, 'services/user-service/node_modules/bcryptjs'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL must be defined to seed test data.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seed() {
  const password = 'P@ssw0rd!';
  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const defaultAssets = [
      { symbol: 'USD', name: 'US Dollar', type: 'fiat', decimals: 2 },
      { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', decimals: 8 }
    ];

    for (const asset of defaultAssets) {
      await client.query(
        `INSERT INTO assets (symbol, name, type, decimals, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())
         ON CONFLICT (symbol) DO UPDATE SET updated_at = NOW()`
        , [asset.symbol, asset.name, asset.type, asset.decimals]
      );
    }

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, country_code, kyc_status, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id, email`,
      ['test.user@example.com', passwordHash, 'Test', 'User', 'US']
    );

    const userId = userResult.rows[0].id;

    const walletResult = await client.query(
      `INSERT INTO wallets (user_id, wallet_type, wallet_address, chain_id, encrypted_private_key, encrypted_seed_phrase, seed_phrase_hash, is_active, created_at, updated_at, encryption_version)
       VALUES ($1, 'custodial', $2, $3, $4, $5, $6, true, NOW(), NOW(), 1)
       ON CONFLICT (user_id, wallet_address, chain_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
       RETURNING id`,
      [
        userId,
        `demo-${userId}-primary`,
        1337,
        JSON.stringify({ mock: true }),
        JSON.stringify({ mock: true }),
        await bcrypt.hash('demo-seed-phrase', 10)
      ]
    );

    const walletId = walletResult.rows[0]?.id;

    if (!walletId) {
      throw new Error('Failed to ensure wallet record for seed user.');
    }

    const assetRows = await client.query('SELECT id, symbol FROM assets WHERE symbol IN ($1, $2) LIMIT 2', ['USD', 'BTC']);

    for (const asset of assetRows.rows) {
      await client.query(
        `INSERT INTO balances (user_id, wallet_id, asset_id, balance, locked_balance, updated_at)
         VALUES ($1, $2, $3, $4, 0, NOW())
         ON CONFLICT (user_id, wallet_id, asset_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = NOW()`
        , [
          userId,
          walletId,
          asset.id,
          asset.symbol === 'USD' ? 10000 : 2
        ]
      );
    }

    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, from_wallet_id, amount, status, created_at, risk_score, metadata)
       VALUES ($1, 'seed', $2, 100, 'completed', NOW(), 10, $3)
       ON CONFLICT DO NOTHING`,
      [userId, walletId, JSON.stringify({ seeded: true })]
    );

    await client.query('COMMIT');

    console.log('\nSeed complete!');
    console.log('Test credentials:');
    console.log('  Email   : test.user@example.com');
    console.log(`  Password: ${password}`);
    console.log(`  Wallet ID: ${walletId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed test data:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
