const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    description: { type: String, required: true, trim: true, maxlength: 10000 },
    brand: { type: String, trim: true, maxlength: 100 },
    sku: { type: String, trim: true, uppercase: true, maxlength: 64 },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String, trim: true, maxlength: 2048 }],
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'active', index: true },
    ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    ratingTotal: { type: Number, min: 0, default: 0, select: false },
    salesCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

productSchema.index({ seller: 1, slug: 1 }, { unique: true });
productSchema.index({ seller: 1, status: 1, updatedAt: -1 });
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ name: 'text', description: 'text', brand: 'text' });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
