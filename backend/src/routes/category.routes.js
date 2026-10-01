const router = require('express').Router();
const category = require('../controllers/category.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', category.listCategories);
router.post('/', protect, restrictTo('admin'), category.createCategory);
router.patch('/:id', protect, restrictTo('admin'), category.updateCategory);
router.delete('/:id', protect, restrictTo('admin'), category.deactivateCategory);

module.exports = router;
