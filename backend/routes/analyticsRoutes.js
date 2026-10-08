const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Strictly protect all analytics endpoints with JWT auth + admin authorization
router.use(authMiddleware, adminMiddleware);

const ALLOWED_RANGES = ['7d', '30d', '90d', 'all'];

/**
 * Format a Date object to YYYY-MM-DD
 */
function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object for display (e.g. "Oct 7")
 */
function formatDisplayDate(d) {
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// ============================================================
// GET /api/admin/analytics - Consolidated dynamic analytics
// Query params: ?range=7d|30d|90d|all
// ============================================================
router.get('/', async (req, res) => {
  try {
    const range = req.query.range !== undefined ? req.query.range : '7d';

    // Strictly validate range parameter
    if (!ALLOWED_RANGES.includes(range)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range. Allowed values are: 7d, 30d, 90d, all'
      });
    }

    const now = new Date();
    let startDate = null;
    let dateFilter = {};

    if (range === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: startDate } };
    } else if (range === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: startDate } };
    } else if (range === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: startDate } };
    } else if (range === 'all') {
      dateFilter = {};
    }

    // 1. Fetch orders in the selected range, populated with user info
    const [ordersInRange, totalUsersCount, totalCustomersCount, totalProductsCount, reviewsAgg] = await Promise.all([
      Order.find(dateFilter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments(),
      Product.aggregate([
        { $project: { count: { $size: { $ifNull: ['$reviews', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ])
    ]);

    const totalReviewsCount = reviewsAgg[0]?.total || 0;

    // Fetch all products for category mapping in category analytics
    const allProducts = await Product.find({}, '_id name category').lean();
    const productCategoryMap = new Map(
      allProducts.map((p) => [p._id.toString(), p.category || 'General'])
    );

    // 2. Calculate Overview Metrics
    let totalOrderValue = 0;
    let paidRevenue = 0;
    let pendingPaymentValue = 0;
    let failedPaymentValue = 0;
    let pendingOrdersCount = 0;

    const statusCounts = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0
    };

    // Payment method metrics accumulator
    const paymentMethodStats = {
      UPI: { orders: 0, orderValue: 0, paidAmount: 0, pendingAmount: 0, failedAmount: 0 },
      COD: { orders: 0, orderValue: 0, paidAmount: 0, pendingAmount: 0, failedAmount: 0 },
      NET_BANKING: { orders: 0, orderValue: 0, paidAmount: 0, pendingAmount: 0, failedAmount: 0 },
      NOT_SPECIFIED: { orders: 0, orderValue: 0, paidAmount: 0, pendingAmount: 0, failedAmount: 0 }
    };

    // Product & category sales accumulators
    const productSalesMap = new Map();
    const categorySalesMap = new Map();

    // Map for daily trend calculation
    const dailyMap = new Map();

    // Pre-populate dailyMap for fixed ranges (7d, 30d, 90d) so zero-order days are included
    if (range !== 'all') {
      const daysCount = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = formatDateKey(d);
        dailyMap.set(key, {
          date: key,
          formattedDate: formatDisplayDate(d),
          orders: 0,
          orderValue: 0,
          paidRevenue: 0
        });
      }
    }

    // Process each order in range
    ordersInRange.forEach((order) => {
      const orderTotal = Number(order.totalAmount) || 0;
      const status = order.status || 'Pending';
      const paymentStatus = order.paymentStatus || 'Pending';
      const paymentMethod = order.paymentMethod || 'NOT_SPECIFIED';
      const isCancelled = status === 'Cancelled';

      // Status count
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      } else {
        statusCounts[status] = 1;
      }

      if (status === 'Pending') {
        pendingOrdersCount += 1;
      }

      // Non-cancelled orders contribute to revenue values
      if (!isCancelled) {
        totalOrderValue += orderTotal;

        if (paymentStatus === 'Paid') {
          paidRevenue += orderTotal;
        } else if (paymentStatus === 'Failed') {
          failedPaymentValue += orderTotal;
        } else {
          // Default: Pending (or missing/legacy payment status)
          pendingPaymentValue += orderTotal;
        }
      }

      // Payment method stats
      const targetMethod = paymentMethodStats[paymentMethod]
        ? paymentMethod
        : 'NOT_SPECIFIED';

      paymentMethodStats[targetMethod].orders += 1;
      if (!isCancelled) {
        paymentMethodStats[targetMethod].orderValue += orderTotal;
        if (paymentStatus === 'Paid') {
          paymentMethodStats[targetMethod].paidAmount += orderTotal;
        } else if (paymentStatus === 'Failed') {
          paymentMethodStats[targetMethod].failedAmount += orderTotal;
        } else {
          paymentMethodStats[targetMethod].pendingAmount += orderTotal;
        }
      }

      // Daily trend mapping
      const orderDate = new Date(order.createdAt);
      const dateKey = formatDateKey(orderDate);

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          formattedDate: formatDisplayDate(orderDate),
          orders: 0,
          orderValue: 0,
          paidRevenue: 0
        });
      }

      const dayObj = dailyMap.get(dateKey);
      dayObj.orders += 1;
      if (!isCancelled) {
        dayObj.orderValue += orderTotal;
        if (paymentStatus === 'Paid') {
          dayObj.paidRevenue += orderTotal;
        }
      }

      // Item-level analytics: Top products & Category sales (non-cancelled only)
      if (!isCancelled && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          const itemSubtotal = item.subtotal !== undefined ? Number(item.subtotal) : price * qty;
          const prodId = item.product ? item.product.toString() : item.name;
          const prodName = item.name || 'Unnamed Product';

          // Top products accumulator
          if (!productSalesMap.has(prodId)) {
            productSalesMap.set(prodId, {
              productId: item.product ? item.product.toString() : null,
              name: prodName,
              unitsSold: 0,
              salesValue: 0
            });
          }
          const pStat = productSalesMap.get(prodId);
          pStat.unitsSold += qty;
          pStat.salesValue += itemSubtotal;

          // Category sales accumulator
          const category = productCategoryMap.get(prodId) || 'General';
          if (!categorySalesMap.has(category)) {
            categorySalesMap.set(category, {
              category,
              unitsSold: 0,
              salesValue: 0
            });
          }
          const cStat = categorySalesMap.get(category);
          cStat.unitsSold += qty;
          cStat.salesValue += itemSubtotal;
        });
      }
    });

    // 3. Format Sales Trend (chronological order)
    const salesTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        orderValue: Math.round(item.orderValue * 100) / 100,
        paidRevenue: Math.round(item.paidRevenue * 100) / 100
      }));

    // 4. Format Order Status Breakdown
    const totalOrdersInRange = ordersInRange.length;
    const orderStatusBreakdown = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((st) => {
      const count = statusCounts[st] || 0;
      const percentage = totalOrdersInRange > 0
        ? Math.round((count / totalOrdersInRange) * 1000) / 10
        : 0;
      return {
        status: st,
        count,
        percentage
      };
    });

    // 5. Format Payment Analytics
    const paymentMethodsList = [
      {
        method: 'UPI',
        name: 'UPI',
        ...paymentMethodStats.UPI,
        orderValue: Math.round(paymentMethodStats.UPI.orderValue * 100) / 100,
        paidAmount: Math.round(paymentMethodStats.UPI.paidAmount * 100) / 100,
        pendingAmount: Math.round(paymentMethodStats.UPI.pendingAmount * 100) / 100,
        failedAmount: Math.round(paymentMethodStats.UPI.failedAmount * 100) / 100
      },
      {
        method: 'COD',
        name: 'Cash on Delivery',
        ...paymentMethodStats.COD,
        orderValue: Math.round(paymentMethodStats.COD.orderValue * 100) / 100,
        paidAmount: Math.round(paymentMethodStats.COD.paidAmount * 100) / 100,
        pendingAmount: Math.round(paymentMethodStats.COD.pendingAmount * 100) / 100,
        failedAmount: Math.round(paymentMethodStats.COD.failedAmount * 100) / 100
      },
      {
        method: 'NET_BANKING',
        name: 'Net Banking',
        ...paymentMethodStats.NET_BANKING,
        orderValue: Math.round(paymentMethodStats.NET_BANKING.orderValue * 100) / 100,
        paidAmount: Math.round(paymentMethodStats.NET_BANKING.paidAmount * 100) / 100,
        pendingAmount: Math.round(paymentMethodStats.NET_BANKING.pendingAmount * 100) / 100,
        failedAmount: Math.round(paymentMethodStats.NET_BANKING.failedAmount * 100) / 100
      }
    ];

    // Include historical orders without payment fields if any exist
    if (paymentMethodStats.NOT_SPECIFIED.orders > 0) {
      paymentMethodsList.push({
        method: 'NOT_SPECIFIED',
        name: 'Not Specified (Legacy)',
        ...paymentMethodStats.NOT_SPECIFIED,
        orderValue: Math.round(paymentMethodStats.NOT_SPECIFIED.orderValue * 100) / 100,
        paidAmount: Math.round(paymentMethodStats.NOT_SPECIFIED.paidAmount * 100) / 100,
        pendingAmount: Math.round(paymentMethodStats.NOT_SPECIFIED.pendingAmount * 100) / 100,
        failedAmount: Math.round(paymentMethodStats.NOT_SPECIFIED.failedAmount * 100) / 100
      });
    }

    // 6. Format Top-Selling Products (sorted by unitsSold descending, then salesValue)
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold || b.salesValue - a.salesValue)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        salesValue: Math.round(p.salesValue * 100) / 100
      }));

    // 7. Format Category Sales (sorted by salesValue descending)
    const categorySales = Array.from(categorySalesMap.values())
      .sort((a, b) => b.salesValue - a.salesValue)
      .map((c) => ({
        ...c,
        salesValue: Math.round(c.salesValue * 100) / 100
      }));

    // 8. Format Recent Orders (up to 10 latest)
    const recentOrders = ordersInRange.slice(0, 10).map((o) => ({
      orderId: o._id,
      customerName: o.user ? o.user.name : 'Unknown User',
      customerEmail: o.user ? o.user.email : '',
      date: o.createdAt,
      totalAmount: Math.round((Number(o.totalAmount) || 0) * 100) / 100,
      orderStatus: o.status || 'Pending',
      paymentMethod: o.paymentMethod || null,
      paymentStatus: o.paymentStatus || 'Pending',
      itemsCount: Array.isArray(o.items) ? o.items.length : 0
    }));

    // 9. Send consolidated structured response
    res.status(200).json({
      success: true,
      data: {
        range,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: now.toISOString(),
        overview: {
          totalOrderValue: Math.round(totalOrderValue * 100) / 100,
          paidRevenue: Math.round(paidRevenue * 100) / 100,
          pendingPaymentValue: Math.round(pendingPaymentValue * 100) / 100,
          failedPaymentValue: Math.round(failedPaymentValue * 100) / 100,
          totalOrders: totalOrdersInRange,
          totalCustomers: totalCustomersCount,
          totalUsers: totalUsersCount,
          totalProducts: totalProductsCount,
          pendingOrders: pendingOrdersCount,
          totalReviews: totalReviewsCount
        },
        salesTrend,
        orderStatus: {
          breakdown: orderStatusBreakdown,
          total: totalOrdersInRange
        },
        paymentAnalytics: {
          methods: paymentMethodsList
        },
        topProducts,
        categorySales,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating analytics',
      error: error.message
    });
  }
});

module.exports = router;
