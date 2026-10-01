const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    sku: { type: String, trim: true, maxlength: 64 },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    fulfillmentStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'pending',
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: [(items) => items.length > 0, 'Order must contain at least one item'] },
    currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    subtotal: { type: Number, required: true, min: 0 },
    shippingTotal: { type: Number, min: 0, default: 0 },
    taxTotal: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    payment: {
      provider: { type: String, enum: ['mock', 'stripe', 'razorpay'], default: 'mock' },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      reference: { type: String, trim: true, maxlength: 160 },
      checkoutUrl: { type: String, trim: true, maxlength: 2048, select: false },
      attempt: { type: Number, min: 0, default: 0 },
      paymentIntentId: { type: String, trim: true, maxlength: 160 },
      sessionCreating: { type: Boolean, default: false },
    },
    shippingAddress: {
      name: { type: String, trim: true, maxlength: 80 },
      phone: { type: String, trim: true, maxlength: 30 },
      line1: { type: String, trim: true, maxlength: 120 },
      line2: { type: String, trim: true, maxlength: 120 },
      city: { type: String, trim: true, maxlength: 80 },
      region: { type: String, trim: true, maxlength: 80 },
      postalCode: { type: String, trim: true, maxlength: 20 },
      country: { type: String, trim: true, maxlength: 80 },
    },
    statusHistory: [{ status: { type: String, required: true }, note: { type: String, trim: true, maxlength: 250 }, changedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true, versionKey: false }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ 'items.seller': 1, createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
