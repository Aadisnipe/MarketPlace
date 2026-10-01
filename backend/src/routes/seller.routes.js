const router = require('express').Router();
const product = require('../controllers/product.controller');
const order = require('../controllers/order.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('seller'));
router.get('/overview', product.sellerOverview);
router.get('/orders', order.listSellerOrders);
router.patch('/orders/:id/items/:itemId/status', order.updateSellerFulfillment);
router.get('/products', product.listSellerProducts);
router.post('/products', product.createProduct);
router.patch('/products/:id', product.updateProduct);
router.delete('/products/:id', product.archiveProduct);

module.exports = router;
