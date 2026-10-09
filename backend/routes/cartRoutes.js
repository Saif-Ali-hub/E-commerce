const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

// All cart routes require JWT authentication
router.use(authMiddleware);

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper to format user cart response
const formatCartResponse = (user) => {
  const items = (user.cart || []).filter(item => item.product !== null && item.product !== undefined);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => {
    const price = typeof item.product === 'object' && item.product.price ? item.product.price : 0;
    return sum + (price * item.quantity);
  }, 0);

  return {
    user: user._id,
    items: items.map(item => ({
      product: item.product,
      quantity: item.quantity,
      subtotal: (typeof item.product === 'object' && item.product.price ? item.product.price : 0) * item.quantity
    })),
    totalItems,
    totalAmount
  };
};

// ============================================================
// 1. GET /api/cart - Get authenticated user's cart
// ============================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('cart.product');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Filter out any deleted product references
    const originalLength = user.cart.length;
    user.cart = user.cart.filter(item => item.product !== null && item.product !== undefined);
    if (user.cart.length !== originalLength) {
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: formatCartResponse(user)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving cart',
      error: error.message
    });
  }
});

// ============================================================
// 2. POST /api/cart - Add a product to the authenticated user's cart
// ============================================================
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const addQty = Math.max(parseInt(quantity, 10) || 1, 1);

    // Validate that the product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This product is currently out of stock.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Check if product already exists in user.cart
    const itemIndex = user.cart.findIndex(
      item => item.product && item.product.toString() === productId.toString()
    );

    if (itemIndex > -1) {
      const newQty = user.cart[itemIndex].quantity + addQty;
      if (newQty > product.stock) {
        user.cart[itemIndex].quantity = product.stock;
      } else {
        user.cart[itemIndex].quantity = newQty;
      }
    } else {
      const initialQty = Math.min(addQty, product.stock);
      user.cart.push({
        product: product._id,
        quantity: initialQty
      });
    }

    await user.save();
    await user.populate('cart.product');

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      data: formatCartResponse(user)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding product to cart',
      error: error.message
    });
  }
});

// ============================================================
// 3. PUT /api/cart/:productId - Update item quantity in cart
// ============================================================
router.put('/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { quantity } = req.body;

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

    const itemIndex = user.cart.findIndex(
      item => item.product && item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your cart'
      });
    }

    const newQty = parseInt(quantity, 10);

    // Quantity <= 0 means remove from cart
    if (newQty <= 0) {
      user.cart.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);
      if (product && newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot set quantity beyond available stock (${product.stock}).`
        });
      }
      user.cart[itemIndex].quantity = newQty;
    }

    await user.save();
    await user.populate('cart.product');

    res.status(200).json({
      success: true,
      message: 'Cart quantity updated',
      data: formatCartResponse(user)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating cart quantity',
      error: error.message
    });
  }
});

// ============================================================
// 4. DELETE /api/cart/:productId - Remove a single item from cart
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

    user.cart = user.cart.filter(
      item => item.product && item.product.toString() !== productId.toString()
    );

    await user.save();
    await user.populate('cart.product');

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: formatCartResponse(user)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error removing item from cart',
      error: error.message
    });
  }
});

// ============================================================
// 5. DELETE /api/cart - Clear all items from the user's cart
// ============================================================
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    user.cart = [];
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        user: userId,
        items: [],
        totalItems: 0,
        totalAmount: 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error clearing cart',
      error: error.message
    });
  }
});

module.exports = router;
