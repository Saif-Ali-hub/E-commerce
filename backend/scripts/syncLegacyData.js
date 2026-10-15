const path = require('path');
const fs = require('fs');
const mongoose = require('../node_modules/mongoose');
const dotenv = require('../node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/e-commerce';
const User = require('../models/User');
const Order = require('../models/Order');

async function syncLegacyData() {
  if (mongoose.connection.readyState === 0) {
    console.log('🔄 Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
  }

  // 1. Sync Missing Users from Legacy Database/Backup
  const backupUsersPath = path.join(__dirname, '../backup/mini_ecommerce/users.json');
  if (fs.existsSync(backupUsersPath)) {
    const backupUsers = JSON.parse(fs.readFileSync(backupUsersPath, 'utf8'));
    console.log(`Checking ${backupUsers.length} backup user(s)...`);

    for (const bUser of backupUsers) {
      const existing = await User.findOne({ email: bUser.email.toLowerCase() });
      if (!existing) {
        console.log(`➕ Importing missing user: ${bUser.email} (${bUser.name})`);
        await User.collection.insertOne({
          _id: new mongoose.Types.ObjectId(bUser._id),
          name: bUser.name,
          email: bUser.email.toLowerCase(),
          password: bUser.password,
          role: bUser.role || 'customer',
          status: bUser.status || 'active',
          avatar: bUser.avatar || '',
          phone: bUser.phone || '',
          addresses: bUser.addresses || [],
          cart: [],
          wishlist: [],
          walletBalance: 0,
          coins: 50,
          walletTransactions: [],
          createdAt: bUser.createdAt ? new Date(bUser.createdAt) : new Date(),
          updatedAt: bUser.updatedAt ? new Date(bUser.updatedAt) : new Date()
        });
        console.log(`   ✅ Imported ${bUser.email}`);
      } else {
        console.log(`   ℹ️ User ${bUser.email} already exists`);
      }
    }
  }

  // 2. Fix Legacy Orders User References
  const orders = await Order.find();
  console.log(`Inspecting ${orders.length} order(s) for user references...`);

  for (const order of orders) {
    let modified = false;

    // Check if user is a 24-character hex string instead of an ObjectId
    if (typeof order.user === 'string' && /^[0-9a-fA-F]{24}$/.test(order.user)) {
      order.user = new mongoose.Types.ObjectId(order.user);
      modified = true;
      console.log(`   🔧 Converted order ${order.orderId || order._id} user hex string to ObjectId`);
    } else if (typeof order.user === 'string' && !/^[0-9a-fA-F]{24}$/.test(order.user)) {
      // Legacy string name like "John Doe" or "Jane Smith"
      const name = order.user.trim();
      const cleanEmail = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '@ministore-legacy.local';

      // Find or create a user for this legacy name
      let legacyUser = await User.findOne({
        $or: [{ name: name }, { email: cleanEmail }]
      });

      if (!legacyUser) {
        console.log(`   ➕ Creating legacy user account for order customer: ${name}`);
        legacyUser = await User.create({
          name: name,
          email: cleanEmail,
          password: '$2b$10$eYtqSkgFQGK7OFbfn.g.LeOPipu8XAeF0rxby57kGPmlKXVmhFS2.',
          role: 'customer',
          status: 'active'
        });
      }

      if (!order.shippingAddress || !order.shippingAddress.fullName) {
        order.shippingAddress = {
          ...(order.shippingAddress || {}),
          fullName: name
        };
      }

      order.user = legacyUser._id;
      modified = true;
      console.log(`   🔧 Mapped legacy order ${order.orderId || order._id} string "${name}" to user ObjectId ${legacyUser._id}`);
    }

    if (modified) {
      await order.save();
    }
  }

  console.log('✅ Legacy sync & order cleanup completed.');
  if (require.main === module) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  syncLegacyData().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
  });
}

module.exports = { syncLegacyData };
