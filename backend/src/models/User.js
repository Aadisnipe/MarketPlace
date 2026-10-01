const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer', required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
    phone: { type: String, trim: true, maxlength: 30 },
    avatarUrl: { type: String, trim: true, maxlength: 2048 },
    address: {
      line1: { type: String, trim: true, maxlength: 120 },
      line2: { type: String, trim: true, maxlength: 120 },
      city: { type: String, trim: true, maxlength: 80 },
      region: { type: String, trim: true, maxlength: 80 },
      postalCode: { type: String, trim: true, maxlength: 20 },
      country: { type: String, trim: true, maxlength: 80 },
    },
    passwordChangedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ role: 1, status: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
