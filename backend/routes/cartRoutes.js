const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

// All cart routes require authentication
router.use(authMiddleware);

// Helper to check valid MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ============================================================
// 1. GET /api/cart - Get authenticated user's cart
// ============================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    let cart = await Cart.findOne({ user: userId }).populate('items.product');

    // If user has no cart yet, return clean empty cart response
    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          user: userId,
          items: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: cart
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
// 2. POST /api/cart - Add a product to the user's cart
// ============================================================
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    // Validate productId format
    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Validate quantity as positive integer
    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer greater than or equal to 1'
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

    // Verify available stock
    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock'
      });
    }

    if (parsedQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity (${parsedQty}) exceeds available stock (${product.stock})`
      });
    }

    // Find user's cart or create new one
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{ product: productId, quantity: parsedQty }]
      });
    } else {
      // Check if product already exists in cart
      const existingItemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        const newTotalQty = cart.items[existingItemIndex].quantity + parsedQty;

        // Check if combined quantity exceeds stock
        if (newTotalQty > product.stock) {
          return res.status(400).json({
            success: false,
            message: `Cannot add ${parsedQty} more. Total in cart (${newTotalQty}) would exceed available stock (${product.stock})`
          });
        }

        cart.items[existingItemIndex].quantity = newTotalQty;
      } else {
        cart.items.push({ product: productId, quantity: parsedQty });
      }
    }

    await cart.save();
    await cart.populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      data: cart
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

    // Validate productId format
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Validate quantity as positive integer
    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer greater than or equal to 1'
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

    // Verify quantity does not exceed stock
    if (parsedQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity (${parsedQty}) exceeds available stock (${product.stock})`
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart'
      });
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart'
      });
    }

    // Update quantity
    cart.items[itemIndex].quantity = parsedQty;
    await cart.save();
    await cart.populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating cart item',
      error: error.message
    });
  }
});

// ============================================================
// 4. DELETE /api/cart/:productId - Remove item from cart
// ============================================================
router.delete('/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Validate productId format
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart'
      });
    }

    // Find item index
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart'
      });
    }

    // Remove item
    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error removing item from cart',
      error: error.message
    });
  }
});

module.exports = router;
