const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function createAdmin() {
  const adminName = process.env.ADMIN_NAME || 'Store Administrator';
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('Error: Please provide ADMIN_EMAIL and ADMIN_PASSWORD via environment variables.');
    console.error('Usage example:');
    console.error('  ADMIN_NAME="Admin" ADMIN_EMAIL="admin@ministore.com" ADMIN_PASSWORD="adminpassword123" node scripts/createAdmin.js');
    process.exit(1);
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log(`User "${normalizedEmail}" already exists and is already an administrator.`);
      } else {
        existingUser.role = 'admin';
        await existingUser.save();
        console.log(`Existing user "${normalizedEmail}" successfully promoted to administrator role.`);
      }
    } else {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

      const newAdmin = new User({
        name: adminName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'admin'
      });

      await newAdmin.save();
      console.log(`Administrator account for "${normalizedEmail}" successfully created with role: admin.`);
    }

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to create or update administrator:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

createAdmin();
