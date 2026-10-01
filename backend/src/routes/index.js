const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/categories', require('./category.routes'));
router.use('/seller', require('./seller.routes'));
router.use('/cart', require('./cart.routes'));
router.use('/orders', require('./order.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/admin', require('./admin.routes'));

// Mounted in later phases:
// router.use('/users', require('./user.routes'));
// router.use('/cart', require('./cart.routes'));
// router.use('/orders', require('./order.routes'));
// router.use('/reviews', require('./review.routes'));
// router.use('/seller', require('./seller.routes'));
// router.use('/admin', require('./admin.routes'));

module.exports = router;
