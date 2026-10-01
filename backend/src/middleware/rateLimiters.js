const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// Applied to the whole API.
const apiLimiter = make(15 * 60 * 1000, 300, 'Too many requests, please try again later');

// Stricter limiter for login/register (used in Phase 3).
const authLimiter = make(15 * 60 * 1000, 20, 'Too many attempts, please try again in 15 minutes');

module.exports = { apiLimiter, authLimiter };
