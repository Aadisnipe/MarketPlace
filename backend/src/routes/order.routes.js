const router = require('express').Router();
const order = require('../controllers/order.controller');
const payment = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');
const { requireBuyer } = require('../controllers/cart.controller');

router.post('/', protect, requireBuyer, order.checkout);
router.get('/', protect, requireBuyer, order.listBuyerOrders);
router.get('/:id', protect, requireBuyer, order.getBuyerOrder);
router.post('/:id/cancel', protect, requireBuyer, order.cancelBuyerOrder);
router.post('/:id/payments/stripe/confirm', protect, requireBuyer, payment.confirmStripeSession);
router.post('/:id/payments/stripe', protect, requireBuyer, payment.createStripeSession);

module.exports = router;
