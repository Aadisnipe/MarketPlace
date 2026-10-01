const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const env = require('../config/env');

const protect = catchAsync(async (req, _res, next) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.token || bearer;
  if (!token) return next(new AppError('You are not logged in. Please log in to get access.', 401));

  const payload = jwt.verify(token, env.jwt.secret);
  const user = await User.findById(payload.sub).select('+passwordChangedAt');
  if (!user) return next(new AppError('The account for this session no longer exists.', 401));
  if (user.status !== 'active') return next(new AppError('This account is suspended.', 403));
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return next(new AppError('Your password has changed. Please log in again.', 401));
  }

  req.user = user;
  return next();
});

const restrictTo = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  return next();
};

module.exports = { protect, restrictTo };
