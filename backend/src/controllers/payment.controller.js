const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const env = require('../config/env');
const { getStripe, getWebhookSecret } = require('../services/payment/stripe');

const zeroDecimalCurrencies = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);
const threeDecimalCurrencies = new Set(['BHD','JOD','KWD','OMR','TND']);

function toMinorUnits(amount, currency) {
  const code = currency.toUpperCase();
  const exponent = zeroDecimalCurrencies.has(code) ? 0 : threeDecimalCurrencies.has(code) ? 3 : 2;
  const factor = 10 ** exponent;
  const minor = Math.round(amount * factor);
  if (Math.abs(minor / factor - amount) > 0.000001) throw new AppError(`A product price has unsupported precision for ${code}.`, 400);
  return minor;
}

exports.createStripeSession = catchAsync(async (req, res, next) => {
  let order = await Order.findOne({ _id: req.params.id, buyer: req.user._id }).select('+payment.checkoutUrl');
  if (!order) return next(new AppError('Order not found.', 404));
  if (order.status === 'cancelled') return next(new AppError('This order has been cancelled.', 409));
  if (order.payment.status === 'paid') return next(new AppError('This order is already paid.', 409));
  if (order.payment.status === 'refunded') return next(new AppError('This order has been refunded.', 409));
  if (order.status !== 'pending') return next(new AppError('Payment is only available for pending orders.', 409));

  const stripe = getStripe();
  if (order.payment.provider === 'stripe' && order.payment.reference) {
    const existing = await stripe.checkout.sessions.retrieve(order.payment.reference);
    if (existing.status === 'open' && existing.url) {
      return sendSuccess(res, { data: { url: existing.url, sessionId: existing.id } });
    }
    if (existing.status === 'complete' && order.payment.status !== 'failed') return next(new AppError('This payment is processing. Refresh the order status shortly.', 409));
  }
  if (order.items.length > 100) return next(new AppError('A Stripe checkout can contain at most 100 line items.', 400));

  order = await Order.findOneAndUpdate(
    { _id: order._id, buyer: req.user._id, status: 'pending', 'payment.status': { $ne: 'paid' }, 'payment.sessionCreating': { $ne: true } },
    { $set: { 'payment.sessionCreating': true } },
    { new: true }
  ).select('+payment.checkoutUrl');
  if (!order) return next(new AppError('A payment session is already being created or the order is no longer payable.', 409));

  const attempt = (order.payment.attempt || 0) + 1;
  const currency = order.currency.toLowerCase();
  const lineItems = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: toMinorUnits(item.unitPrice, order.currency),
      product_data: { name: item.name },
    },
  }));
  const orderId = order._id.toString();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      client_reference_id: orderId,
      customer_email: req.user.email,
      metadata: { orderId, buyerId: req.user._id.toString() },
      payment_intent_data: { metadata: { orderId, buyerId: req.user._id.toString() } },
      success_url: `${env.clientUrl}/payment/success?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.clientUrl}/payment/cancel?order_id=${orderId}`,
    }, { idempotencyKey: `marketplace-order-${orderId}-attempt-${attempt}` });

    order.payment.provider = 'stripe';
    order.payment.reference = session.id;
    order.payment.checkoutUrl = session.url;
    order.payment.attempt = attempt;
    order.payment.status = 'pending';
    order.payment.sessionCreating = false;
    await order.save();
    return sendSuccess(res, { data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    await Order.updateOne({ _id: order._id, 'payment.sessionCreating': true }, { $set: { 'payment.sessionCreating': false } });
    throw error;
  }
});

// Checkout return pages can arrive before the webhook, or a local webhook
// forwarder can be unavailable. Confirm the stored session directly with
// Stripe so the buyer can safely refresh their own order status.
exports.confirmStripeSession = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id });
  if (!order) return next(new AppError('Order not found.', 404));
  if (order.payment.status === 'paid') return sendSuccess(res, { data: { paymentStatus: 'paid' } });
  if (order.payment.provider !== 'stripe' || !order.payment.reference) {
    return next(new AppError('This order has no Stripe Checkout session to confirm.', 409));
  }

  const session = await getStripe().checkout.sessions.retrieve(order.payment.reference);
  if (session.status === 'complete' && session.payment_status === 'paid') {
    await applySessionEvent(session, 'checkout.session.completed');
  }

  const refreshed = await Order.findOne({ _id: order._id, buyer: req.user._id }).select('payment.status');
  return sendSuccess(res, { data: { paymentStatus: refreshed.payment.status } });
});

async function applySessionEvent(session, eventType) {
  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!mongoose.isValidObjectId(orderId)) return;
  const order = await Order.findOne({ _id: orderId, 'payment.provider': 'stripe', 'payment.reference': session.id });
  if (!order) return;
  if (session.metadata?.buyerId && session.metadata.buyerId !== order.buyer.toString()) throw new AppError('Stripe session buyer does not match the order.', 400);
  if (session.currency && session.currency.toUpperCase() !== order.currency.toUpperCase()) throw new AppError('Stripe session currency does not match the order.', 400);
  if (session.amount_total !== null && session.amount_total !== undefined && session.amount_total !== toMinorUnits(order.total, order.currency)) throw new AppError('Stripe session total does not match the order.', 400);

  const successful = eventType === 'checkout.session.async_payment_succeeded' || (eventType === 'checkout.session.completed' && session.payment_status === 'paid');
  if (successful) {
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, 'payment.provider': 'stripe', 'payment.reference': session.id, 'payment.status': { $ne: 'paid' }, status: { $ne: 'cancelled' } },
      { $set: { 'payment.status': 'paid', 'payment.paymentIntentId': paymentIntentId }, $push: { statusHistory: { status: order.status, note: 'Stripe payment confirmed' } } },
      { new: true }
    );
    if (!updated) return;
    await Promise.all(updated.items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { salesCount: item.quantity } })));
    return;
  }

  if (eventType === 'checkout.session.async_payment_failed') {
    await Order.updateOne(
      { _id: orderId, 'payment.provider': 'stripe', 'payment.reference': session.id, 'payment.status': { $ne: 'paid' } },
      { $set: { 'payment.status': 'failed' }, $push: { statusHistory: { status: order.status, note: 'Stripe payment failed' } } }
    );
    return;
  }

  if (eventType === 'checkout.session.expired') {
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        const current = await Order.findOne({ _id: orderId, 'payment.provider': 'stripe', 'payment.reference': session.id }).session(mongoSession);
        if (!current || current.payment.status === 'paid' || current.status === 'cancelled') return;
        for (const item of current.items) await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session: mongoSession });
        current.payment.status = 'failed';
        current.status = 'cancelled';
        current.items.forEach((item) => { item.fulfillmentStatus = 'cancelled'; });
        current.statusHistory.push({ status: 'cancelled', note: 'Stripe Checkout session expired; reserved stock released' });
        await current.save({ session: mongoSession });
      });
    } finally { await mongoSession.endSession(); }
  }
}

async function applyRefundEvent(charge) {
  if (!charge.refunded || charge.amount_refunded < charge.amount || !charge.payment_intent) return;
  await Order.updateOne(
    { 'payment.provider': 'stripe', 'payment.paymentIntentId': charge.payment_intent, 'payment.status': 'paid' },
    { $set: { 'payment.status': 'refunded' }, $push: { statusHistory: { status: 'refunded', note: 'Full Stripe refund confirmed' } } }
  );
}

exports.webhook = async (req, res) => {
  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], getWebhookSecret());
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === 'charge.refunded') {
      await applyRefundEvent(event.data.object);
    } else if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
      await applySessionEvent(event.data.object, event.type);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return res.status(500).json({ received: false });
  }
};
