const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Address = require('../models/Address');
const authMiddleware = require('../middleware/auth');

// All order routes require JWT authentication
router.use(authMiddleware);

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Allowed payment methods
const ALLOWED_PAYMENT_METHODS = ['UPI', 'COD', 'NET_BANKING'];

// ============================================================
// 1. POST /api/orders - Create an order from authenticated cart
// ============================================================
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId, shippingAddress, paymentMethod } = req.body;

    // 1. Validate payment method
    if (!paymentMethod || typeof paymentMethod !== 'string' || !ALLOWED_PAYMENT_METHODS.includes(paymentMethod.trim())) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing payment method. Allowed values are: ${ALLOWED_PAYMENT_METHODS.join(', ')}`
      });
    }

    const cleanPaymentMethod = paymentMethod.trim();

    let shippingAddressSnapshot = null;

    if (addressId) {
      if (!isValidObjectId(addressId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address ID format.'
        });
      }

      // Verify that the address belongs to req.user.id
      const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
      if (!deliveryAddress) {
        return res.status(404).json({
          success: false,
          message: 'Delivery address not found or does not belong to your account.'
        });
      }

      // Create snapshot from actual MongoDB record
      shippingAddressSnapshot = {
        fullName: deliveryAddress.fullName,
        phone: deliveryAddress.phone,
        addressLine1: deliveryAddress.addressLine1,
        addressLine2: deliveryAddress.addressLine2 || '',
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        postalCode: deliveryAddress.postalCode,
        country: deliveryAddress.country || 'India',
        addressType: deliveryAddress.addressType || 'Home'
      };
    } else if (shippingAddress && typeof shippingAddress === 'object') {
      // Legacy compatibility fallback
      shippingAddressSnapshot = {
        fullName: shippingAddress.fullName || 'Customer',
        phone: shippingAddress.phone || shippingAddress.phoneNumber || '9876543210',
        addressLine1: shippingAddress.addressLine1 || shippingAddress.street || 'Address Line 1',
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city || 'City',
        state: shippingAddress.state || 'State',
        postalCode: shippingAddress.postalCode || shippingAddress.zipCode || '000000',
        country: shippingAddress.country || 'India',
        addressType: shippingAddress.addressType || 'Home'
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'A delivery address is required to place an order. Please select or add an address.'
      });
    }

    // 1. Find user and user's cart items
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    const cartItems = (user.cart && user.cart.length > 0) ? user.cart : [];

    // Fallback: check legacy Cart collection if user.cart was empty
    let legacyCart = null;
    if (cartItems.length === 0) {
      legacyCart = await Cart.findOne({ user: userId });
      if (legacyCart && Array.isArray(legacyCart.items)) {
        cartItems.push(...legacyCart.items);
      }
    }

    // 2. Validate cart has items
    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add items to your cart before placing an order.'
      });
    }

    // 3. Pre-flight stock and existence check for all items
    const validatedItems = [];
    let calculatedTotal = 0;

    for (const cartItem of cartItems) {
      const product = await Product.findById(cartItem.product);

      // Verify product exists
      if (!product) {
        return res.status(400).json({
          success: false,
          message: 'One or more products in your cart are no longer available.'
        });
      }

      // Verify stock availability
      if (cartItem.quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${cartItem.quantity}`
        });
      }

      // Calculate item subtotal using current database price
      const subtotal = product.price * cartItem.quantity;
      calculatedTotal += subtotal;

      validatedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        subtotal
      });
    }

    // 4. Atomically decrement stock for all ordered products with rollback capability
    const deductedItems = [];
    let stockDeductionError = null;

    for (const item of validatedItems) {
      // Atomic conditional decrement: ONLY succeeds if current stock >= item.quantity
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        // Product was either concurrently purchased, deleted, or has insufficient stock
        stockDeductionError = `Insufficient stock for "${item.name}". Please adjust quantity or remove it from your cart.`;
        break;
      }

      // If stock reached 0, update inStock flag to false (guard ensures stock is still 0)
      if (updatedProduct.stock === 0) {
        await Product.findOneAndUpdate({ _id: item.product, stock: 0 }, { inStock: false });
      }

      deductedItems.push(item);
    }

    // If any item failed atomic decrement, roll back all previously deducted items
    if (stockDeductionError) {
      for (const deducted of deductedItems) {
        try {
          await Product.findByIdAndUpdate(deducted.product, {
            $inc: { stock: deducted.quantity },
            inStock: true
          });
        } catch (rollbackErr) {
          console.error(`Failed to restore stock for product ${deducted.product}:`, rollbackErr.message);
        }
      }
      return res.status(400).json({
        success: false,
        message: stockDeductionError
      });
    }

    // 5. Create and save the order snapshot with payment information
    let savedOrder = null;
    try {
      const order = new Order({
        user: userId,
        items: validatedItems,
        products: validatedItems, // legacy format compatibility
        totalAmount: calculatedTotal,
        total: calculatedTotal, // legacy format compatibility
        shippingAddress: shippingAddressSnapshot,
        paymentMethod: cleanPaymentMethod,
        paymentStatus: 'Pending',
        paymentReference: null,
        paymentUpdatedAt: new Date(),
        status: 'Pending'
      });

      savedOrder = await order.save();
    } catch (orderSaveError) {
      // If order saving fails, restore all deducted stock
      for (const deducted of deductedItems) {
        try {
          await Product.findByIdAndUpdate(deducted.product, {
            $inc: { stock: deducted.quantity },
            inStock: true
          });
        } catch (rollbackErr) {
          console.error(`Failed to restore stock after order save error for product ${deducted.product}:`, rollbackErr.message);
        }
      }
      throw orderSaveError;
    }

    // 6. Clear the user's cart atomically (prevents Mongoose VersionError)
    try {
      await User.findByIdAndUpdate(userId, { $set: { cart: [] } });
      if (legacyCart) {
        await Cart.findByIdAndUpdate(legacyCart._id, { $set: { items: [] } });
      }
    } catch (cartClearError) {
      console.error('Non-fatal error clearing cart after order creation:', cartClearError.message);
    }

    // 7. Return 201 with saved order details
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: savedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating order',
      error: error.message
    });
  }
});

// ============================================================
// 2. GET /api/orders - Retrieve authenticated user's orders
// ============================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Return only orders belonging to authenticated user, newest first
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving orders',
      error: error.message
    });
  }
});

// ============================================================
// 3. GET /api/orders/:id - Retrieve a single order by ID
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(id);

    // If order does not exist or belongs to another user, return 404
    if (!order || order.user.toString() !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving order',
      error: error.message
    });
  }
});

module.exports = router;
