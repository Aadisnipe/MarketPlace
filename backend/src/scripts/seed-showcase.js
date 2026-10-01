const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const env = require('../config/env');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const slugify = require('../utils/slug');

const sellerEmail = 'showcase.seller@marketplace.demo';
const categories = [
  ['Home & Living', 'Thoughtful pieces for a comfortable home.'],
  ['Bags & Accessories', 'Everyday carry and finishing touches.'],
  ['Electronics', 'Useful technology for work and downtime.'],
  ['Kitchen & Dining', 'Tools for coffee and everyday meals.'],
  ['Beauty & Care', 'Simple essentials for a daily care routine.'],
  ['Books & Stationery', 'Paper goods and desk companions.'],
];

const products = [
  ['Cloud Ceramic Mug','Kitchen & Dining','Northstar Studio','NS-MUG-01',499,649,34,'mug','A softly speckled ceramic mug with a comfortable handle, made for a slow morning coffee or tea.'],
  ['Everyday Canvas Tote','Bags & Accessories','Northstar Studio','NS-TOTE-01',799,999,22,'tote','A roomy sage canvas carryall with sturdy handles and an easy-access outer pocket.'],
  ['Timber Glow Desk Lamp','Home & Living','Northstar Home','NS-LAMP-01',2599,3199,11,'lamp','A warm walnut-and-brass task lamp that brings focused light to a desk or bedside table.'],
  ['Studio One Wireless Headphones','Electronics','Northstar Audio','NS-AUDIO-01',4499,5499,16,'headphones','Comfortable over-ear headphones with a clean finish for music, calls, and travel.'],
  ['Pocket Instant Camera','Electronics','Northstar Imaging','NS-CAM-01',5999,6999,8,'camera','A compact instant camera for turning everyday outings into prints you can keep and share.'],
  ['Alder Minimal Watch','Bags & Accessories','Northstar Studio','NS-WATCH-01',3499,4299,13,'watch','A minimal cream dial, slim gold-tone case, and tan strap make a versatile everyday watch.'],
  ['Swift Knit Runner','Bags & Accessories','Northstar Move','NS-SHOE-01',2899,3599,19,'sneaker','A lightweight knit running shoe with a cushioned sole for daily walks and easy training.'],
  ['Trail Steel Bottle','Kitchen & Dining','Northstar Move','NS-BOTTLE-01',899,1199,41,'bottle','A durable stainless-steel bottle sized for a commute, gym bag, or afternoon outdoors.'],
  ['Daily Dew Face Serum','Beauty & Care','Northstar Botanics','NS-SERUM-01',699,899,27,'serum','A lightweight daily serum in an amber glass bottle, ready for a simple morning routine.'],
  ['Haven Linen Throw','Home & Living','Northstar Home','NS-THROW-01',1899,2299,9,'throw','A soft, textured oatmeal throw that adds a relaxed layer to a sofa, chair, or bed.'],
  ['Field Notes Journal','Books & Stationery','Northstar Paper','NS-JOURNAL-01',399,499,52,'journal','A forest-green hardcover journal with a clean blank cover and room for notes and plans.'],
  ['Pebble Mini Speaker','Electronics','Northstar Audio','NS-SPEAKER-01',2199,2799,14,'speaker','A compact fabric-wrapped Bluetooth speaker with a carry loop for listening around the house.'],
  ['Slow Pour Coffee Set','Kitchen & Dining','Northstar Kitchen','NS-COFFEE-01',1299,1599,18,'coffee-set','A ribbed ceramic dripper and glass server for a simple, unhurried pour-over ritual.'],
  ['Sunday Tortoise Sunglasses','Bags & Accessories','Northstar Studio','NS-SUN-01',1199,1499,25,'sunglasses','Classic tortoiseshell frames with dark lenses, designed for everyday wear.'],
  ['Little Grove Planter','Home & Living','Northstar Home','NS-PLANT-01',649,799,31,'planter','A small matte ceramic planter and saucer for a desk, shelf, or sunny kitchen ledge.'],
  ['Woven Weekender Backpack','Bags & Accessories','Northstar Studio','NS-BACKPACK-01',2299,2799,12,'backpack','A natural woven backpack with a roomy main compartment for a day out or light weekend away.'],
  ['Quiet Hours Table Clock','Home & Living','Northstar Home','NS-CLOCK-01',999,1299,17,'watch','A clean-faced timepiece for a nightstand or work desk, styled to sit quietly in the room.'],
  ['Studio Sound Travel Case','Electronics','Northstar Audio','NS-CASE-01',599,799,36,'headphones','A padded storage case to keep headphones and small audio accessories together on the go.'],
  ['Botanical Hand Balm','Beauty & Care','Northstar Botanics','NS-BALM-01',349,449,40,'serum','A pocket-sized daily hand balm with a minimal, giftable look for a desk or travel bag.'],
  ['Desk Day Planner','Books & Stationery','Northstar Paper','NS-PLANNER-01',549,699,29,'journal','A simple weekly planner for mapping priorities, small tasks, and plans worth remembering.'],
];

async function seedShowcase() {
  if (env.isProd) throw new Error('Showcase seeding is disabled when NODE_ENV=production.');
  await connectDB();

  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12);
  const seller = await User.findOneAndUpdate(
    { email: sellerEmail },
    { $setOnInsert: { name: 'Northstar Studio (Demo Seller)', email: sellerEmail, passwordHash, role: 'seller', status: 'active' } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  const categoryIds = new Map();
  for (const [name, description] of categories) {
    const slug = slugify(name);
    const category = await Category.findOneAndUpdate(
      { slug },
      { $set: { name, description, isActive: true }, $setOnInsert: { slug } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    categoryIds.set(name, category._id);
  }

  for (const [name, categoryName, brand, sku, price, compareAtPrice, stock, image, description] of products) {
    const slug = slugify(name);
    await Product.findOneAndUpdate(
      { seller: seller._id, slug },
      {
        $set: {
          name, slug, seller: seller._id, category: categoryIds.get(categoryName), brand, sku,
          price, compareAtPrice, stock, description, images: [`/showcase-products/contact-sheet.png#${image}`],
          currency: 'INR', status: 'active',
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }

  console.log(`Showcase catalog ready: ${products.length} products across ${categoryIds.size} categories for ${seller.name}.`);
}

seedShowcase()
  .catch((error) => {
    console.error('Could not seed showcase catalog:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
