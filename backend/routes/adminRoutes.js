const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const analyticsRoutes = require('./analyticsRoutes');
const { sendOrderStatusEmail } = require('../config/mailer');

// All admin routes require JWT authentication + Admin role authorization
router.use(authMiddleware, adminMiddleware);

// Mount dedicated analytics sub-router
router.use('/analytics', analyticsRoutes);

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Allowed order status enum for status updates
const ALLOWED_ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

// Allowed payment status enum for status updates
const ALLOWED_PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed'];

// ============================================================
// 1. GET /api/admin/dashboard - Summary statistics from MongoDB
// ============================================================
router.get('/dashboard', async (req, res) => {
  try {
    const [usersCount, productsCount, ordersCount, pendingOrdersCount, sellersCount, pendingSellersCount, reviewsAgg] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'Pending' }),
      User.countDocuments({ role: 'seller' }),
      User.countDocuments({ role: 'seller', 'sellerDetails.verificationStatus': 'pending' }),
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
        sellers: sellersCount,
        pendingSellers: pendingSellersCount,
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
    const { status, paymentStatus, carrier, trackingNumber, location, note } = req.body;

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

    const previousStatus = order.status;
    // Update status
    order.status = status;

    // Update payment status if provided
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      order.paymentUpdatedAt = new Date();
    }

    // Ensure tracking object exists
    if (!order.tracking) {
      order.tracking = {
        carrier: 'MiniStore Express',
        trackingNumber: `MS-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
        estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        history: []
      };
    }

    if (carrier && typeof carrier === 'string' && carrier.trim()) {
      order.tracking.carrier = carrier.trim();
    }
    if (trackingNumber && typeof trackingNumber === 'string' && trackingNumber.trim()) {
      order.tracking.trackingNumber = trackingNumber.trim();
    }

    // Append new tracking checkpoint if status changed or history is empty
    if (previousStatus !== status || !Array.isArray(order.tracking.history) || order.tracking.history.length === 0) {
      const stageTitles = {
        'Pending': 'Order Placed & Awaiting Processing',
        'Processing': 'Order Packed & Quality Inspected',
        'Shipped': `Dispatched via ${order.tracking.carrier || 'MiniStore Express'}`,
        'Out for Delivery': 'Out for Delivery with Courier Executive',
        'Delivered': 'Delivered Successfully to Customer',
        'Cancelled': 'Order Cancelled'
      };

      const defaultNotes = {
        'Pending': 'Order received and confirmed in MiniStore system.',
        'Processing': 'Item(s) packed in secure packaging and ready for dispatch.',
        'Shipped': `Handed over to carrier. AWB #${order.tracking.trackingNumber || 'N/A'}.`,
        'Out for Delivery': 'Package has arrived at your local delivery hub and is out for doorstep delivery.',
        'Delivered': 'Shipment delivered to recipient.',
        'Cancelled': 'Order was cancelled.'
      };

      if (!Array.isArray(order.tracking.history)) {
        order.tracking.history = [];
      }

      order.tracking.history.push({
        status,
        title: stageTitles[status] || `Status updated to ${status}`,
        description: note || defaultNotes[status] || '',
        location: location || (status === 'Delivered' ? 'Customer Destination' : (status === 'Out for Delivery' ? 'Local Delivery Hub' : 'Fulfillment Hub')),
        timestamp: new Date()
      });
    }

    const updatedOrder = await order.save();
    await updatedOrder.populate('user', 'name email');

    // Transactional Email: Shipping / Delivery Status Notification (Requirement 3)
    if (previousStatus !== status && (status === 'Shipped' || status === 'Delivered')) {
      (async () => {
        try {
          const recipient = updatedOrder.user?.email || updatedOrder.shippingAddress?.email;
          if (recipient) {
            await sendOrderStatusEmail(updatedOrder, status, recipient);
          }
        } catch (mailErr) {
          console.warn('Status notification email error:', mailErr.message);
        }
      })();
    }

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

// ============================================================
// 6. Live Sales & Campaigns Management (Admin)
// ============================================================
const {
  getLiveSaleCampaign,
  endLiveSale,
  resumeLiveSale,
  extendLiveSale,
  updateLiveSale,
  FESTIVE_DEALS_CATALOG
} = require('../config/festiveDeals');

// GET /api/admin/sales - Get live sale campaign and configuration
router.get('/sales', async (req, res) => {
  try {
    const campaign = await getLiveSaleCampaign();
    const now = Date.now();
    const endMs = new Date(campaign.endDate).getTime();
    const remainingMs = Math.max(0, endMs - now);
    const isLive = Boolean(campaign.isActive && remainingMs > 0);

    const catalogItems = Object.entries(FESTIVE_DEALS_CATALOG).map(([name, rule]) => ({
      name,
      discountPct: rule.discountPct
    }));

    res.status(200).json({
      success: true,
      data: {
        _id: campaign._id,
        name: campaign.name,
        tagline: campaign.tagline,
        bannerBadge: campaign.bannerBadge,
        saleType: campaign.saleType,
        isActive: campaign.isActive,
        isLive,
        status: isLive ? 'LIVE' : (!campaign.isActive ? 'ENDED' : 'EXPIRED'),
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        remainingMs,
        discountPctMax: campaign.discountPctMax || 60,
        couponCode: campaign.couponCode,
        couponDiscount: campaign.couponDiscount,
        discountDescription: campaign.discountDescription,
        discountedProductsCount: catalogItems.length,
        catalogItems,
        history: campaign.history || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving admin sales data',
      error: error.message
    });
  }
});

// POST /api/admin/sales/end - End current live sale immediately
router.post('/sales/end', async (req, res) => {
  try {
    const adminName = req.user?.name || 'Store Admin';
    const updatedCampaign = await endLiveSale(adminName);

    res.status(200).json({
      success: true,
      message: `Sale "${updatedCampaign.name}" has been ended. Storefront prices restored to regular.`,
      data: {
        isActive: false,
        isLive: false,
        status: 'ENDED',
        campaign: updatedCampaign
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error ending live sale',
      error: error.message
    });
  }
});

// POST /api/admin/sales/resume - Resume or reactivate live sale
router.post('/sales/resume', async (req, res) => {
  try {
    const adminName = req.user?.name || 'Store Admin';
    const updatedCampaign = await resumeLiveSale(adminName);

    res.status(200).json({
      success: true,
      message: `Sale "${updatedCampaign.name}" is now Live! Deals and banners are active.`,
      data: {
        isActive: true,
        isLive: true,
        status: 'LIVE',
        campaign: updatedCampaign
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error resuming live sale',
      error: error.message
    });
  }
});

// POST /api/admin/sales/extend - Extend live sale countdown
router.post('/sales/extend', async (req, res) => {
  try {
    const { hours, customEndDate } = req.body;
    const adminName = req.user?.name || 'Store Admin';

    if (!hours && !customEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either extension hours or customEndDate'
      });
    }

    const updatedCampaign = await extendLiveSale(hours || 24, customEndDate, adminName);

    res.status(200).json({
      success: true,
      message: `Sale "${updatedCampaign.name}" extended successfully until ${new Date(updatedCampaign.endDate).toLocaleString()}!`,
      data: {
        isActive: updatedCampaign.isActive,
        isLive: true,
        status: 'LIVE',
        endDate: updatedCampaign.endDate,
        campaign: updatedCampaign
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error extending live sale',
      error: error.message
    });
  }
});

// PUT /api/admin/sales/update - Update sale campaign details
router.put('/sales/update', async (req, res) => {
  try {
    const adminName = req.user?.name || 'Store Admin';
    const updatedCampaign = await updateLiveSale(req.body, adminName);

    res.status(200).json({
      success: true,
      message: 'Sale campaign settings updated successfully.',
      data: updatedCampaign
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating sale campaign settings',
      error: error.message
    });
  }
});

// ============================================================
// 10. Admin Coupon Management
// ============================================================

// GET /api/admin/coupons - List all coupons
router.get('/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: coupons.length,
      data: coupons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving admin coupons',
      error: error.message
    });
  }
});

// POST /api/admin/coupons - Create new coupon
router.post('/coupons', async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      expiryDate,
      usageLimit
    } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required.'
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check duplicate
    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Coupon with code "${cleanCode}" already exists.`
      });
    }

    const type = discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT';
    const value = parseFloat(discountValue);

    if (isNaN(value) || value <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be a positive number.'
      });
    }

    if (type === 'PERCENTAGE' && value > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%.'
      });
    }

    if (!expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date is required.'
      });
    }

    const parsedExpiry = new Date(expiryDate);
    if (isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expiry date format.'
      });
    }

    const newCoupon = new Coupon({
      code: cleanCode,
      description: description ? description.trim() : '',
      discountType: type,
      discountValue: value,
      minOrderAmount: Math.max(parseFloat(minOrderAmount) || 0, 0),
      maxDiscountAmount: maxDiscountAmount ? Math.max(parseFloat(maxDiscountAmount) || 0, 0) : null,
      expiryDate: parsedExpiry,
      usageLimit: usageLimit ? Math.max(parseInt(usageLimit, 10) || 1, 1) : null,
      isActive: true,
      createdBy: req.user?.name || 'Admin'
    });

    const savedCoupon = await newCoupon.save();

    res.status(201).json({
      success: true,
      message: `Coupon "${savedCoupon.code}" created successfully!`,
      data: savedCoupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating coupon',
      error: error.message
    });
  }
});

// PUT /api/admin/coupons/:id/toggle - Toggle coupon status
router.put('/coupons/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon ID'
      });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" is now ${coupon.isActive ? 'Active' : 'Disabled'}.`,
      data: coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error toggling coupon status',
      error: error.message
    });
  }
});

// DELETE /api/admin/coupons/:id - Delete coupon
router.delete('/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon ID'
      });
    }

    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" deleted successfully.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting coupon',
      error: error.message
    });
  }
});

// ============================================================
// 8. Seller / Merchant Verification Management (Admin)
// ============================================================

// GET /api/admin/sellers - Retrieve all registered sellers
router.get('/sellers', async (req, res) => {
  try {
    const sellers = await User.find(
      { role: 'seller' },
      'name email phone createdAt sellerDetails'
    ).sort({ createdAt: -1 });

    const total = sellers.length;
    let pending = 0;
    let verified = 0;
    let rejected = 0;

    const formattedSellers = sellers.map((seller) => {
      const sd = seller.sellerDetails || {};
      const status = (sd.verificationStatus || 'pending').toLowerCase();
      if (status === 'verified') verified++;
      else if (status === 'rejected') rejected++;
      else pending++;

      return {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone || sd.contactNumber || '',
        createdAt: seller.createdAt,
        sellerDetails: {
          businessName: sd.businessName || '—',
          businessAddress: sd.businessAddress || '—',
          contactNumber: sd.contactNumber || seller.phone || '—',
          pan: sd.pan || '—',
          gstin: sd.gstin || 'Not Applicable / Exempt',
          verificationStatus: status
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        verified,
        rejected,
        sellers: formattedSellers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving sellers',
      error: error.message
    });
  }
});

// PUT /api/admin/sellers/:id/verify - Approve or Reject seller verification
router.put('/sellers/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid seller ID format'
      });
    }

    const cleanStatus = (status || '').toLowerCase().trim();
    if (!['verified', 'rejected', 'pending'].includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "verified", "rejected", or "pending".'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Seller user account not found'
      });
    }

    if (user.role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: 'This user account is not a seller.'
      });
    }

    if (!user.sellerDetails) {
      user.sellerDetails = {};
    }

    user.sellerDetails.verificationStatus = cleanStatus;
    await user.save();

    const statusLabel = cleanStatus === 'verified' ? 'Approved & Verified' : (cleanStatus === 'rejected' ? 'Rejected' : 'Marked as Pending');

    res.status(200).json({
      success: true,
      message: `Merchant "${user.sellerDetails.businessName || user.name}" has been ${statusLabel}!`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        sellerDetails: user.sellerDetails
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating seller verification status',
      error: error.message
    });
  }
});

module.exports = router;

