const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

// All wishlist routes require JWT authentication
router.use(authMiddleware);

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ============================================================
// 1. GET /api/wishlist - Retrieve authenticated user's wishlist
// ============================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    let wishlist = await Wishlist.findOne({ user: userId }).populate('products');

    // If user has no wishlist record yet, return empty list cleanly
    if (!wishlist) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: {
          user: userId,
          products: []
        }
      });
    }

    // Filter out any orphaned null products (in case a product was deleted)
    const validProducts = wishlist.products.filter((p) => p !== null && p !== undefined);

    // If any orphaned null references were removed, clean up document in background
    if (validProducts.length !== wishlist.products.length) {
      wishlist.products = validProducts.map((p) => p._id);
      await wishlist.save();
    }

    res.status(200).json({
      success: true,
      count: validProducts.length,
      data: {
        _id: wishlist._id,
        user: wishlist.user,
        products: validProducts,
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wishlist',
      error: error.message
    });
  }
});

// ============================================================
// 2. POST /api/wishlist/:productId - Add product to wishlist
// ============================================================
router.post('/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Validate MongoDB ObjectId format
    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Verify product exists in database
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Find or create user's wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        products: []
      });
    }

    // Check if product is already in wishlist to prevent duplicates
    const alreadyInWishlist = wishlist.products.some(
      (p) => p.toString() === productId.toString()
    );

    if (alreadyInWishlist) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in your wishlist'
      });
    }

    // Add product to wishlist
    wishlist.products.push(product._id);
    await wishlist.save();

    // Populate and return updated wishlist
    await wishlist.populate('products');
    const validProducts = wishlist.products.filter((p) => p !== null);

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      count: validProducts.length,
      data: {
        _id: wishlist._id,
        user: wishlist.user,
        products: validProducts,
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding product to wishlist',
      error: error.message
    });
  }
});

// ============================================================
// 3. DELETE /api/wishlist/:productId - Remove product from wishlist
// ============================================================
router.delete('/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Validate MongoDB ObjectId format
    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Find user's wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Check if product is currently in wishlist
    const itemIndex = wishlist.products.findIndex(
      (p) => p.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your wishlist'
      });
    }

    // Remove product from wishlist
    wishlist.products.splice(itemIndex, 1);
    await wishlist.save();

    // Populate and return updated wishlist
    await wishlist.populate('products');
    const validProducts = wishlist.products.filter((p) => p !== null);

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      count: validProducts.length,
      data: {
        _id: wishlist._id,
        user: wishlist.user,
        products: validProducts,
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error removing product from wishlist',
      error: error.message
    });
  }
});

// ============================================================
// 4. GET /api/wishlist/check/:productId - Check if product is in user's wishlist
// ============================================================
router.get('/check/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const wishlist = await Wishlist.findOne({
      user: userId,
      products: productId
    });

    res.status(200).json({
      success: true,
      inWishlist: Boolean(wishlist)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error checking wishlist state',
      error: error.message
    });
  }
});

module.exports = router;
