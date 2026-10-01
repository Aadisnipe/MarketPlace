const router = require('express').Router();
const cart = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth');

router.use(protect, cart.requireBuyer);
router.get('/', cart.getCart);
router.post('/items', cart.addItem);
router.patch('/items/:productId', cart.updateItem);
router.delete('/items/:productId', cart.removeItem);
router.delete('/', cart.clearCart);

module.exports = router;
