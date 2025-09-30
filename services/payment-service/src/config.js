require('dotenv').config();
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requireEnv = (keys) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

requireEnv(['DATABASE_URL', 'JWT_SECRET', 'STRIPE_SECRET_KEY']);

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  isProduction: env === 'production',
  port: parseNumber(process.env.PORT, 3003),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || DEFAULT_REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeApiVersion: process.env.STRIPE_API_VERSION,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  db: {
    maxConnections: parseNumber(process.env.DB_MAX_CONNECTIONS, 10),
    idleTimeoutMs: parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  },
  redis: {
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'payment-service',
    brokers: (process.env.KAFKA_BROKERS || '').split(',').map((broker) => broker.trim()).filter(Boolean),
    fallbackBroker: process.env.KAFKA_BROKER || 'localhost:9092',
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD
      ? {
          mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD,
        }
      : undefined,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
