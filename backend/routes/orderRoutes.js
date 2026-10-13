const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Address = require('../models/Address');
const Coupon = require('../models/Coupon');
const authMiddleware = require('../middleware/auth');

// All order routes require JWT authentication
router.use(authMiddleware);

const { getProductEffectivePrice } = require('../config/festiveDeals');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Allowed payment methods
const ALLOWED_PAYMENT_METHODS = ['UPI', 'COD', 'NET_BANKING', 'WALLET'];

// ============================================================
// 1. POST /api/orders - Create an order from authenticated cart
// ============================================================
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId, shippingAddress, paymentMethod, couponCode, useWallet } = req.body;

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

      // Calculate item subtotal using festive discounted or current effective price
      const effectivePrice = getProductEffectivePrice(product);
      const subtotal = effectivePrice * cartItem.quantity;
      calculatedTotal += subtotal;

      validatedItems.push({
        product: product._id,
        name: product.name,
        price: effectivePrice,
        regularPrice: product.price,
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

    // 4.5. Coupon validation and discount application
    let appliedDiscount = 0;
    let couponSnapshot = {
      code: null,
      discountAmount: 0,
      discountType: null,
      discountValue: 0
    };
    let matchedCoupon = null;

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const cleanCode = couponCode.trim().toUpperCase();
      matchedCoupon = await Coupon.findOne({ code: cleanCode });

      if (!matchedCoupon) {
        // Rollback stock
        for (const deducted of deductedItems) {
          try {
            await Product.findByIdAndUpdate(deducted.product, {
              $inc: { stock: deducted.quantity },
              inStock: true
            });
          } catch (e) {}
        }
        return res.status(400).json({
          success: false,
          message: `Coupon code "${cleanCode}" is invalid.`
        });
      }

      const eligibility = matchedCoupon.checkEligibility(calculatedTotal);
      if (!eligibility.valid) {
        // Rollback stock
        for (const deducted of deductedItems) {
          try {
            await Product.findByIdAndUpdate(deducted.product, {
              $inc: { stock: deducted.quantity },
              inStock: true
            });
          } catch (e) {}
        }
        return res.status(400).json({
          success: false,
          message: eligibility.message
        });
      }

      appliedDiscount = matchedCoupon.calculateDiscount(calculatedTotal);
      couponSnapshot = {
        code: matchedCoupon.code,
        discountAmount: appliedDiscount,
        discountType: matchedCoupon.discountType,
        discountValue: matchedCoupon.discountValue
      };
    }

    const amountAfterCoupon = Math.max(0, calculatedTotal - appliedDiscount);
    let walletDiscount = 0;
    const wantsWallet = Boolean(useWallet === true || useWallet === 'true');

    if (wantsWallet && (user.walletBalance || 0) > 0 && amountAfterCoupon > 0) {
      // Fair Usage Policy: A user can use wallet balance to pay up to 50% of the payable amount.
      // The remaining balance must be paid via regular payment methods (UPI, Card, Net Banking, COD).
      // This prevents total wipeout to ₹0.00 while providing substantial real savings.
      const maxAllowedWallet = Math.round((amountAfterCoupon * 0.5) * 100) / 100;
      walletDiscount = Math.min(user.walletBalance || 0, maxAllowedWallet);
    }

    const finalOrderTotal = Math.max(0, Math.round((amountAfterCoupon - walletDiscount) * 100) / 100);

    let finalPaymentMethod = cleanPaymentMethod;
    let finalPaymentStatus = 'Pending';
    let finalPaymentReference = null;

    if (wantsWallet && finalOrderTotal === 0 && walletDiscount > 0) {
      finalPaymentMethod = 'WALLET';
      finalPaymentStatus = 'Paid';
      finalPaymentReference = `WALLET_TXN_${Date.now()}`;
    }

    // 5% Cashback Reward in SuperCoins (minimum 10 coins)
    const coinsEarned = Math.max(10, Math.round(calculatedTotal * 0.05));

    // 5. Create and save the order snapshot with payment information
    let savedOrder = null;
    try {
      const order = new Order({
        user: userId,
        items: validatedItems,
        products: validatedItems, // legacy format compatibility
        subtotalAmount: calculatedTotal,
        discountAmount: appliedDiscount,
        coupon: couponSnapshot,
        walletDiscount: walletDiscount,
        coinsEarned: coinsEarned,
        totalAmount: finalOrderTotal,
        total: finalOrderTotal, // legacy format compatibility
        shippingAddress: shippingAddressSnapshot,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentStatus,
        paymentReference: finalPaymentReference,
        paymentUpdatedAt: new Date(),
        status: 'Pending'
      });

      savedOrder = await order.save();

      // If coupon was applied successfully, increment usage count
      if (matchedCoupon) {
        await Coupon.findByIdAndUpdate(matchedCoupon._id, { $inc: { usageCount: 1 } });
      }

      // Update user's wallet balance and reward loyalty coins
      if (walletDiscount > 0 || coinsEarned > 0) {
        if (!Array.isArray(user.walletTransactions)) {
          user.walletTransactions = [];
        }
        if (walletDiscount > 0) {
          user.walletBalance = Math.max(0, (user.walletBalance || 0) - walletDiscount);
          user.walletTransactions.push({
            type: 'debit',
            amount: walletDiscount,
            description: `Applied to Order #${savedOrder.orderId || savedOrder._id}`,
            referenceId: String(savedOrder._id),
            date: new Date()
          });
        }
        if (coinsEarned > 0) {
          user.coins = (user.coins || 0) + coinsEarned;
          user.walletTransactions.push({
            type: 'credit',
            coins: coinsEarned,
            amount: 0,
            description: `5% Cashback Reward for Order #${savedOrder.orderId || savedOrder._id}`,
            referenceId: String(savedOrder._id),
            date: new Date()
          });
        }
        await user.save();
      }
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

// Helper to ensure tracking history and invoiceNumber are always fully populated
function enrichOrderTracking(orderDoc) {
  const orderObj = orderDoc.toObject ? orderDoc.toObject() : { ...orderDoc };
  if (!orderObj.invoiceNumber) {
    const ymd = new Date(orderObj.createdAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    orderObj.invoiceNumber = `INV-${ymd}-${rand}`;
  }
  if (!orderObj.tracking) {
    orderObj.tracking = {};
  }
  if (!orderObj.tracking.carrier) {
    orderObj.tracking.carrier = 'MiniStore Express';
  }
  if (!orderObj.tracking.trackingNumber) {
    const code = orderObj._id ? orderObj._id.toString().slice(-6).toUpperCase() : Math.floor(100000 + Math.random() * 900000);
    orderObj.tracking.trackingNumber = `MS-TRK-${code}`;
  }
  if (!orderObj.tracking.estimatedDeliveryDate) {
    orderObj.tracking.estimatedDeliveryDate = new Date(new Date(orderObj.createdAt || Date.now()).getTime() + 3 * 24 * 60 * 60 * 1000);
  }
  if (!Array.isArray(orderObj.tracking.history) || orderObj.tracking.history.length === 0) {
    const curStatus = orderObj.status || 'Pending';
    const initialEvents = [
      {
        status: 'Placed',
        title: 'Order Placed & Confirmed',
        description: 'Order details verified and sent to fulfillment center.',
        location: 'Central Fulfillment Hub, Mumbai',
        timestamp: orderObj.createdAt || new Date()
      }
    ];
    if (['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(curStatus)) {
      initialEvents.push({
        status: 'Processing',
        title: 'Order Packed & Quality Inspected',
        description: 'Item(s) packed in secure tamper-proof packaging.',
        location: 'Warehouse Hub',
        timestamp: new Date(new Date(orderObj.createdAt || Date.now()).getTime() + 6 * 60 * 60 * 1000)
      });
    }
    if (['Shipped', 'Out for Delivery', 'Delivered'].includes(curStatus)) {
      initialEvents.push({
        status: 'Shipped',
        title: `Dispatched via ${orderObj.tracking.carrier}`,
        description: `Handed over to carrier. AWB #${orderObj.tracking.trackingNumber}`,
        location: 'Regional Logistics Center',
        timestamp: new Date(new Date(orderObj.createdAt || Date.now()).getTime() + 18 * 60 * 60 * 1000)
      });
    }
    if (['Out for Delivery', 'Delivered'].includes(curStatus)) {
      initialEvents.push({
        status: 'Out for Delivery',
        title: 'Out for Delivery',
        description: 'Package is out with your delivery partner.',
        location: 'Local Delivery Facility',
        timestamp: new Date(new Date(orderObj.createdAt || Date.now()).getTime() + 36 * 60 * 60 * 1000)
      });
    }
    if (curStatus === 'Delivered') {
      initialEvents.push({
        status: 'Delivered',
        title: 'Delivered Successfully',
        description: 'Package delivered safely.',
        location: 'Customer Address',
        timestamp: new Date(new Date(orderObj.createdAt || Date.now()).getTime() + 42 * 60 * 60 * 1000)
      });
    }
    orderObj.tracking.history = initialEvents;
  }
  return orderObj;
}

// ============================================================
// 2. GET /api/orders - Retrieve authenticated user's orders
// ============================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Return only orders belonging to authenticated user, newest first
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    const enriched = orders.map(enrichOrderTracking);

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
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
    const userRole = req.user.role;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(id);

    // If order does not exist or belongs to another user (and not admin), return 404
    if (!order || (order.user.toString() !== userId && userRole !== 'admin')) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const enriched = enrichOrderTracking(order);

    res.status(200).json({
      success: true,
      data: enriched
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
