const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

// Complete 60-product standardization mapping (Old Name -> New Name)
const renameMap = {
  // Electronics (13 products)
  '10,000mAh Magnetic Wireless Power Bank': '10,000mAh Magnetic Power Bank',
  'Ergonomic Wireless Vertical Mouse': 'Wireless Vertical Mouse',
  'Full HD 1080p Streaming Webcam': '1080p Streaming Webcam',
  'High-Speed 65W GaN Fast Charger': '65W GaN Fast Charger',
  'Mechanical Gaming Keyboard': 'Mechanical Gaming Keyboard',
  'Portable Waterproof Bluetooth Speaker': 'Waterproof Bluetooth Speaker',
  'RGB Curved Gaming Soundbar': 'RGB Gaming Soundbar',
  'Smart Fitness Watch': 'Smart Fitness Watch',
  'Studio Condenser USB Microphone': 'USB Condenser Microphone',
  'True Wireless Stereo Earbuds with ANC': 'Wireless ANC Earbuds',
  'USB-C 7-in-1 Aluminum Multiport Hub': '7-in-1 USB-C Hub',
  'Ultra-Slim 4K USB-C Monitor': '4K USB-C Monitor',
  'Wireless Noise-Canceling Headphones': 'Wireless Noise-Canceling Headphones',

  // Kitchen (12 products)
  'Airtight Borosilicate Food Storage Canisters': 'Glass Food Storage Canisters',
  'Cast Iron Pre-Seasoned Dutch Oven': 'Cast Iron Dutch Oven',
  'Ceramic Pour-Over Coffee Dripper': 'Ceramic Coffee Dripper',
  'Double-Walled Borosilicate Glass French Press': 'Borosilicate Glass French Press',
  'Electric Gooseneck Temperature Kettle': 'Electric Gooseneck Kettle',
  'Heavy-Duty Stainless Steel Garlic Press': 'Stainless Steel Garlic Press',
  'High-Precision Digital Kitchen Scale': 'Digital Kitchen Scale',
  'Non-Stick Hard Anodized Frying Pan': 'Non-Stick Frying Pan',
  'Premium Organic Bamboo Cutting Board': 'Bamboo Cutting Board',
  'Silicone Heat-Resistant Utensil Set': 'Silicone Cooking Utensil Set',
  'Stainless Steel Chef\'s Knife': 'Stainless Steel Chef\'s Knife',
  'Stainless Steel Manual Burr Coffee Grinder': 'Manual Burr Coffee Grinder',

  // Accessories (12 products)
  'Canvas Travel Toiletry Wash Bag': 'Canvas Toiletry Bag',
  'Everyday Canvas Backpack': 'Canvas Laptop Backpack',
  'Full-Grain Leather Bi-Fold Wallet': 'Leather Bi-Fold Wallet',
  'Handmade Braided Leather Belt': 'Braided Leather Belt',
  'Merino Wool Winter Beanie': 'Merino Wool Beanie',
  'Minimalist Stainless Steel Mesh Watch': 'Stainless Steel Mesh Watch',
  'Padded Travel Laptop Sleeve 14-Inch': '14-Inch Laptop Sleeve',
  'Polarized Aviator Sunglasses': 'Polarized Aviator Sunglasses',
  'Titanium Key Organizer & Carabiner': 'Titanium Key Carabiner',
  'Tortoiseshell Blue-Light Blocking Glasses': 'Blue-Light Blocking Glasses',
  'Waterproof Commuter Sling Bag': 'Crossbody Sling Bag',
  'Waxed Canvas Weekend Duffel Bag': 'Waxed Canvas Duffel Bag',

  // Home (12 products)
  'Abstract Boho Velvet Cushion Covers (Set of 2)': 'Velvet Cushion Covers (Set of 2)',
  'Aromatherapy Essential Oil Diffuser': 'Aromatherapy Essential Oil Diffuser',
  'Bamboo Slatted Bathroom Shower Mat': 'Bamboo Bathroom Floor Mat',
  'Ceramic Modern Ribbed Plant Pot': 'Ceramic Fluted Plant Pot',
  'Cordless Ambient Rechargeable Table Lamp': 'Rechargeable LED Table Lamp',
  'Ergonomic Memory Foam Seat Cushion': 'Memory Foam Seat Cushion',
  'Hand-Poured Soy Wax Scented Candle': 'Soy Wax Scented Candle',
  'Minimalist Desk Lamp': 'Minimalist LED Desk Lamp',
  'Natural Linen Textured Throw Blanket': 'Linen Throw Blanket',
  'Nordic Minimalist Silent Wall Clock': 'Silent Quartz Wall Clock',
  'Solid Oak Floating Wall Shelves (Set of 2)': 'Floating Wall Shelves (Set of 2)',
  'Woven Cotton Rope Laundry Storage Basket': 'Cotton Rope Storage Basket',

  // Sports (11 products)
  'Adjustable Hand Grip Strength Exerciser': 'Adjustable Hand Grip Strengthener',
  'Adjustable Speed Jump Rope with Ball Bearings': 'Adjustable Speed Jump Rope',
  'Breathable Padded Gym Workout Gloves': 'Padded Weightlifting Gloves',
  'Deep Tissue High-Density Foam Roller': 'High-Density Foam Roller',
  'Eco-Friendly Non-Slip Yoga Mat': 'Non-Slip Yoga Mat',
  'Insulated Stainless Steel Sports Bottle 1L': 'Insulated Sports Bottle 1L',
  'Pro Agility Ladder & Training Cones Set': 'Agility Ladder & Cones Set',
  'Quick-Dry Microfiber Sports Towel Set': 'Microfiber Sports Towel Set',
  'Resistance Loop Exercise Bands Set of 5': 'Resistance Bands (Set of 5)',
  'Stainless Steel Protein Shaker Bottle 750ml': 'Stainless Steel Shaker Bottle 750ml',
  'Waterproof Breathable Running Waist Pack': 'Running Waist Pack'
};

async function standardizeProductNames() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const initialTotal = await Product.countDocuments();
    console.log(`Initial total products in database: ${initialTotal}`);
    if (initialTotal !== 60) {
      throw new Error(`Expected exactly 60 products before cleanup, but found ${initialTotal}`);
    }

    // Capture snapshot of pre-update state for strict verification
    const snapshot = await Product.find({}).lean();
    const snapshotById = {};
    snapshot.forEach(p => { snapshotById[p._id.toString()] = p; });

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const [oldName, newName] of Object.entries(renameMap)) {
      const product = await Product.findOne({ name: oldName });
      if (!product) {
        // Check if already updated previously
        const alreadyUpdated = await Product.findOne({ name: newName });
        if (alreadyUpdated) {
          console.log(`[ALREADY STANDARDIZED] "${newName}" (${alreadyUpdated.category})`);
          unchangedCount++;
          continue;
        }
        console.warn(`[WARNING] Product "${oldName}" not found in database.`);
        continue;
      }

      if (oldName === newName) {
        console.log(`[UNCHANGED] "${oldName}" (${product.category})`);
        unchangedCount++;
      } else {
        product.name = newName;
        await product.save();
        console.log(`[RENAMED] "${oldName}" -> "${newName}" (${product.category})`);
        updatedCount++;
      }
    }

    // Post-update verification
    const finalProducts = await Product.find({}).lean();
    console.log('\n========================================');
    console.log('       STANDARDIZATION SUMMARY          ');
    console.log('========================================');
    console.log(`Total Products Before : ${initialTotal}`);
    console.log(`Total Products After  : ${finalProducts.length}`);
    console.log(`Names Renamed         : ${updatedCount}`);
    console.log(`Names Kept / Unchanged: ${unchangedCount}`);

    // Verify zero duplicates
    const finalNames = finalProducts.map(p => p.name.trim());
    const uniqueNames = new Set(finalNames);
    console.log(`Unique Names Count    : ${uniqueNames.size} (Duplicate count: ${finalNames.length - uniqueNames.size})`);
    if (uniqueNames.size !== 60) {
      throw new Error(`Duplicate names detected! Found only ${uniqueNames.size} unique names out of 60.`);
    }

    // Verify every product's ID, price, stock, category, image, reviews are unchanged
    for (const p of finalProducts) {
      const original = snapshotById[p._id.toString()];
      if (!original) {
        throw new Error(`New product ID detected! ${p._id}`);
      }
      if (original.price !== p.price) {
        throw new Error(`Price changed for ${p.name}!`);
      }
      if (original.stock !== p.stock) {
        throw new Error(`Stock changed for ${p.name}!`);
      }
      if (original.category !== p.category) {
        throw new Error(`Category changed for ${p.name}!`);
      }
      if (original.image !== p.image) {
        throw new Error(`Image changed for ${p.name}!`);
      }
      if (original.reviews?.length !== p.reviews?.length) {
        throw new Error(`Reviews changed for ${p.name}!`);
      }
    }
    console.log('Integrity Verification: All IDs, prices, stock, categories, images, and reviews verified 100% UNCHANGED.');
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error standardizing product names:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

module.exports = {
  renameMap,
  standardizeProductNames
};

if (require.main === module) {
  standardizeProductNames();
}
