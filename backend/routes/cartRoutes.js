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

const { getProductEffectivePrice } = require('../config/festiveDeals');

// Helper to format user cart response
const formatCartResponse = (user) => {
  const items = (user.cart || []).filter(item => item.product !== null && item.product !== undefined);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => {
    const prod = typeof item.product === 'object' ? item.product : null;
    const basePrice = (item.selectedVariant && typeof item.selectedVariant.price === 'number')
      ? item.selectedVariant.price
      : getProductEffectivePrice(prod);
    return sum + (basePrice * item.quantity);
  }, 0);

  return {
    user: user._id,
    items: items.map(item => {
      const prod = typeof item.product === 'object' ? item.product : null;
      let unitPrice;
      let regularPrice;
      let isFestiveDiscount = false;

      if (item.selectedVariant && typeof item.selectedVariant.price === 'number') {
        unitPrice = item.selectedVariant.price;
        regularPrice = item.selectedVariant.price;
      } else {
        unitPrice = getProductEffectivePrice(prod);
        regularPrice = prod && prod.price ? prod.price : unitPrice;
        isFestiveDiscount = unitPrice < regularPrice;
      }

      return {
        product: item.product,
        quantity: item.quantity,
        selectedVariant: item.selectedVariant && item.selectedVariant.variantId ? item.selectedVariant : null,
        price: unitPrice,
        unitPrice,
        regularPrice,
        isFestiveDiscount,
        subtotal: unitPrice * item.quantity
      };
    }),
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
    const { productId, quantity, selectedVariant, variantId } = req.body;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const addQty = Math.max(parseInt(quantity, 10) || 1, 1);

    // Validate that the product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    let resolvedVariant = null;
    let availableStock = product.stock;

    // Check if a variant was selected or requested
    const targetVariantId = (selectedVariant && selectedVariant.variantId) || variantId || null;
    if (targetVariantId && Array.isArray(product.variants) && product.variants.length > 0) {
      resolvedVariant = product.variants.find(v => v.variantId === targetVariantId);
      if (!resolvedVariant) {
        return res.status(400).json({
          success: false,
          message: `Variant with ID '${targetVariantId}' not found on product`
        });
      }
      availableStock = resolvedVariant.stock;
    } else if (selectedVariant && selectedVariant.variantId) {
      // If variant object passed directly
      resolvedVariant = selectedVariant;
      availableStock = typeof selectedVariant.stock === 'number' ? selectedVariant.stock : product.stock;
    }

    if (availableStock <= 0) {
      const msg = resolvedVariant
        ? `This variant (${resolvedVariant.title || resolvedVariant.variantId}) is currently out of stock.`
        : 'This product is currently out of stock.';
      return res.status(400).json({
        success: false,
        message: msg
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Check if product with identical variant already exists in user.cart
    const matchVarId = resolvedVariant ? resolvedVariant.variantId : null;
    const itemIndex = user.cart.findIndex(item => {
      const sameProd = item.product && item.product.toString() === productId.toString();
      const itemVarId = item.selectedVariant && item.selectedVariant.variantId ? item.selectedVariant.variantId : null;
      return sameProd && (itemVarId === matchVarId);
    });

    if (itemIndex > -1) {
      const newQty = user.cart[itemIndex].quantity + addQty;
      if (newQty > availableStock) {
        user.cart[itemIndex].quantity = availableStock;
      } else {
        user.cart[itemIndex].quantity = newQty;
      }
    } else {
      const initialQty = Math.min(addQty, availableStock);
      const cartItemPayload = {
        product: product._id,
        quantity: initialQty
      };

      if (resolvedVariant) {
        cartItemPayload.selectedVariant = {
          variantId: resolvedVariant.variantId,
          sku: resolvedVariant.sku || null,
          title: resolvedVariant.title || null,
          price: resolvedVariant.price,
          attributes: resolvedVariant.attributes || null
        };
      }

      user.cart.push(cartItemPayload);
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
    const { quantity, variantId } = req.body;
    const targetVariantId = variantId || req.query.variantId || null;

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

    const itemIndex = user.cart.findIndex(item => {
      const sameProd = item.product && item.product.toString() === productId.toString();
      if (!sameProd) return false;
      if (targetVariantId) {
        return (item.selectedVariant && item.selectedVariant.variantId) === targetVariantId;
      }
      return true;
    });

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
      let maxStock = product ? product.stock : 999999;

      if (product && user.cart[itemIndex].selectedVariant?.variantId && Array.isArray(product.variants)) {
        const v = product.variants.find(varItem => varItem.variantId === user.cart[itemIndex].selectedVariant.variantId);
        if (v) maxStock = v.stock;
      }

      if (product && newQty > maxStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot set quantity beyond available stock (${maxStock}).`
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
    const targetVariantId = req.query.variantId || req.body?.variantId || null;

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

    if (targetVariantId) {
      user.cart = user.cart.filter(item => {
        const sameProd = item.product && item.product.toString() === productId.toString();
        const itemVarId = item.selectedVariant && item.selectedVariant.variantId ? item.selectedVariant.variantId : null;
        return !(sameProd && itemVarId === targetVariantId);
      });
    } else {
      user.cart = user.cart.filter(
        item => item.product && item.product.toString() !== productId.toString()
      );
    }

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
