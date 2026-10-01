require('dotenv').config({ quiet: process.env.NODE_ENV === 'test' });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
const trustProxyValue = process.env.TRUST_PROXY?.trim();
if (trustProxyValue && !/^\d+$/.test(trustProxyValue)) {
  throw new Error('TRUST_PROXY must be a non-negative proxy hop count');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieExpiresDays: Number(process.env.COOKIE_EXPIRES_DAYS) || 7,
  },
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  clientOrigin: new URL(process.env.CLIENT_URL || 'http://localhost:5173').origin,
  trustProxy: trustProxyValue ? Number(trustProxyValue) : false,
};
