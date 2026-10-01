const AppError = require('../utils/AppError');
const env = require('../config/env');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = function csrfProtection(req, _res, next) {
  if (safeMethods.has(req.method) || !req.cookies?.token) return next();

  const source = req.get('origin') || req.get('referer');
  let requestOrigin;
  try {
    requestOrigin = source ? new URL(source).origin : null;
  } catch {
    requestOrigin = null;
  }

  if (requestOrigin !== env.clientOrigin) {
    return next(new AppError('Request origin is not allowed.', 403));
  }
  return next();
};
