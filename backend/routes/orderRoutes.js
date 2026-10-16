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
const { generateInvoicePDF } = require('../utils/invoiceGenerator');
const { sendOrderConfirmationEmail } = require('../config/mailer');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Allowed payment methods
const ALLOWED_PAYMENT_METHODS = ['UPI', 'COD', 'NET_BANKING', 'WALLET', 'RAZORPAY', 'CARD'];

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

      let variant = null;
      let availableStock = product.stock;

      if (cartItem.selectedVariant?.variantId && Array.isArray(product.variants) && product.variants.length > 0) {
        variant = product.variants.find(v => v.variantId === cartItem.selectedVariant.variantId);
        if (variant) {
          availableStock = variant.stock;
        }
      }

      // Verify stock availability
      if (cartItem.quantity > availableStock) {
        const itemLabel = variant ? `"${product.name} (${variant.title || variant.variantId})"` : `"${product.name}"`;
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${itemLabel}. Available: ${availableStock}, Requested: ${cartItem.quantity}`
        });
      }

      // Calculate item subtotal using variant price, festive discounted, or current effective price
      let effectivePrice;
      let regularPrice;

      if (variant && typeof variant.price === 'number') {
        effectivePrice = (cartItem.selectedVariant && typeof cartItem.selectedVariant.price === 'number')
          ? cartItem.selectedVariant.price
          : variant.price;
        regularPrice = variant.price;
      } else {
        effectivePrice = getProductEffectivePrice(product);
        regularPrice = product.price;
      }

      const subtotal = effectivePrice * cartItem.quantity;
      calculatedTotal += subtotal;

      const itemRecord = {
        product: product._id,
        name: product.name,
        price: effectivePrice,
        regularPrice,
        quantity: cartItem.quantity,
        subtotal,
        seller: product.seller || null,
        sellerName: product.sellerName || null
      };

      if (variant || (cartItem.selectedVariant && cartItem.selectedVariant.variantId)) {
        itemRecord.selectedVariant = {
          variantId: (variant && variant.variantId) || cartItem.selectedVariant.variantId,
          sku: (variant && variant.sku) || cartItem.selectedVariant.sku || null,
          title: (variant && variant.title) || cartItem.selectedVariant.title || null,
          price: effectivePrice,
          attributes: (variant && variant.attributes) || cartItem.selectedVariant.attributes || null
        };
      }

      validatedItems.push(itemRecord);
    }

    // 4. Atomically decrement stock for all ordered products with rollback capability
    // Concurrency & Safety: Do not deduct stock for RAZORPAY until payment signature is verified.
    const isRazorpay = cleanPaymentMethod === 'RAZORPAY';
    const deductedItems = [];
    let stockDeductionError = null;

    if (!isRazorpay) {
      for (const item of validatedItems) {
        let updatedProduct = null;

        if (item.selectedVariant?.variantId) {
          // Atomically check and decrement stock from specific variant subdocument and sync total stock
          updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.product,
              'variants.variantId': item.selectedVariant.variantId,
              'variants.stock': { $gte: item.quantity }
            },
            {
              $inc: {
                'variants.$.stock': -item.quantity,
                stock: -item.quantity
              }
            },
            { new: true }
          );
        } else {
          // Standard top-level atomic conditional decrement
          updatedProduct = await Product.findOneAndUpdate(
            { _id: item.product, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { new: true }
          );
        }

        if (!updatedProduct) {
          // Product was either concurrently purchased, deleted, or has insufficient stock
          stockDeductionError = `Insufficient stock for "${item.name}". Please adjust quantity or remove it from your cart.`;
          break;
        }

        // If stock reached 0 or less, update inStock flag to false
        if (updatedProduct.stock <= 0) {
          await Product.findOneAndUpdate({ _id: item.product, stock: { $lte: 0 } }, { inStock: false });
        }

        deductedItems.push(item);
      }

      // If any item failed atomic decrement, roll back all previously deducted items
      if (stockDeductionError) {
        for (const deducted of deductedItems) {
          try {
            if (deducted.selectedVariant?.variantId) {
              await Product.findOneAndUpdate(
                {
                  _id: deducted.product,
                  'variants.variantId': deducted.selectedVariant.variantId
                },
                {
                  $inc: {
                    'variants.$.stock': deducted.quantity,
                    stock: deducted.quantity
                  },
                  inStock: true
                }
              );
            } else {
              await Product.findByIdAndUpdate(deducted.product, {
                $inc: { stock: deducted.quantity },
                inStock: true
              });
            }
          } catch (rollbackErr) {
            console.error(`Failed to restore stock for product ${deducted.product}:`, rollbackErr.message);
          }
        }
        return res.status(400).json({
          success: false,
          message: stockDeductionError
        });
      }
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
        stockDeducted: !isRazorpay,
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

    // Transactional Email: Order Confirmation with PDF Invoice (Requirement 3)
    if (!isRazorpay) {
      (async () => {
        try {
          const pdfBuffer = await generateInvoicePDF(savedOrder);
          const populatedUser = await User.findById(userId).select('email name');
          const recipientEmail = populatedUser?.email || shippingAddressSnapshot?.email;
          if (recipientEmail) {
            await sendOrderConfirmationEmail(savedOrder, pdfBuffer, recipientEmail);
          }
        } catch (mailErr) {
          console.warn('Order confirmation email warning:', mailErr.message);
        }
      })();
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
// 1.1. POST /api/orders/buy-now - 1-Click Express Checkout
// Directly places an order for a single product/variant
// WITHOUT clearing, modifying, or touching the user's active cart
// ============================================================
router.post('/buy-now', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId, quantity: reqQuantity, addressId, shippingAddress, paymentMethod, couponCode, useWallet } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // 1. Validate payment method
    if (!paymentMethod || typeof paymentMethod !== 'string' || !ALLOWED_PAYMENT_METHODS.includes(paymentMethod.trim())) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing payment method. Allowed values are: ${ALLOWED_PAYMENT_METHODS.join(', ')}`
      });
    }

    const cleanPaymentMethod = paymentMethod.trim();

    // 2. Validate product existence
    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid product ID is required for Express Checkout.'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or is no longer available.'
      });
    }

    const quantity = Math.max(1, parseInt(reqQuantity, 10) || 1);

    // 3. Resolve variant (if provided) and stock validation
    let variant = null;
    let availableStock = product.stock;

    if (variantId && Array.isArray(product.variants) && product.variants.length > 0) {
      variant = product.variants.find(v => v.variantId === variantId);
      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `The selected variant (${variantId}) is not available for this product.`
        });
      }
      availableStock = variant.stock;
    }

    if (quantity > availableStock) {
      const itemLabel = variant ? `"${product.name} (${variant.title || variant.variantId})"` : `"${product.name}"`;
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${itemLabel}. Available: ${availableStock}, Requested: ${quantity}`
      });
    }

    // 4. Resolve pricing
    let effectivePrice;
    let regularPrice;

    if (variant && typeof variant.price === 'number') {
      effectivePrice = variant.price;
      regularPrice = variant.price;
    } else {
      effectivePrice = getProductEffectivePrice(product);
      regularPrice = product.price;
    }

    const subtotal = Math.round(effectivePrice * quantity * 100) / 100;

    // 5. Delivery address snapshot
    let shippingAddressSnapshot = null;
    if (addressId) {
      if (!isValidObjectId(addressId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address ID format.'
        });
      }

      const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
      if (!deliveryAddress) {
        return res.status(404).json({
          success: false,
          message: 'Delivery address not found or does not belong to your account.'
        });
      }

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
        message: 'A delivery address is required to place an express order.'
      });
    }

    // 6. User account verified (above)

    // 7. Atomic stock deduction for non-Razorpay payment methods
    const isRazorpay = cleanPaymentMethod === 'RAZORPAY';
    let deductedProduct = null;

    if (!isRazorpay) {
      if (variant) {
        deductedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            variants: {
              $elemMatch: {
                variantId: variant.variantId,
                stock: { $gte: quantity }
              }
            }
          },
          {
            $inc: {
              'variants.$.stock': -quantity,
              stock: -quantity
            }
          },
          { new: true }
        );
      } else {
        deductedProduct = await Product.findOneAndUpdate(
          { _id: product._id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true }
        );
      }

      if (!deductedProduct) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". The item was just claimed by another customer.`
        });
      }

      if (deductedProduct.stock <= 0) {
        await Product.findOneAndUpdate({ _id: product._id, stock: { $lte: 0 } }, { inStock: false });
      }
    }

    // Helper for stock rollback on calculation or saving failure
    const rollbackStock = async () => {
      if (!isRazorpay && deductedProduct) {
        try {
          if (variant) {
            await Product.findOneAndUpdate(
              {
                _id: product._id,
                variants: {
                  $elemMatch: {
                    variantId: variant.variantId
                  }
                }
              },
              { $inc: { 'variants.$.stock': quantity, stock: quantity }, inStock: true }
            );
          } else {
            await Product.findByIdAndUpdate(product._id, {
              $inc: { stock: quantity },
              inStock: true
            });
          }
        } catch (rErr) {
          console.error('Failed to restore stock on express order rollback:', rErr.message);
        }
      }
    };

    // 8. Coupon validation & discount
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
        await rollbackStock();
        return res.status(400).json({
          success: false,
          message: `Coupon code "${cleanCode}" is invalid.`
        });
      }

      const eligibility = matchedCoupon.checkEligibility(subtotal);
      if (!eligibility.valid) {
        await rollbackStock();
        return res.status(400).json({
          success: false,
          message: eligibility.message
        });
      }

      appliedDiscount = matchedCoupon.calculateDiscount(subtotal);
      couponSnapshot = {
        code: matchedCoupon.code,
        discountAmount: appliedDiscount,
        discountType: matchedCoupon.discountType,
        discountValue: matchedCoupon.discountValue
      };
    }

    // Delivery fee: Free over ₹500, else ₹50
    const deliveryFee = subtotal >= 500 ? 0 : 50;

    const amountAfterCouponAndShipping = Math.max(0, subtotal - appliedDiscount + deliveryFee);
    let walletDiscount = 0;
    const wantsWallet = Boolean(useWallet === true || useWallet === 'true' || cleanPaymentMethod === 'WALLET');

    if (wantsWallet && (user.walletBalance || 0) > 0 && amountAfterCouponAndShipping > 0) {
      // 50% Fair Usage Ceiling
      const maxAllowedWallet = Math.round((amountAfterCouponAndShipping * 0.5) * 100) / 100;
      walletDiscount = Math.min(user.walletBalance || 0, maxAllowedWallet);
    }

    const finalOrderTotal = Math.max(0, Math.round((amountAfterCouponAndShipping - walletDiscount) * 100) / 100);

    let finalPaymentMethod = cleanPaymentMethod;
    let finalPaymentStatus = 'Pending';
    let finalPaymentReference = null;

    if (cleanPaymentMethod === 'WALLET') {
      finalPaymentStatus = 'Paid';
      finalPaymentReference = `WALLET_TXN_${Date.now()}`;
    } else if (wantsWallet && finalOrderTotal === 0 && walletDiscount > 0) {
      finalPaymentMethod = 'WALLET';
      finalPaymentStatus = 'Paid';
      finalPaymentReference = `WALLET_TXN_${Date.now()}`;
    }

    // SuperCoins cashback: 5% of subtotal (minimum 10 coins)
    const coinsEarned = Math.max(10, Math.round(subtotal * 0.05));

    // 9. Build Order Items
    const itemRecord = {
      product: product._id,
      name: product.name,
      price: effectivePrice,
      regularPrice,
      quantity,
      subtotal,
      seller: product.seller || null,
      sellerName: product.sellerName || null
    };

    if (variant) {
      itemRecord.selectedVariant = {
        variantId: variant.variantId,
        sku: variant.sku || null,
        title: variant.title || null,
        price: effectivePrice,
        attributes: variant.attributes || null
      };
    }

    // 10. Create and save order
    let savedOrder = null;
    try {
      const order = new Order({
        user: userId,
        items: [itemRecord],
        products: [itemRecord],
        subtotalAmount: subtotal,
        discountAmount: appliedDiscount,
        coupon: couponSnapshot,
        walletDiscount: walletDiscount,
        coinsEarned: coinsEarned,
        totalAmount: finalOrderTotal,
        total: finalOrderTotal,
        shippingAddress: shippingAddressSnapshot,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentStatus,
        paymentReference: finalPaymentReference,
        stockDeducted: !isRazorpay,
        paymentUpdatedAt: new Date(),
        status: 'Pending'
      });

      savedOrder = await order.save();

      if (matchedCoupon) {
        await Coupon.findByIdAndUpdate(matchedCoupon._id, { $inc: { usageCount: 1 } });
      }

      // Update wallet balance & transactions
      if (walletDiscount > 0 || coinsEarned > 0) {
        if (!Array.isArray(user.walletTransactions)) {
          user.walletTransactions = [];
        }
        if (walletDiscount > 0) {
          user.walletBalance = Math.max(0, (user.walletBalance || 0) - walletDiscount);
          user.walletTransactions.push({
            type: 'debit',
            amount: walletDiscount,
            description: `Applied to Express Order #${savedOrder.orderId || savedOrder._id}`,
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
            description: `5% Cashback Reward for Express Order #${savedOrder.orderId || savedOrder._id}`,
            referenceId: String(savedOrder._id),
            date: new Date()
          });
        }
        await user.save();
      }
    } catch (saveError) {
      await rollbackStock();
      throw saveError;
    }

    // CRITICAL REQUIREMENT: We deliberately do NOT touch user.cart here! Customer's cart remains completely untouched.

    // 11. Transactional Email with PDF Invoice
    if (!isRazorpay) {
      (async () => {
        try {
          const pdfBuffer = await generateInvoicePDF(savedOrder);
          const populatedUser = await User.findById(userId).select('email name');
          const recipientEmail = populatedUser?.email || shippingAddressSnapshot?.email;
          if (recipientEmail && recipientEmail.includes('@')) {
            await sendOrderConfirmationEmail(savedOrder, pdfBuffer, recipientEmail);
          }
        } catch (mailErr) {
          console.warn('Express order confirmation email warning:', mailErr.message);
        }
      })();
    }

    return res.status(201).json({
      success: true,
      message: 'Express order placed successfully',
      data: savedOrder
    });
  } catch (error) {
    console.error('Error in /api/orders/buy-now:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing express checkout',
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
    orderObj.tracking.carrier = 'Nexura Express';
  }
  if (!orderObj.tracking.trackingNumber) {
    const code = orderObj._id ? orderObj._id.toString().slice(-6).toUpperCase() : Math.floor(100000 + Math.random() * 900000);
    orderObj.tracking.trackingNumber = `NX-TRK-${code}`;
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

// ============================================================
// 4. PUT /api/orders/:id/cancel - Secure customer order cancellation
// ============================================================
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    // 2. Fetch authenticated user from MongoDB to verify identity and role
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'User account not found'
      });
    }

    // 3. Find the order by ID
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // 4. Authorization check: Customer can cancel only their own order; Admin can cancel any Pending order
    const orderUserId = order.user && order.user._id ? order.user._id.toString() : (order.user ? order.user.toString() : null);
    const isOwner = orderUserId === userId.toString();
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to cancel this order.'
      });
    }

    // 5. Status check: Only orders with status 'Pending' can be cancelled
    if (order.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Only Pending orders can be cancelled (current status: ${order.status}).`
      });
    }

    // 6. Concurrency-safe transition claim:
    // Atomically transition status from 'Pending' to 'Cancelled' and append tracking event.
    // This ensures only ONE concurrent or repeated request can claim the cancellation transition.
    const cancellationEvent = {
      status: 'Cancelled',
      title: 'Order Cancelled by Customer',
      description: 'Order Cancelled by Customer',
      location: 'Central Fulfillment Hub, Mumbai',
      timestamp: new Date()
    };

    let updateDoc;
    if (!Array.isArray(order.tracking?.history) || order.tracking.history.length === 0) {
      const initialPlacedEvent = {
        status: 'Placed',
        title: 'Order Placed & Confirmed',
        description: 'Order details verified and sent to fulfillment center.',
        location: 'Central Fulfillment Hub, Mumbai',
        timestamp: order.createdAt || new Date()
      };
      updateDoc = {
        $set: { status: 'Cancelled' },
        $push: { 'tracking.history': { $each: [initialPlacedEvent, cancellationEvent] } }
      };
    } else {
      updateDoc = {
        $set: { status: 'Cancelled' },
        $push: { 'tracking.history': cancellationEvent }
      };
    }

    const claimedOrder = await Order.findOneAndUpdate(
      { _id: id, status: 'Pending' },
      updateDoc,
      { new: true }
    );

    if (!claimedOrder) {
      // Transition was already claimed concurrently or status changed
      const latestOrder = await Order.findById(id);
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Only Pending orders can be cancelled (current status: ${latestOrder ? latestOrder.status : 'Unknown'}).`
      });
    }

    // 7. Restore product stock for all items in order
    const itemsToRestore = Array.isArray(claimedOrder.items) && claimedOrder.items.length > 0
      ? claimedOrder.items
      : (Array.isArray(claimedOrder.products) ? claimedOrder.products : []);

    const restoredItems = [];

    for (const item of itemsToRestore) {
      const productId = item.product && item.product._id ? item.product._id : item.product;
      const quantity = Number(item.quantity);

      if (!productId || isNaN(quantity) || quantity <= 0) {
        continue;
      }

      try {
        let updatedProduct = null;
        if (item.selectedVariant && item.selectedVariant.variantId) {
          updatedProduct = await Product.findOneAndUpdate(
            {
              _id: productId,
              'variants.variantId': item.selectedVariant.variantId
            },
            {
              $inc: {
                'variants.$.stock': quantity,
                stock: quantity
              },
              $set: { inStock: true }
            },
            { new: true }
          );
        } else {
          updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
              $inc: { stock: quantity },
              $set: { inStock: true }
            },
            { new: true }
          );
        }

        if (!updatedProduct) {
          console.warn(`Product ${productId} (${item.name}) not found during stock restoration`);
        } else {
          restoredItems.push({
            productId,
            quantity,
            variantId: item.selectedVariant?.variantId || null
          });
        }
      } catch (stockErr) {
        console.error(`Failed to restore stock for product ${productId}:`, stockErr.message);

        // Compensating rollback for partial failure
        for (const restored of restoredItems) {
          try {
            if (restored.variantId) {
              await Product.findOneAndUpdate(
                { _id: restored.productId, 'variants.variantId': restored.variantId },
                { $inc: { 'variants.$.stock': -restored.quantity, stock: -restored.quantity } }
              );
            } else {
              await Product.findByIdAndUpdate(restored.productId, {
                $inc: { stock: -restored.quantity }
              });
            }
          } catch (rbErr) {
            console.error(`Failed to rollback restored stock for product ${restored.productId}:`, rbErr.message);
          }
        }

        // Revert order status back to Pending and remove the cancellation event
        try {
          await Order.findByIdAndUpdate(id, {
            $set: { status: 'Pending' },
            $pull: { 'tracking.history': { title: 'Order Cancelled by Customer' } }
          });
        } catch (revertErr) {
          console.error(`Failed to revert order status for ${id}:`, revertErr.message);
        }

        return res.status(500).json({
          success: false,
          message: 'Server error restoring product stock during order cancellation'
        });
      }
    }

    // 8. Refund wallet if wallet balance was deducted (walletDiscount > 0)
    const walletDiscount = Math.round((Number(claimedOrder.walletDiscount) || 0) * 100) / 100;

    if (walletDiscount > 0) {
      const orderTargetUserId = claimedOrder.user && claimedOrder.user._id ? claimedOrder.user._id : claimedOrder.user;
      const refundRef = `REFUND_${claimedOrder._id}`;

      try {
        // Idempotency guard: prevent duplicate credit if a refund for this order was already recorded
        const existingRefund = await User.findOne({
          _id: orderTargetUserId,
          walletTransactions: {
            $elemMatch: {
              type: 'credit',
              referenceId: refundRef
            }
          }
        });

        if (!existingRefund) {
          const refundTxn = {
            type: 'credit',
            amount: walletDiscount,
            coins: 0,
            description: `Refund for cancelled Order #${claimedOrder.orderId || claimedOrder._id}`,
            referenceId: refundRef,
            date: new Date()
          };

          const updatedUser = await User.findOneAndUpdate(
            {
              _id: orderTargetUserId,
              'walletTransactions.referenceId': { $ne: refundRef }
            },
            {
              $inc: { walletBalance: walletDiscount },
              $push: { walletTransactions: refundTxn }
            },
            { new: true }
          );

          if (!updatedUser) {
            console.warn(`User ${orderTargetUserId} not found or refund already processed.`);
          }
        }
      } catch (walletErr) {
        console.error(`Failed to refund wallet for user ${orderTargetUserId}:`, walletErr.message);

        // Compensating rollback: rollback product stock
        for (const restored of restoredItems) {
          try {
            await Product.findByIdAndUpdate(restored.productId, {
              $inc: { stock: -restored.quantity }
            });
          } catch (rbErr) {
            console.error(`Failed to rollback restored stock for product ${restored.productId}:`, rbErr.message);
          }
        }

        // Revert order status back to Pending and remove cancellation event
        try {
          await Order.findByIdAndUpdate(id, {
            $set: { status: 'Pending' },
            $pull: { 'tracking.history': { title: 'Order Cancelled by Customer' } }
          });
        } catch (revertErr) {
          console.error(`Failed to revert order status for ${id}:`, revertErr.message);
        }

        return res.status(500).json({
          success: false,
          message: 'Server error processing wallet refund during order cancellation'
        });
      }
    }

    // 9. Return updated order with enriched tracking
    const enriched = enrichOrderTracking(claimedOrder);

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: enriched
    });
  } catch (error) {
    console.error('Unexpected error cancelling order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error processing order cancellation'
    });
  }
});

// ============================================================
// 10. GET /api/orders/:id/invoice - View or Download Tax Invoice PDF
// ============================================================
router.get('/:id/invoice', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format.'
      });
    }

    const order = await Order.findOne({ _id: id, user: userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to your account.'
      });
    }

    const enriched = enrichOrderTracking(order);
    const pdfBuffer = await generateInvoicePDF(enriched);

    const safeFilename = `Invoice-${enriched.invoiceNumber || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating tax invoice PDF',
      error: error.message
    });
  }
});

module.exports = router;


