const router = require('express').Router();
const product = require('../controllers/product.controller');

router.get('/', product.listProducts);
router.get('/:id', product.getProduct);

module.exports = router;
