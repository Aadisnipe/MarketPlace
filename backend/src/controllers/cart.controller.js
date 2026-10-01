const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');

const cartPopulation = {
  path: 'items.product',
  select: 'name slug seller category price currency stock images status brand sku',
  populate: [
    { path: 'seller', select: 'name status' },
    { path: 'category', select: 'name slug' },
  ],
};

function presentCart(cart) {
  const items = (cart?.items || []).map((item) => {
    const product = item.product;
    const available = Boolean(product && product.status === 'active' && product.seller?.status === 'active' && product.stock >= item.quantity);
    return {
      product,
      quantity: item.quantity,
      available,
      lineTotal: available ? product.price * item.quantity : null,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const currencies = [...new Set(items.filter((item) => item.available).map((item) => item.product.currency || 'INR'))];
  const mixedCurrencies = currencies.length > 1;
  return {
    id: cart?._id || null,
    items,
    subtotal: mixedCurrencies ? null : subtotal,
    currency: currencies.length === 1 ? currencies[0] : (currencies.length ? null : 'INR'),
    mixedCurrencies,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

async function findAvailableProduct(productId, quantity) {
  if (!mongoose.isValidObjectId(productId)) throw new AppError('Choose a valid product.', 400);
  const product = await Product.findOne({ _id: productId, status: 'active' }).populate({ path: 'seller', select: 'status role' });
  if (!product || product.seller?.status !== 'active' || product.seller?.role !== 'seller') throw new AppError('This product is no longer available.', 404);
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('Quantity must be a positive whole number.', 400);
  if (quantity > product.stock) throw new AppError(`Only ${product.stock} of this product are available.`, 409);
  return product;
}

exports.getCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ buyer: req.user._id }).populate(cartPopulation).lean();
  return sendSuccess(res, { data: { cart: presentCart(cart) } });
});

exports.addItem = catchAsync(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body || {};
  if (typeof quantity !== 'number') return next(new AppError('Quantity must be a number.', 400));
  const product = await findAvailableProduct(productId, quantity);
  let cart = await Cart.findOne({ buyer: req.user._id });
  if (!cart) cart = new Cart({ buyer: req.user._id, items: [] });
  const item = cart.items.find((entry) => entry.product.toString() === product._id.toString());
  const nextQuantity = (item?.quantity || 0) + quantity;
  if (nextQuantity > product.stock) return next(new AppError(`Only ${product.stock} of this product are available.`, 409));
  if (item) item.quantity = nextQuantity;
  else cart.items.push({ product: product._id, quantity });
  await cart.save();
  await cart.populate(cartPopulation);
  return sendSuccess(res, { message: 'Added to cart.', data: { cart: presentCart(cart) } });
});

exports.updateItem = catchAsync(async (req, res, next) => {
  const { quantity } = req.body || {};
  if (typeof quantity !== 'number') return next(new AppError('Quantity must be a number.', 400));
  await findAvailableProduct(req.params.productId, quantity);
  const cart = await Cart.findOne({ buyer: req.user._id });
  const item = cart?.items.find((entry) => entry.product.toString() === req.params.productId);
  if (!item) return next(new AppError('Cart item not found.', 404));
  item.quantity = quantity;
  await cart.save();
  await cart.populate(cartPopulation);
  return sendSuccess(res, { message: 'Cart updated.', data: { cart: presentCart(cart) } });
});

exports.removeItem = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ buyer: req.user._id });
  if (!cart) return next(new AppError('Cart item not found.', 404));
  const originalLength = cart.items.length;
  cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
  if (cart.items.length === originalLength) return next(new AppError('Cart item not found.', 404));
  await cart.save();
  await cart.populate(cartPopulation);
  return sendSuccess(res, { message: 'Item removed from cart.', data: { cart: presentCart(cart) } });
});

exports.clearCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOneAndUpdate({ buyer: req.user._id }, { items: [] }, { new: true }).populate(cartPopulation).lean();
  return sendSuccess(res, { message: 'Cart cleared.', data: { cart: presentCart(cart) } });
});

exports.requireBuyer = (req, _res, next) => {
  if (req.user?.role !== 'buyer') return next(new AppError('Only buyer accounts can use a cart.', 403));
  return next();
};

exports._findAvailableProduct = findAvailableProduct;
