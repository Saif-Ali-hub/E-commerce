const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

// Realistic Indian Rupee (INR) retail catalog
const catalogProducts = [
  {
    name: 'Mechanical Gaming Keyboard',
    category: 'Electronics',
    price: 1299,
    stock: 15,
    description: 'Precision mechanical keyboard with responsive tactile switches, dynamic RGB backlighting, and durable aluminum top plate.',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Wireless Noise-Canceling Headphones',
    category: 'Electronics',
    price: 3499,
    stock: 12,
    description: 'Over-ear Bluetooth headphones with premium active noise cancellation, 40-hour battery life, and crystal-clear sound.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Smart Fitness Watch',
    category: 'Electronics',
    price: 2499,
    stock: 20,
    description: 'Waterproof smartwatch featuring continuous heart-rate tracking, sleep insights, GPS tracking, and 7-day battery life.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Everyday Canvas Backpack',
    category: 'Accessories',
    price: 1499,
    stock: 8,
    description: 'Rugged vintage canvas backpack with padded laptop sleeve, water-resistant base, and ergonomic airflow shoulder straps.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Polarized Aviator Sunglasses',
    category: 'Accessories',
    price: 899,
    stock: 25,
    description: 'Classic metal frame sunglasses with 100% UV400 polarized lenses for crystal-clear vision and glare protection.',
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Ceramic Pour-Over Coffee Dripper',
    category: 'Kitchen',
    price: 799,
    stock: 18,
    description: 'Artisan ceramic coffee dripper engineered for optimal flow rate and uniform water distribution for clean, aromatic coffee.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Stainless Steel Chef\'s Knife',
    category: 'Kitchen',
    price: 1199,
    stock: 14,
    description: '8-inch precision-forged high-carbon German stainless steel knife with ergonomic wooden handle for seamless slicing.',
    image: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Minimalist Desk Lamp',
    category: 'Home',
    price: 999,
    stock: 10,
    description: 'Modern LED desk lamp with touch-sensitive dimming, 3 color temperatures, and integrated USB charging port.',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Aromatherapy Essential Oil Diffuser',
    category: 'Home',
    price: 699,
    stock: 16,
    description: 'Ultrasonic cool mist aroma diffuser with 7 ambient LED light modes and whisper-quiet timer settings for bedroom or office.',
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Eco-Friendly Non-Slip Yoga Mat',
    category: 'Sports',
    price: 899,
    stock: 22,
    description: 'Extra thick high-density TPE exercise mat with textured dual-sided grip and carrying strap for pilates and yoga.',
    image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&auto=format&fit=crop&q=80'
  }
];

async function seedProducts() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    let updatedCount = 0;
    let insertedCount = 0;

    for (const prodData of catalogProducts) {
      const existing = await Product.findOne({ name: prodData.name });

      if (existing) {
        // Update price to realistic INR value and ensure description/category are current
        const oldPrice = existing.price;
        existing.price = prodData.price;
        existing.category = prodData.category;
        existing.description = prodData.description;
        existing.image = prodData.image;
        await existing.save();
        console.log(`[UPDATED] "${prodData.name}" (${prodData.category}) -> Price updated from ₹${oldPrice} to ₹${prodData.price}`);
        updatedCount++;
      } else {
        const product = new Product(prodData);
        await product.save();
        console.log(`[INSERTED] Added product: "${prodData.name}" (${prodData.category}) - ₹${prodData.price}`);
        insertedCount++;
      }
    }

    const totalProducts = await Product.countDocuments();
    console.log('\n--- Seeding Summary ---');
    console.log(`Updated with INR pricing: ${updatedCount}`);
    console.log(`Newly inserted: ${insertedCount}`);
    console.log(`Total products in database: ${totalProducts}`);

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  } catch (error) {
    console.error('Error seeding products:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

seedProducts();
