const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const addressRoutes = require('./routes/addressRoutes');

// Load environment variables from .env
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is running successfully',
    timestamp: new Date().toISOString()
  });
});

// Product API routes
app.use('/api/products', productRoutes);

// Authentication API routes
app.use('/api/auth', authRoutes);

// Cart API routes
app.use('/api/cart', cartRoutes);

// Order API routes
app.use('/api/orders', orderRoutes);

// Admin API routes
app.use('/api/admin', adminRoutes);

// Wishlist API routes
app.use('/api/wishlist', wishlistRoutes);

// Address API routes
app.use('/api/addresses', addressRoutes);

// Server port
const PORT = process.env.PORT || 5000;

// Start listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
