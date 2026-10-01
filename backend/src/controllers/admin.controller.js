const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const { expireCheckoutSession } = require('../services/payment/stripe');
const pagination = require('../utils/pagination');

const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

exports.overview = catchAsync(async (_req, res) => {
  const [totalUsers, buyers, sellers, activeUsers, totalProducts, activeProducts, totalOrders, paidRevenue, recentOrders, topProducts, topSellers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'buyer' }),
    User.countDocuments({ role: 'seller' }),
    User.countDocuments({ status: 'active' }),
    Product.countDocuments(),
    Product.countDocuments({ status: 'active' }),
    Order.countDocuments(),
    Order.aggregate([{ $match: { 'payment.status': 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.find().populate('buyer', 'name email').sort({ createdAt: -1 }).limit(6).select('orderNumber buyer total currency status payment.status createdAt').lean(),
    Order.aggregate([
      { $match: { status: 'delivered' } }, { $unwind: '$items' },
      { $group: { _id: '$items.product', units: { $sum: '$items.quantity' }, gross: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } } } },
      { $sort: { units: -1 } }, { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } }, { $unwind: '$product' },
      { $project: { _id: 1, name: '$product.name', units: 1, gross: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: 'delivered' } }, { $unwind: '$items' },
      { $group: { _id: '$items.seller', units: { $sum: '$items.quantity' }, gross: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } } } },
      { $sort: { units: -1 } }, { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'seller' } }, { $unwind: '$seller' },
      { $project: { _id: 1, name: '$seller.name', units: 1, gross: 1 } },
    ]),
  ]);
  return sendSuccess(res, { data: { summary: {
    totalUsers, buyers, sellers, activeUsers, suspendedUsers: totalUsers - activeUsers,
    totalProducts, activeProducts, totalOrders, paidRevenue: paidRevenue[0]?.total || 0,
  }, recentOrders, topProducts, topSellers } });
});

exports.listUsers = catchAsync(async (req, res, next) => {
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const query = {};
  if (req.query.role) {
    if (!['buyer', 'seller', 'admin'].includes(req.query.role)) return next(new AppError('Invalid user role filter.', 400));
    query.role = req.query.role;
  }
  if (req.query.status) {
    if (!['active', 'suspended'].includes(req.query.status)) return next(new AppError('Invalid account status filter.', 400));
    query.status = req.query.status;
  }
  if (req.query.search) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 120) return next(new AppError('Search must be 120 characters or fewer.', 400));
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ name: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }];
  }
  const [users, total] = await Promise.all([
    User.find(query).select('name email role status createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  return sendSuccess(res, { data: { users }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid user id.', 400));
  const { role, status } = req.body || {};
  if (role === undefined && status === undefined) return next(new AppError('Provide a role or account status to update.', 400));
  if (role !== undefined && !['buyer', 'seller', 'admin'].includes(role)) return next(new AppError('Invalid role.', 400));
  if (status !== undefined && !['active', 'suspended'].includes(status)) return next(new AppError('Invalid account status.', 400));
  const target = await User.findById(req.params.id);
  if (!target) return next(new AppError('User not found.', 404));
  const nextRole = role ?? target.role;
  const nextStatus = status ?? target.status;
  if (target._id.equals(req.user._id) && (nextRole !== 'admin' || nextStatus !== 'active')) return next(new AppError('You cannot remove your own active administrator access.', 409));
  if (target.role === 'admin' && target.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active')) {
    const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
    if (activeAdmins <= 1) return next(new AppError('The last active administrator cannot be demoted or suspended.', 409));
  }
  target.role = nextRole;
  target.status = nextStatus;
  await target.save();
  return sendSuccess(res, { message: 'Account updated.', data: { user: { id: target._id, name: target.name, email: target.email, role: target.role, status: target.status } } });
});

exports.listProducts = catchAsync(async (req, res, next) => {
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const query = {};
  if (req.query.status) {
    if (!['draft', 'active', 'archived'].includes(req.query.status)) return next(new AppError('Invalid product status filter.', 400));
    query.status = req.query.status;
  }
  if (req.query.search) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 120) return next(new AppError('Search must be 120 characters or fewer.', 400));
    query.$text = { $search: req.query.search };
  }
  const [products, total] = await Promise.all([
    Product.find(query).populate('seller', 'name email status').populate('category', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  return sendSuccess(res, { data: { products }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const { status, stock, price } = req.body || {};
  if (status === undefined && stock === undefined && price === undefined) return next(new AppError('Provide a product status, stock, or price to update.', 400));
  if (status !== undefined && !['draft', 'active', 'archived'].includes(status)) return next(new AppError('Invalid product status.', 400));
  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) return next(new AppError('Stock must be a non-negative whole number.', 400));
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) return next(new AppError('Price must be a non-negative number.', 400));
  const product = await Product.findByIdAndUpdate(req.params.id, { $set: { status, stock, price } }, { new: true, runValidators: true }).populate('seller', 'name email').populate('category', 'name');
  if (!product) return next(new AppError('Product not found.', 404));
  return sendSuccess(res, { message: 'Product updated.', data: { product } });
});

exports.listOrders = catchAsync(async (req, res, next) => {
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const query = {};
  if (req.query.status) {
    if (!orderStatuses.includes(req.query.status)) return next(new AppError('Invalid order status filter.', 400));
    query.status = req.query.status;
  }
  const [orders, total] = await Promise.all([
    Order.find(query).populate('buyer', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('orderNumber buyer total currency status payment createdAt items').lean(),
    Order.countDocuments(query),
  ]);
  return sendSuccess(res, { data: { orders }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('buyer', 'name email').populate('items.seller', 'name email').populate('items.product', 'name slug').lean();
  if (!order) return next(new AppError('Order not found.', 404));
  return sendSuccess(res, { data: { order } });
});

exports.cancelOrder = catchAsync(async (req, res, next) => {
  const candidate = await Order.findById(req.params.id);
  if (!candidate) return next(new AppError('Order not found.', 404));
  if (candidate.payment.sessionCreating) return next(new AppError('A payment session is being created. Try again shortly.', 409));
  await expireCheckoutSession(candidate);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(req.params.id).session(session);
      if (!order) throw new AppError('Order not found.', 404);
      if (order.payment.sessionCreating) throw new AppError('A payment session is being created. Try again shortly.', 409);
      if (order.status !== 'pending' || order.payment.status === 'paid' || order.items.some((item) => item.fulfillmentStatus !== 'pending')) throw new AppError('Only unpaid pending orders can be cancelled from admin.', 409);
      for (const item of order.items) await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
      order.status = 'cancelled';
      order.items.forEach((item) => { item.fulfillmentStatus = 'cancelled'; });
      order.statusHistory.push({ status: 'cancelled', note: `Cancelled by admin ${req.user.email}` });
      order = await order.save({ session });
    });
  } catch (error) {
    if (/transaction numbers are only allowed|replica set|does not support transactions/i.test(error.message || '')) return next(new AppError('Order cancellation needs MongoDB transaction support.', 503));
    return next(error);
  } finally { await session.endSession(); }
  return sendSuccess(res, { message: 'Order cancelled.', data: { order } });
});
