const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    description: { type: String, trim: true, maxlength: 500 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
