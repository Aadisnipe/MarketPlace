require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function bootstrap() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || 'Marketplace Admin').trim();
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL to a valid email address.');
  if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Set BOOTSTRAP_ADMIN_PASSWORD to a password of 8 to 72 bytes.');
  if (name.length < 2 || name.length > 80) throw new Error('BOOTSTRAP_ADMIN_NAME must be between 2 and 80 characters.');

  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name, passwordHash, role: 'admin', status: 'active' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Administrator ready: ${user.email}`);
}

bootstrap()
  .catch((error) => {
    console.error(`Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
