const Stripe = require('stripe');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

let stripe;

function getStripe() {
  if (!env.stripeSecretKey) throw new AppError('Stripe is not configured. Set STRIPE_SECRET_KEY in the backend environment.', 503);
  if (!stripe) stripe = new Stripe(env.stripeSecretKey);
  return stripe;
}

function getWebhookSecret() {
  if (!env.stripeWebhookSecret) throw new AppError('Stripe webhook is not configured.', 503);
  return env.stripeWebhookSecret;
}

async function expireCheckoutSession(order) {
  if (order.payment.provider !== 'stripe' || !order.payment.reference || order.payment.status === 'failed') return;
  const client = getStripe();
  const session = await client.checkout.sessions.retrieve(order.payment.reference);
  if (session.status === 'open') {
    await client.checkout.sessions.expire(session.id);
    return;
  }
  if (session.status === 'complete') {
    throw new AppError('Payment is processing and the order cannot be cancelled yet.', 409);
  }
}

module.exports = { getStripe, getWebhookSecret, expireCheckoutSession };
