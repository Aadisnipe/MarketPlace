const router = require('express').Router();
const admin = require('../controllers/admin.controller');
const category = require('../controllers/category.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));
router.get('/overview', admin.overview);
router.get('/categories', category.listAdminCategories);
router.get('/users', admin.listUsers);
router.patch('/users/:id', admin.updateUser);
router.get('/products', admin.listProducts);
router.patch('/products/:id', admin.updateProduct);
router.get('/orders', admin.listOrders);
router.get('/orders/:id', admin.getOrder);
router.post('/orders/:id/cancel', admin.cancelOrder);

module.exports = router;
