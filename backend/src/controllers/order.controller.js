const crypto = require('crypto');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const { getStripe, expireCheckoutSession } = require('../services/payment/stripe');
const pagination = require('../utils/pagination');

const addressFields = ['name', 'phone', 'line1', 'line2', 'city', 'region', 'postalCode', 'country'];

exports.checkout = catchAsync(async (req, res, next) => {
  getStripe();
  const rawAddress = req.body?.shippingAddress || {};
  const shippingAddress = Object.fromEntries(addressFields.filter((key) => rawAddress[key] !== undefined).map((key) => [key, String(rawAddress[key]).trim()]));
  const requiredAddressFields = ['name', 'phone', 'line1', 'city', 'region', 'postalCode', 'country'];
  const errors = requiredAddressFields.filter((key) => !shippingAddress[key] || shippingAddress[key].length > (key === 'line1' ? 120 : key === 'name' ? 80 : 80)).map((field) => ({ field: `shippingAddress.${field}`, message: `${field} is required.` }));
  if (errors.length) return next(new AppError('Enter a complete shipping address.', 400, errors));
  if (shippingAddress.line2?.length > 120) return next(new AppError('Address line 2 must be 120 characters or fewer.', 400));
  if (shippingAddress.phone.length > 30 || shippingAddress.postalCode.length > 20) return next(new AppError('Phone or postal code is too long.', 400));

  const session = await mongoose.startSession();
  let createdOrder;
  try {
    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ buyer: req.user._id }).session(session).populate({
        path: 'items.product',
        select: 'name seller price currency stock images sku status',
        populate: { path: 'seller', select: 'name role status' },
      });
      if (!cart?.items.length) throw new AppError('Your cart is empty.', 400);

      const currencies = new Set();
      const orderItems = [];
      let subtotal = 0;
      for (const item of cart.items) {
        const product = item.product;
        if (!product || product.status !== 'active' || product.seller?.status !== 'active' || product.seller?.role !== 'seller') throw new AppError('A product in your cart is no longer available. Refresh your cart and try again.', 409);
        currencies.add(product.currency || 'INR');
        const reservation = await Product.updateOne(
          { _id: product._id, status: 'active', stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session }
        );
        if (reservation.modifiedCount !== 1) throw new AppError(`${product.name} no longer has enough stock. Refresh your cart and try again.`, 409);
        const unitPrice = product.price;
        subtotal += unitPrice * item.quantity;
        orderItems.push({
          product: product._id,
          seller: product.seller._id,
          name: product.name,
          imageUrl: product.images?.[0],
          sku: product.sku,
          unitPrice,
          quantity: item.quantity,
          fulfillmentStatus: 'pending',
        });
      }
      if (currencies.size !== 1) throw new AppError('Your cart contains products in different currencies. Check out separately.', 400);

      const orderNumber = `MKT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      [createdOrder] = await Order.create([{
        orderNumber,
        buyer: req.user._id,
        items: orderItems,
        currency: [...currencies][0],
        subtotal,
        shippingTotal: 0,
        taxTotal: 0,
        total: subtotal,
        status: 'pending',
        payment: { provider: 'mock', status: 'pending' },
        shippingAddress,
        statusHistory: [{ status: 'pending', note: 'Order placed' }],
      }], { session });
      cart.items = [];
      await cart.save({ session });
    });
  } catch (error) {
    const message = error.message || '';
    if (/transaction numbers are only allowed|replica set|does not support transactions/i.test(message)) {
      return next(new AppError('Checkout needs MongoDB transaction support. Use MongoDB Atlas or a replica set.', 503));
    }
    return next(error);
  } finally {
    await session.endSession();
  }

  return sendSuccess(res, { statusCode: 201, message: 'Order placed.', data: { order: createdOrder } });
});

const orderPopulation = [
  { path: 'items.product', select: 'name slug images brand' },
  { path: 'items.seller', select: 'name' },
];

exports.listBuyerOrders = catchAsync(async (req, res) => {
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const [orders, total] = await Promise.all([
    Order.find({ buyer: req.user._id }).populate(orderPopulation).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments({ buyer: req.user._id }),
  ]);
  return sendSuccess(res, { data: { orders }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.getBuyerOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id }).populate(orderPopulation).lean();
  if (!order) return next(new AppError('Order not found.', 404));
  return sendSuccess(res, { data: { order } });
});

exports.cancelBuyerOrder = catchAsync(async (req, res, next) => {
  const candidate = await Order.findOne({ _id: req.params.id, buyer: req.user._id });
  if (!candidate) return next(new AppError('Order not found.', 404));
  if (candidate.payment.sessionCreating) return next(new AppError('A payment session is being created. Try again shortly.', 409));
  await expireCheckoutSession(candidate);
  const session = await mongoose.startSession();
  let cancelled;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id }).session(session);
      if (!order) throw new AppError('Order not found.', 404);
      if (order.payment.sessionCreating) throw new AppError('A payment session is being created. Try again shortly.', 409);
      if (order.status !== 'pending' || order.payment.status === 'paid' || order.items.some((item) => item.fulfillmentStatus !== 'pending')) {
        throw new AppError('This order can no longer be cancelled online.', 409);
      }
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
      }
      order.status = 'cancelled';
      order.items.forEach((item) => { item.fulfillmentStatus = 'cancelled'; });
      order.statusHistory.push({ status: 'cancelled', note: 'Cancelled by buyer' });
      cancelled = await order.save({ session });
    });
  } catch (error) {
    if (/transaction numbers are only allowed|replica set|does not support transactions/i.test(error.message || '')) {
      return next(new AppError('Order cancellation needs MongoDB transaction support.', 503));
    }
    return next(error);
  } finally {
    await session.endSession();
  }
  await cancelled.populate(orderPopulation);
  return sendSuccess(res, { message: 'Order cancelled.', data: { order: cancelled } });
});

exports.listSellerOrders = catchAsync(async (req, res, next) => {
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const query = { 'items.seller': req.user._id };
  if (req.query.status) {
    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(req.query.status)) return next(new AppError('Invalid order status filter.', 400));
    query.status = req.query.status;
  }
  const [orders, total] = await Promise.all([
    Order.find(query).populate([{ path: 'buyer', select: 'name' }, ...orderPopulation]).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(query),
  ]);
  const sellerOrders = orders.map((order) => {
    const items = order.items.filter((item) => item.seller?._id?.toString() === req.user._id.toString());
    const sellerSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      shippingAddress: order.shippingAddress,
      items,
      sellerSubtotal,
      currency: order.currency,
    };
  });
  return sendSuccess(res, { data: { orders: sellerOrders }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const nextFulfillment = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  shipped: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

function summarizeStatus(items) {
  const active = items.map((item) => item.fulfillmentStatus).filter((status) => status !== 'cancelled');
  if (!active.length) return 'cancelled';
  const sequence = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
  return sequence[Math.min(...active.map((status) => sequence.indexOf(status)).filter((index) => index >= 0))] || 'pending';
}

exports.updateSellerFulfillment = catchAsync(async (req, res, next) => {
  const { status } = req.body || {};
  if (!Object.values(nextFulfillment).includes(status)) return next(new AppError('Choose a valid next fulfillment status.', 400));
  if (!mongoose.isValidObjectId(req.params.itemId)) return next(new AppError('Invalid order item.', 400));
  const order = await Order.findOne({ _id: req.params.id, 'items.seller': req.user._id });
  if (!order) return next(new AppError('Order not found.', 404));
  if (order.payment.status !== 'paid') return next(new AppError('A seller can fulfill an order after payment is confirmed.', 409));
  const item = order.items.id(req.params.itemId);
  if (!item || item.seller.toString() !== req.user._id.toString()) return next(new AppError('Order item not found.', 404));
  if (item.fulfillmentStatus !== status && nextFulfillment[item.fulfillmentStatus] !== status) {
    return next(new AppError(`This item must move from ${item.fulfillmentStatus} to ${nextFulfillment[item.fulfillmentStatus] || 'a terminal state'}.`, 409));
  }
  if (item.fulfillmentStatus === status) {
    return sendSuccess(res, { data: { order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items.filter((entry) => entry.seller.toString() === req.user._id.toString()),
      statusHistory: order.statusHistory.map(({ status, changedAt }) => ({ status, changedAt })),
    } } });
  }

  item.fulfillmentStatus = status;
  const priorStatus = order.status;
  order.status = summarizeStatus(order.items);
  order.statusHistory.push({ status: order.status, note: `${item.name}: ${status.replaceAll('_', ' ')}` });
  await order.save();

  const visibleOrder = {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    priorStatus,
    items: order.items.filter((entry) => entry.seller.toString() === req.user._id.toString()),
    statusHistory: order.statusHistory.map(({ status, changedAt }) => ({ status, changedAt })),
  };
  return sendSuccess(res, { message: 'Fulfillment status updated.', data: { order: visibleOrder } });
});
