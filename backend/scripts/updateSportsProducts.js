const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const Product = require('../models/Product');

async function updateSportsProducts() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Update image for Stainless Steel Shaker Bottle 750ml
    const shaker = await Product.findOne({
      name: { $in: ['Stainless Steel Shaker Bottle 750ml', 'Stainless Steel Protein Shaker Bottle 750ml'] }
    });
    if (shaker) {
      const oldImg = shaker.image;
      shaker.image = '/images/stainless_steel_shaker.jpg';
      await shaker.save();
      console.log(`[UPDATED IMAGE] "${shaker.name}":\n  Old: ${oldImg}\n  New: ${shaker.image}`);
    } else {
      console.warn('[NOT FOUND] Stainless Steel Shaker Bottle');
    }

    // 2. Update image for Microfiber Sports Towel Set
    const towel = await Product.findOne({
      name: { $in: ['Microfiber Sports Towel Set', 'Quick-Dry Microfiber Sports Towel Set'] }
    });
    if (towel) {
      const oldImg = towel.image;
      towel.image = '/images/microfiber_sports_towels.jpg';
      await towel.save();
      console.log(`[UPDATED IMAGE] "${towel.name}":\n  Old: ${oldImg}\n  New: ${towel.image}`);
    } else {
      console.warn('[NOT FOUND] Microfiber Sports Towel Set');
    }

    // 3. Remove Agility Ladder & Cones Set
    const del1 = await Product.deleteOne({
      name: { $in: ['Agility Ladder & Cones Set', 'Pro Agility Ladder & Training Cones Set'] }
    });
    console.log(`[DELETED] Agility Ladder & Cones Set (deletedCount: ${del1.deletedCount})`);

    // 4. Remove Adjustable Hand Grip Strengthener
    const del2 = await Product.deleteOne({
      name: { $in: ['Adjustable Hand Grip Strengthener', 'Adjustable Hand Grip Strength Exerciser'] }
    });
    console.log(`[DELETED] Adjustable Hand Grip Strengthener (deletedCount: ${del2.deletedCount})`);

    // 5. Final counts
    const finalTotal = await Product.countDocuments();
    const categories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const catMap = {};
    categories.forEach(c => { catMap[c._id] = c.count; });

    console.log('\n========================================');
    console.log('       CATALOG UPDATE SUMMARY           ');
    console.log('========================================');
    console.log(`Final Products Count : ${finalTotal} (was 60, -2 removed = 58)`);
    console.log('Category Counts:', catMap);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error updating products:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  updateSportsProducts();
}

module.exports = updateSportsProducts;
