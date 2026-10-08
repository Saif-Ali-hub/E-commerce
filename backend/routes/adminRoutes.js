const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const analyticsRoutes = require('./analyticsRoutes');

// All admin routes require JWT authentication + Admin role authorization
router.use(authMiddleware, adminMiddleware);

// Mount dedicated analytics sub-router
router.use('/analytics', analyticsRoutes);

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Allowed order status enum for status updates
const ALLOWED_ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

// Allowed payment status enum for status updates
const ALLOWED_PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed'];

// ============================================================
// 1. GET /api/admin/dashboard - Summary statistics from MongoDB
// ============================================================
router.get('/dashboard', async (req, res) => {
  try {
    const [usersCount, productsCount, ordersCount, pendingOrdersCount, reviewsAgg] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'Pending' }),
      Product.aggregate([
        { $project: { count: { $size: { $ifNull: ['$reviews', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ])
    ]);

    const reviewsCount = reviewsAgg[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        users: usersCount,
        products: productsCount,
        orders: ordersCount,
        pendingOrders: pendingOrdersCount,
        reviews: reviewsCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard statistics',
      error: error.message
    });
  }
});

// ============================================================
// 2. GET /api/admin/orders - Retrieve all orders from all users
// ============================================================
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving admin orders',
      error: error.message
    });
  }
});

// ============================================================
// 3. PUT /api/admin/orders/:id/status - Update order fulfillment status
// ============================================================
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    // Validate status presence and allowed values
    if (!status || !ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status. Allowed values are: ${ALLOWED_ORDER_STATUSES.join(', ')}`
      });
    }

    // Validate optional paymentStatus if provided
    if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Allowed values are: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`
      });
    }

    // Find order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update status
    order.status = status;

    // Update payment status if provided
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      order.paymentUpdatedAt = new Date();
    }

    const updatedOrder = await order.save();
    await updatedOrder.populate('user', 'name email');

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating order status',
      error: error.message
    });
  }
});

// ============================================================
// 3b. PUT /api/admin/orders/:id/payment-status - Update payment status
// ============================================================
router.put('/orders/:id/payment-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentReference } = req.body;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    // Validate payment status presence and allowed values
    if (!paymentStatus || !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Allowed values are: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`
      });
    }

    // Find order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update payment status and timestamp
    order.paymentStatus = paymentStatus;
    order.paymentUpdatedAt = new Date();
    if (paymentReference !== undefined) {
      order.paymentReference = paymentReference ? String(paymentReference).trim() : null;
    }

    const updatedOrder = await order.save();
    await updatedOrder.populate('user', 'name email');

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${paymentStatus} successfully`,
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating payment status',
      error: error.message
    });
  }
});

// ============================================================
// 4. GET /api/admin/reviews - Retrieve all reviews across products
// ============================================================
router.get('/reviews', async (req, res) => {
  try {
    const products = await Product.find(
      { 'reviews.0': { $exists: true } },
      'name image category reviews'
    );

    const allReviews = [];
    products.forEach((product) => {
      product.reviews.forEach((review) => {
        allReviews.push({
          reviewId: review._id,
          productId: product._id,
          productName: product.name,
          productImage: product.image,
          productCategory: product.category,
          userId: review.user,
          userName: review.userName,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt
        });
      });
    });

    // Sort by newest review first
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: allReviews.length,
      data: allReviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving reviews',
      error: error.message
    });
  }
});

// ============================================================
// 5. DELETE /api/admin/reviews/:productId/:reviewId - Admin deletes inappropriate review
// ============================================================
router.delete('/reviews/:productId/:reviewId', async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    if (!isValidObjectId(productId) || !isValidObjectId(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or review ID format'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const reviewIndex = product.reviews.findIndex(
      (r) => r._id.toString() === reviewId.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    product.reviews.splice(reviewIndex, 1);

    // Recalculate average rating and total review count
    product.totalReviews = product.reviews.length;
    if (product.totalReviews === 0) {
      product.averageRating = 0;
    } else {
      const sum = product.reviews.reduce((acc, r) => acc + r.rating, 0);
      product.averageRating = Math.round((sum / product.totalReviews) * 10) / 10;
    }
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully by administrator',
      data: {
        productId,
        reviewId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting review',
      error: error.message
    });
  }
});

module.exports = router;
