const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const slugify = require('../utils/slug');
const pagination = require('../utils/pagination');

const publicProductPopulation = [
  { path: 'seller', select: 'name', match: { role: 'seller', status: 'active' } },
  { path: 'category', select: 'name slug', match: { isActive: true } },
];
const editableFields = ['name', 'description', 'category', 'brand', 'sku', 'price', 'compareAtPrice', 'currency', 'stock', 'images', 'status'];
const sortOptions = {
  newest: { createdAt: -1 },
  '-createdAt': { createdAt: -1 },
  price_asc: { price: 1, _id: 1 },
  price: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  '-price': { price: -1, _id: 1 },
  rating: { ratingAverage: -1, ratingCount: -1 },
  '-rating': { ratingAverage: -1, ratingCount: -1 },
  popular: { salesCount: -1, createdAt: -1 },
  '-salesCount': { salesCount: -1, createdAt: -1 },
};

function pick(source, fields) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function validateProduct(input, partial = false) {
  const errors = [];
  const required = ['name', 'description', 'category', 'price', 'stock'];
  if (!partial) for (const key of required) if (input[key] === undefined || input[key] === '') errors.push({ field: key, message: `${key} is required.` });
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 160)) errors.push({ field: 'name', message: 'Name must be between 2 and 160 characters.' });
  if (input.description !== undefined && (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 10000)) errors.push({ field: 'description', message: 'Description is required and must be no more than 10,000 characters.' });
  if (input.category !== undefined && !mongoose.isValidObjectId(input.category)) errors.push({ field: 'category', message: 'Choose a valid category.' });
  for (const field of ['price', 'compareAtPrice']) if (input[field] !== undefined && (!Number.isFinite(Number(input[field])) || Number(input[field]) < 0)) errors.push({ field, message: `${field} must be a non-negative number.` });
  if (input.stock !== undefined && (!Number.isInteger(Number(input.stock)) || Number(input.stock) < 0)) errors.push({ field: 'stock', message: 'Stock must be a non-negative whole number.' });
  if (input.images !== undefined && (!Array.isArray(input.images) || input.images.length > 8 || input.images.some((url) => typeof url !== 'string' || url.length > 2048 || !/^https?:\/\//i.test(url)))) errors.push({ field: 'images', message: 'Provide up to 8 valid http(s) image URLs.' });
  if (input.status !== undefined && !['draft', 'active', 'archived'].includes(input.status)) errors.push({ field: 'status', message: 'Status must be draft, active, or archived.' });
  return errors;
}

exports.listProducts = catchAsync(async (req, res, next) => {
  const { search, category, brand, minPrice, maxPrice, minRating, inStock, sort = 'newest' } = req.query;
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  if (!sortOptions[sort]) return next(new AppError(`sort must be one of: ${Object.keys(sortOptions).join(', ')}`, 400));
  for (const [key, value] of Object.entries({ minPrice, maxPrice, minRating })) {
    if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0 || (key === 'minRating' && Number(value) > 5))) return next(new AppError(`${key} is out of range.`, 400));
  }
  if (search && (typeof search !== 'string' || search.length > 120)) return next(new AppError('Search must be 120 characters or fewer.', 400));

  const query = { status: 'active' };
  if (search?.trim()) query.$text = { $search: search.trim() };
  if (category) {
    const foundCategory = mongoose.isValidObjectId(category)
      ? await Category.findOne({ _id: category, isActive: true }).select('_id')
      : await Category.findOne({ slug: String(category).toLowerCase(), isActive: true }).select('_id');
    if (!foundCategory) return sendSuccess(res, { data: { products: [] }, meta: { page, limit, total: 0, pages: 0 } });
    query.category = foundCategory._id;
  } else {
    query.category = { $in: await Category.find({ isActive: true }).distinct('_id') };
  }
  query.seller = { $in: await User.find({ role: 'seller', status: 'active' }).distinct('_id') };
  if (brand) query.brand = new RegExp(`^${String(brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
  }
  if (minRating !== undefined) query.ratingAverage = { $gte: Number(minRating) };
  if (inStock === 'true') query.stock = { $gt: 0 };
  else if (inStock !== undefined && inStock !== 'false') return next(new AppError('inStock must be true or false.', 400));

  const [products, total] = await Promise.all([
    Product.find(query).select(search ? { score: { $meta: 'textScore' } } : {}).populate(publicProductPopulation)
      .sort(sortOptions[sort]).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  const visible = products.filter((product) => product.seller && product.category);
  return sendSuccess(res, {
    data: { products: visible },
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOne({ _id: req.params.id, status: 'active' }).populate(publicProductPopulation).lean();
  if (!product || !product.seller || !product.category) return next(new AppError('Product not found.', 404));
  return sendSuccess(res, { data: { product } });
});

exports.listSellerProducts = catchAsync(async (req, res) => {
  const { page, limit } = pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const query = { seller: req.user._id };
  if (req.query.status) {
    if (!['draft', 'active', 'archived'].includes(req.query.status)) throw new AppError('Invalid product status filter.', 400);
    query.status = req.query.status;
  }
  if (req.query.search) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 120) throw new AppError('Search must be 120 characters or fewer.', 400);
    query.$text = { $search: req.query.search.trim() };
  }
  const [products, total] = await Promise.all([
    Product.find(query).populate({ path: 'category', select: 'name slug' }).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  return sendSuccess(res, { data: { products }, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.sellerOverview = catchAsync(async (req, res) => {
  const [summary = { totalProducts: 0, activeProducts: 0, outOfStockProducts: 0 }] = await Product.aggregate([
    { $match: { seller: req.user._id } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        outOfStockProducts: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'active'] }, { $eq: ['$stock', 0] }] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, totalProducts: 1, activeProducts: 1, outOfStockProducts: 1 } },
  ]);
  return sendSuccess(res, { data: { summary } });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  const input = pick(req.body || {}, editableFields);
  const errors = validateProduct(input);
  if (errors.length) return next(new AppError('Please correct the product fields.', 400, errors));
  const category = await Category.findOne({ _id: input.category, isActive: true });
  if (!category) return next(new AppError('Choose an active category.', 400));
  input.seller = req.user._id;
  input.slug = slugify(input.name);
  const product = await Product.create(input);
  return sendSuccess(res, { statusCode: 201, message: 'Product created.', data: { product } });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const input = pick(req.body || {}, editableFields);
  const errors = validateProduct(input, true);
  if (errors.length) return next(new AppError('Please correct the product fields.', 400, errors));
  if (input.category) {
    const category = await Category.findOne({ _id: input.category, isActive: true });
    if (!category) return next(new AppError('Choose an active category.', 400));
  }
  if (input.name) input.slug = slugify(input.name);
  const product = await Product.findOneAndUpdate({ _id: req.params.id, seller: req.user._id }, input, { new: true, runValidators: true }).populate('category', 'name slug');
  if (!product) return next(new AppError('Product not found.', 404));
  return sendSuccess(res, { message: 'Product updated.', data: { product } });
});

exports.archiveProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, seller: req.user._id },
    { status: 'archived' },
    { new: true }
  );
  if (!product) return next(new AppError('Product not found.', 404));
  return sendSuccess(res, { message: 'Product archived.', data: { product } });
});
