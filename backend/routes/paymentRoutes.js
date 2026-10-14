const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { generateInvoicePDF } = require('../utils/invoiceGenerator');
const { sendOrderConfirmationEmail } = require('../config/mailer');

// Helper to validate MongoDB ObjectId
const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

// Initialize Razorpay SDK instance
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
};

// Check if current keys are placeholder/mock/test
const isPlaceholderKey = (key) => {
  if (!key) return true;
  const lower = key.toLowerCase();
  return lower.includes('placeholder') || lower.includes('dummy') || lower.includes('mock');
};

// ============================================================
// 0. GET /api/payment/config
// Return Razorpay public Key ID for frontend SDK checkout
// ============================================================
router.get('/config', (req, res) => {
  res.json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID || '',
    currency: 'INR'
  });
});

// Alias for convenience
router.get('/key', (req, res) => {
  res.json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID || '',
    currency: 'INR'
  });
});

// ============================================================
// 1. POST /api/payment/create-order
// Accepts order amount, currency (INR), and receipt ID;
// creates an official Razorpay order with razorpay.orders.create()
// ============================================================
router.post('/create-order', async (req, res) => {
  try {
    let { amount, currency = 'INR', receipt, orderId } = req.body;

    // If orderId is provided, lookup existing order for exact amount and validation
    let dbOrder = null;
    if (orderId) {
      if (isValidObjectId(orderId)) {
        dbOrder = await Order.findById(orderId);
      } else {
        dbOrder = await Order.findOne({ orderId });
      }

      if (dbOrder) {
        if (!amount && dbOrder.totalAmount !== undefined) {
          amount = dbOrder.totalAmount;
        }
        if (!receipt) {
          receipt = `rcpt_${dbOrder._id.toString().slice(-8)}`;
        }
      }
    }

    if (amount === undefined || amount === null || isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid order amount is required.'
      });
    }

    // Convert amount in INR to smallest currency unit (paise)
    const amountInPaise = Math.round(Number(amount) * 100);
    const cleanCurrency = (currency || 'INR').toUpperCase();
    const cleanReceipt = String(receipt || `rcpt_${Date.now().toString().slice(-10)}`);

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    // Use official Razorpay SDK
    let rzpOrder = null;
    let usedMockFallback = false;

    if (key_id && key_secret && !isPlaceholderKey(key_id) && !isPlaceholderKey(key_secret)) {
      try {
        const razorpay = new Razorpay({ key_id, key_secret });
        rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: cleanCurrency,
          receipt: cleanReceipt,
          notes: {
            orderId: orderId ? String(orderId) : ''
          }
        });
      } catch (rzpErr) {
        console.warn('Razorpay live SDK order creation failed:', rzpErr.message);
        // If credentials are non-functional in dev or network blocked, fall back to simulated order
        usedMockFallback = true;
      }
    } else {
      usedMockFallback = true;
    }

    if (usedMockFallback || !rzpOrder) {
      // Deterministic fallback mock Razorpay order structure for testing / development
      rzpOrder = {
        id: `order_${crypto.randomBytes(9).toString('hex')}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: cleanCurrency,
        receipt: cleanReceipt,
        status: 'created',
        attempts: 0,
        notes: {
          orderId: orderId ? String(orderId) : ''
        },
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    // Update existing order with razorpayOrderId if present
    if (dbOrder) {
      dbOrder.razorpayOrderId = rzpOrder.id;
      await dbOrder.save();
    } else if (orderId && isValidObjectId(orderId)) {
      await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rzpOrder.id });
    }

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      order: rzpOrder,
      keyId: key_id || 'rzp_test_placeholder',
      isSimulated: usedMockFallback
    });
  } catch (error) {
    console.error('Error in /api/payment/create-order:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating payment order',
      error: error.message
    });
  }
});

// ============================================================
// 2. POST /api/payment/verify
// Verifies Razorpay HMAC-SHA256 signature
// (razorpay_order_id|razorpay_payment_id) against RAZORPAY_KEY_SECRET.
// Upon success, sets order paymentStatus to 'Paid' and captures payment ID.
// ============================================================
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: 'Server payment configuration error: RAZORPAY_KEY_SECRET is missing.'
      });
    }

    // Calculate HMAC-SHA256 signature
    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    // Timing-safe comparison to prevent timing attack vulnerabilities
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const actualBuf = Buffer.from(String(razorpay_signature), 'utf-8');

    const isAuthentic = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Verification failed.'
      });
    }

    // Locate matching order if orderId or razorpay_order_id provided
    let matchedOrder = null;
    if (orderId) {
      if (isValidObjectId(orderId)) {
        matchedOrder = await Order.findById(orderId);
      } else {
        matchedOrder = await Order.findOne({ $or: [{ orderId }, { razorpayOrderId: orderId }] });
      }
    }

    if (!matchedOrder && razorpay_order_id) {
      matchedOrder = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    }

    // If order found, update status and deduct stock safely (Concurrency & Safety requirement 4)
    if (matchedOrder) {
      matchedOrder.paymentStatus = 'Paid';
      matchedOrder.paymentReference = razorpay_payment_id;
      matchedOrder.razorpayOrderId = razorpay_order_id;
      matchedOrder.razorpayPaymentId = razorpay_payment_id;
      matchedOrder.razorpaySignature = razorpay_signature;
      matchedOrder.paymentUpdatedAt = new Date();

      // Deduct stock if not already deducted
      if (!matchedOrder.stockDeducted && Array.isArray(matchedOrder.items) && matchedOrder.items.length > 0) {
        const deductedItems = [];
        let stockError = null;

        for (const item of matchedOrder.items) {
          if (!item.product) continue;
          const productId = item.product._id ? item.product._id : item.product;

          let updatedProduct = null;
          if (item.selectedVariant && item.selectedVariant.variantId) {
            updatedProduct = await Product.findOneAndUpdate(
              {
                _id: productId,
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
            updatedProduct = await Product.findOneAndUpdate(
              { _id: productId, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } },
              { new: true }
            );
          }

          if (!updatedProduct) {
            stockError = `Insufficient stock for product "${item.name}".`;
            break;
          }

          if (updatedProduct.stock <= 0) {
            await Product.findOneAndUpdate({ _id: productId, stock: { $lte: 0 } }, { inStock: false });
          }

          deductedItems.push({
            productId,
            quantity: item.quantity,
            variantId: item.selectedVariant?.variantId || null
          });
        }

        if (stockError) {
          // Rollback any items deducted in this pass
          for (const ded of deductedItems) {
            try {
              if (ded.variantId) {
                await Product.findOneAndUpdate(
                  { _id: ded.productId, 'variants.variantId': ded.variantId },
                  { $inc: { 'variants.$.stock': ded.quantity, stock: ded.quantity }, inStock: true }
                );
              } else {
                await Product.findByIdAndUpdate(ded.productId, {
                  $inc: { stock: ded.quantity },
                  inStock: true
                });
              }
            } catch (rbErr) {}
          }

          matchedOrder.status = 'Action Required';
          matchedOrder.statusNote = stockError;
          await matchedOrder.save();

          return res.status(409).json({
            success: false,
            message: `Payment verified but stock allocation failed: ${stockError}`,
            order: matchedOrder
          });
        }

        matchedOrder.stockDeducted = true;
      }

      await matchedOrder.save();

      // Transactional Email: Order Confirmation with PDF Invoice (Requirement 3)
      (async () => {
        try {
          const pdfBuffer = await generateInvoicePDF(matchedOrder);
          let recipientEmail = matchedOrder.shippingAddress?.email;
          if (!recipientEmail && matchedOrder.user) {
            const u = await User.findById(matchedOrder.user).select('email name');
            recipientEmail = u?.email;
          }
          if (recipientEmail) {
            await sendOrderConfirmationEmail(matchedOrder, pdfBuffer, recipientEmail);
          }
        } catch (mailErr) {
          console.warn('Order confirmation email warning on payment verify:', mailErr.message);
        }
      })();

      return res.status(200).json({
        success: true,
        message: 'Payment signature verified successfully. Order marked as Paid.',
        order: matchedOrder,
        paymentId: razorpay_payment_id
      });
    }

    // If no order ID was linked (e.g. signature verification unit test)
    return res.status(200).json({
      success: true,
      message: 'Payment signature verified successfully.',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    });
  } catch (error) {
    console.error('Error in /api/payment/verify:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while verifying payment',
      error: error.message
    });
  }
});

// ============================================================
// 3. POST /api/payment/webhook
// Validates webhook raw signature and safely updates order statuses
// on events like payment.captured or payment.failed
// ============================================================
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing X-Razorpay-Signature header in webhook request.'
      });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured on server.'
      });
    }

    // Determine raw payload representation
    let rawPayload = '';
    if (req.rawBody) {
      rawPayload = req.rawBody.toString('utf-8');
    } else if (typeof req.body === 'string') {
      rawPayload = req.body;
    } else {
      rawPayload = JSON.stringify(req.body);
    }

    // Calculate expected HMAC SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const actualBuf = Buffer.from(String(signature), 'utf-8');

    const isAuthentic = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature.'
      });
    }

    // Parse body if it was raw string
    const eventPayload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = eventPayload.event;
    const payload = eventPayload.payload;

    // Handle payment.captured or order.paid
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = payload?.payment?.entity;
      const rzpOrderId = payment?.order_id;
      const paymentId = payment?.id;
      const orderId = payment?.notes?.orderId;

      let order = null;
      if (orderId && isValidObjectId(orderId)) {
        order = await Order.findById(orderId);
      }
      if (!order && rzpOrderId) {
        order = await Order.findOne({ razorpayOrderId: rzpOrderId });
      }

      if (order) {
        if (order.paymentStatus !== 'Paid') {
          order.paymentStatus = 'Paid';
          order.paymentReference = paymentId || order.paymentReference;
          order.razorpayPaymentId = paymentId || order.razorpayPaymentId;
          order.paymentUpdatedAt = new Date();

          // Deduct stock if not already deducted
          if (!order.stockDeducted && Array.isArray(order.items)) {
            for (const item of order.items) {
              if (!item.product) continue;
              const prodId = item.product._id ? item.product._id : item.product;
              if (item.selectedVariant && item.selectedVariant.variantId) {
                await Product.findOneAndUpdate(
                  {
                    _id: prodId,
                    'variants.variantId': item.selectedVariant.variantId,
                    'variants.stock': { $gte: item.quantity }
                  },
                  {
                    $inc: {
                      'variants.$.stock': -item.quantity,
                      stock: -item.quantity
                    }
                  }
                );
              } else {
                await Product.findOneAndUpdate(
                  { _id: prodId, stock: { $gte: item.quantity } },
                  { $inc: { stock: -item.quantity } }
                );
              }
            }
            order.stockDeducted = true;
          }

          await order.save();
        }
      }
    } else if (event === 'payment.failed') {
      const payment = payload?.payment?.entity;
      const rzpOrderId = payment?.order_id;
      const paymentId = payment?.id;
      const orderId = payment?.notes?.orderId;

      let order = null;
      if (orderId && isValidObjectId(orderId)) {
        order = await Order.findById(orderId);
      }
      if (!order && rzpOrderId) {
        order = await Order.findOne({ razorpayOrderId: rzpOrderId });
      }

      if (order && order.paymentStatus === 'Pending') {
        order.paymentStatus = 'Failed';
        order.paymentReference = paymentId || order.paymentReference;
        order.paymentUpdatedAt = new Date();
        await order.save();
      }
    }

    return res.status(200).json({
      status: 'ok',
      event,
      received: true
    });
  } catch (error) {
    console.error('Error in /api/payment/webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing webhook',
      error: error.message
    });
  }
});

module.exports = router;
