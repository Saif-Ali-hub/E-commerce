const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
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
    const user = await User.findById(userId).populate('wishlist');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Filter out any orphaned null products (in case a product was deleted)
    const validProducts = (user.wishlist || []).filter(p => p !== null && p !== undefined);

    if (validProducts.length !== (user.wishlist || []).length) {
      user.wishlist = validProducts.map(p => p._id);
      await user.save();
    }

    res.status(200).json({
      success: true,
      count: validProducts.length,
      data: {
        user: user._id,
        products: validProducts
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
// 2. POST /api/wishlist or /api/wishlist/:productId - Add a product to the user's wishlist
// ============================================================
const addProductToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId || (req.body && req.body.productId);

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    if (!Array.isArray(user.wishlist)) {
      user.wishlist = [];
    }

    // Prevent duplicate entries
    const alreadyExists = user.wishlist.some(id => id && id.toString() === productId.toString());

    if (!alreadyExists) {
      user.wishlist.push(product._id);
      await user.save();
    }

    await user.populate('wishlist');

    res.status(200).json({
      success: true,
      message: alreadyExists ? 'Product is already in your wishlist' : 'Product added to wishlist',
      data: {
        user: user._id,
        products: user.wishlist
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding to wishlist',
      error: error.message
    });
  }
};

router.post('/', addProductToWishlist);
router.post('/:productId', addProductToWishlist);

// ============================================================
// 3. DELETE /api/wishlist/:productId - Remove a product from wishlist
// ============================================================
router.delete('/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    user.wishlist = (user.wishlist || []).filter(
      id => id && id.toString() !== productId.toString()
    );

    await user.save();
    await user.populate('wishlist');

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      data: {
        user: user._id,
        products: user.wishlist
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
// 4. GET /api/wishlist/check/:productId - Check if item is in wishlist
// ============================================================
router.get('/check/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const user = await User.findById(userId);
    const isWishlisted = user && Array.isArray(user.wishlist) && user.wishlist.some(
      id => id && id.toString() === productId.toString()
    );

    res.status(200).json({
      success: true,
      isWishlisted: Boolean(isWishlisted)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error checking wishlist item',
      error: error.message
    });
  }
});

module.exports = router;
