const AppError = require('../utils/AppError');
const env = require('../config/env');

function notFound(req, res, next) {
  next(new AppError('Route not found.', 404));
}

// Convert known library errors into AppErrors with safe messages.
function normalize(err) {
  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}.`, 400);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new AppError(`Duplicate value for ${field}`, 409);
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new AppError('Validation failed', 400, errors);
  }
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token. Please log in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('Your session has expired. Please log in again.', 401);
  }
  if (err.type === 'entity.too.large') {
    return new AppError('Request body too large', 413);
  }
  if (err.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON body', 400);
  }
  return err;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const error = err.isOperational ? err : normalize(err);

  if (error.isOperational) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors && { errors: error.errors }),
    });
  }

  // Unknown error: log it, never leak internals in production.
  console.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong',
    ...(!env.isProd && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
