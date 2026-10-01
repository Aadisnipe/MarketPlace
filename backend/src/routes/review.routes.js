const router = require('express').Router();
const review = require('../controllers/review.controller');
const { protect } = require('../middleware/auth');

router.get('/products/:productId', review.listProductReviews);
router.get('/eligibility/:productId', protect, review.requireBuyer, review.eligibility);
router.post('/', protect, review.requireBuyer, review.createReview);
router.patch('/:id', protect, review.requireBuyer, review.updateReview);
router.delete('/:id', protect, review.requireBuyer, review.deleteReview);

module.exports = router;
