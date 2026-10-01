const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const pagination = require('../utils/pagination');

async function verifiedOrder(buyerId, productId, orderId) {
  return Order.findOne({
    _id: orderId,
    buyer: buyerId,
    status: { $ne: 'cancelled' },
    items: { $elemMatch: { product: productId, fulfillmentStatus: 'delivered' } },
  }).select('_id');
}

async function adjustRating(productId, ratingDelta, countDelta) {
  await Product.updateOne({ _id: productId }, [
    { $set: {
      ratingTotal: { $add: [{ $ifNull: ['$ratingTotal', 0] }, ratingDelta] },
      ratingCount: { $add: [{ $ifNull: ['$ratingCount', 0] }, countDelta] },
    } },
    { $set: {
      ratingAverage: {
        $cond: [
          { $gt: ['$ratingCount', 0] },
          { $round: [{ $divide: ['$ratingTotal', '$ratingCount'] }, 2] },
          0,
        ],
      },
    } },
  ]);
}

function validateReview(input, partial = false) {
  const errors = [];
  if (!partial || input.rating !== undefined) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.push({ field: 'rating', message: 'Rating must be a whole number from 1 to 5.' });
  }
  if (!partial || input.body !== undefined) {
    if (typeof input.body !== 'string' || input.body.trim().length < 5 || input.body.trim().length > 3000) errors.push({ field: 'body', message: 'Review must be between 5 and 3,000 characters.' });
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.trim().length > 120)) errors.push({ field: 'title', message: 'Title must be 120 characters or fewer.' });
  return errors;
}

exports.listProductReviews = catchAsync(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.productId)) return next(new AppError('Invalid product id.', 400));
  const { page, limit } = pagination(req.query, { defaultLimit: 10, maxLimit: 50 });
  const [product, reviews, total] = await Promise.all([
    Product.findById(req.params.productId).select('ratingAverage ratingCount').lean(),
    Review.find({ product: req.params.productId, isVisible: true }).populate('buyer', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments({ product: req.params.productId, isVisible: true }),
  ]);
  if (!product) return next(new AppError('Product not found.', 404));
  return sendSuccess(res, { data: { reviews, ratingAverage: product.ratingAverage, ratingCount: product.ratingCount }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.eligibility = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return next(new AppError('Invalid product id.', 400));
  const product = await Product.findById(productId).select('_id');
  if (!product) return next(new AppError('Product not found.', 404));
  const [order, review] = await Promise.all([
    Order.findOne({ buyer: req.user._id, status: { $ne: 'cancelled' }, items: { $elemMatch: { product: productId, fulfillmentStatus: 'delivered' } } }).sort({ createdAt: -1 }).select('_id'),
    Review.findOne({ product: productId, buyer: req.user._id }),
  ]);
  return sendSuccess(res, { data: { eligible: Boolean(order), orderId: order?._id || null, review } });
});

exports.createReview = catchAsync(async (req, res, next) => {
  const { productId, orderId, rating, title, body } = req.body || {};
  const errors = validateReview({ rating, title, body });
  if (!mongoose.isValidObjectId(productId)) errors.push({ field: 'productId', message: 'Choose a valid product.' });
  if (!mongoose.isValidObjectId(orderId)) errors.push({ field: 'orderId', message: 'A delivered order is required to review this product.' });
  if (errors.length) return next(new AppError('Please correct the review fields.', 400, errors));
  const [product, order] = await Promise.all([
    Product.findById(productId).select('_id'),
    verifiedOrder(req.user._id, productId, orderId),
  ]);
  if (!product) return next(new AppError('Product not found.', 404));
  if (!order) return next(new AppError('Only buyers with a delivered order can review this product.', 403));
  const review = await Review.create({ product: productId, buyer: req.user._id, order: orderId, rating, title, body: body.trim() });
  await adjustRating(productId, rating, 1);
  await review.populate('buyer', 'name');
  return sendSuccess(res, { statusCode: 201, message: 'Review submitted.', data: { review } });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const { rating, title, body } = req.body || {};
  const input = Object.fromEntries(Object.entries({ rating, title, body }).filter(([, value]) => value !== undefined));
  const errors = validateReview(input, true);
  if (errors.length) return next(new AppError('Please correct the review fields.', 400, errors));
  const review = await Review.findOne({ _id: req.params.id, buyer: req.user._id });
  if (!review) return next(new AppError('Review not found.', 404));
  const oldRating = review.rating;
  if (rating !== undefined) review.rating = rating;
  if (title !== undefined) review.title = title.trim();
  if (body !== undefined) review.body = body.trim();
  await review.save();
  if (rating !== undefined && rating !== oldRating) await adjustRating(review.product, rating - oldRating, 0);
  await review.populate('buyer', 'name');
  return sendSuccess(res, { message: 'Review updated.', data: { review } });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOneAndDelete({ _id: req.params.id, buyer: req.user._id });
  if (!review) return next(new AppError('Review not found.', 404));
  await adjustRating(review.product, -review.rating, -1);
  return sendSuccess(res, { message: 'Review deleted.', data: { reviewId: review._id } });
});

exports.requireBuyer = (req, _res, next) => {
  if (req.user?.role !== 'buyer') return next(new AppError('Only buyer accounts can write reviews.', 403));
  return next();
};
