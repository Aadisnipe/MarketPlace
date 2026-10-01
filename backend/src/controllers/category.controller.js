const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const slugify = require('../utils/slug');

exports.listCategories = catchAsync(async (_req, res) => {
  const categories = await Category.find({ isActive: true }).select('name slug description imageUrl').sort({ name: 1 }).lean();
  return sendSuccess(res, { data: { categories } });
});

exports.listAdminCategories = catchAsync(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  return sendSuccess(res, { data: { categories } });
});

exports.createCategory = catchAsync(async (req, res, next) => {
  const { name, description = '', imageUrl = '' } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return next(new AppError('Category name must be between 2 and 80 characters.', 400));
  if (typeof description !== 'string' || description.length > 500) return next(new AppError('Description must be 500 characters or fewer.', 400));
  if (typeof imageUrl !== 'string' || imageUrl.length > 2048 || (imageUrl && !/^https?:\/\//i.test(imageUrl))) return next(new AppError('Image URL must use http or https.', 400));
  const category = await Category.create({ name: name.trim(), slug: slugify(name), description: description.trim(), imageUrl });
  return sendSuccess(res, { statusCode: 201, message: 'Category created.', data: { category } });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const update = {};
  const { name, description, imageUrl, isActive } = req.body || {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return next(new AppError('Category name must be between 2 and 80 characters.', 400));
    update.name = name.trim();
    update.slug = slugify(name);
  }
  if (description !== undefined) {
    if (typeof description !== 'string' || description.length > 500) return next(new AppError('Description must be 500 characters or fewer.', 400));
    update.description = description.trim();
  }
  if (imageUrl !== undefined) {
    if (typeof imageUrl !== 'string' || imageUrl.length > 2048 || (imageUrl && !/^https?:\/\//i.test(imageUrl))) return next(new AppError('Image URL must use http or https.', 400));
    update.imageUrl = imageUrl;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') return next(new AppError('isActive must be a boolean.', 400));
    update.isActive = isActive;
  }
  const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!category) return next(new AppError('Category not found.', 404));
  return sendSuccess(res, { message: 'Category updated.', data: { category } });
});

exports.deactivateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!category) return next(new AppError('Category not found.', 404));
  return sendSuccess(res, { message: 'Category deactivated.', data: { category } });
});
