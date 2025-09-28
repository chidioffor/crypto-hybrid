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

requireEnv(['JWT_SECRET']);

const env = process.env.NODE_ENV || 'development';

const toOrigins = (value) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

module.exports = {
  env,
  isProduction: env === 'production',
  port: parseNumber(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET,
  corsOrigins: toOrigins(process.env.CORS_ORIGINS),
  services: {
    user: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    wallet: process.env.WALLET_SERVICE_URL || 'http://wallet-service:3002',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003',
    card: process.env.CARD_SERVICE_URL || 'http://card-service:3004',
  },
  rateLimit: {
    windowMinutes: parseNumber(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
    maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
