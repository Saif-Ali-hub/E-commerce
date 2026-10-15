const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const addressRoutes = require('./routes/addressRoutes');
const contactRoutes = require('./routes/contactRoutes');
const saleRoutes = require('./routes/saleRoutes');
const couponRoutes = require('./routes/couponRoutes');
const walletRoutes = require('./routes/walletRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const { imageRouter, streamImageHandler } = require('./routes/imageRoutes');

// Load environment variables from backend/.env and project root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// 1. GridFS / MongoDB Image Streaming for /images/:filename and /api/images/:filename
app.get('/images/:filename', streamImageHandler);
app.use('/api/images', imageRouter);

// 2. Serve static frontend files and persistent disk assets
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));

// 3. Health check endpoint reporting live E-commerce database status
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const currentDb = mongoose.connection.name;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    databaseName: currentDb,
    targetDatabase: 'e-commerce',
    isStandardDatabase: currentDb.toLowerCase() === 'e-commerce',
    message: isDbConnected ? 'API and E-commerce database are running successfully' : 'Database disconnected',
    timestamp: new Date().toISOString()
  });
});

// 4. API routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/seller', sellerRoutes);

// Server port
const PORT = process.env.PORT || 5000;

// Connect to MongoDB before accepting incoming requests
const startServer = async () => {
  try {
    await connectDB();
    try {
      const { syncLegacyData } = require('./scripts/syncLegacyData');
      syncLegacyData().catch((e) => console.warn('Legacy sync notice:', e.message));
    } catch (e) {
      // Ignore if script missing
    }
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Connected to database: ${mongoose.connection.name}`);
    });
    return server;
  } catch (error) {
    console.error('Failed to start server due to database error:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
