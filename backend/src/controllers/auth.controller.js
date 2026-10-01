const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const env = require('../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  path: '/api',
};

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
  };
}

function issueSession(user, res) {
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  res.cookie('token', token, {
    ...COOKIE_OPTIONS,
    maxAge: env.jwt.cookieExpiresDays * 24 * 60 * 60 * 1000,
  });
}

function validateCredentials({ name, email, password }) {
  const errors = [];
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    errors.push({ field: 'name', message: 'Name must be between 2 and 80 characters.' });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters and no more than 72 bytes.' });
  }
  return errors;
}

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role = 'buyer' } = req.body || {};
  const errors = validateCredentials({ name, email, password });
  if (!['buyer', 'seller'].includes(role)) errors.push({ field: 'role', message: 'Role must be buyer or seller.' });
  if (errors.length) return next(new AppError('Please correct the highlighted fields.', 400, errors));

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role });
  issueSession(user, res);
  return sendSuccess(res, { statusCode: 201, message: 'Account created.', data: { user: publicUser(user) } });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return next(new AppError('Email and password are required.', 400));
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return next(new AppError('Incorrect email or password.', 401));
  if (user.status !== 'active') return next(new AppError('This account is suspended.', 403));

  issueSession(user, res);
  return sendSuccess(res, { message: 'Logged in.', data: { user: publicUser(user) } });
});

exports.logout = (_req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  return sendSuccess(res, { message: 'Logged out.' });
};

exports.me = (req, res) => sendSuccess(res, { data: { user: publicUser(req.user) } });

exports.publicUser = publicUser;
