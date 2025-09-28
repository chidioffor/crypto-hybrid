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

requireEnv(['DATABASE_URL', 'JWT_SECRET']);

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  isProduction: env === 'production',
  port: parseNumber(process.env.PORT, 3002),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || DEFAULT_REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
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
  blockchain: {
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL,
    polygonRpcUrl: process.env.POLYGON_RPC_URL,
    bscRpcUrl: process.env.BSC_RPC_URL,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
