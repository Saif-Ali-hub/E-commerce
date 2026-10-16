const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const authMiddleware = require('../middleware/auth');
const { sellerOrAdminMiddleware } = require('../middleware/seller');
const { sendOrderStatusEmail } = require('../config/mailer');

// Helper to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Apply auth and seller/admin verification to ALL seller routes
router.use(authMiddleware);
router.use(sellerOrAdminMiddleware);

// ============================================================================
// 1. GET /api/seller/overview
// Aggregate KPI metrics and recent orders for authenticated merchant or admin platform overview
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const isAdmin = req.sellerUser && req.sellerUser.role === 'admin';
    const querySellerId = req.query.sellerId;
    const targetSellerId = (isAdmin && querySellerId && querySellerId !== 'all')
      ? querySellerId
      : (isAdmin && (!querySellerId || querySellerId === 'all') ? null : req.user.id);

    let products;
    let productIds;
    let activeProducts;
    let lowStockCount;
    let orders;

    if (isAdmin && !targetSellerId) {
      // Platform-wide overview for administrator
      products = await Product.find();
      productIds = products.map((p) => p._id.toString());
      activeProducts = products.length;
      lowStockCount = products.filter((p) => p.stock < 5).length;
      orders = await Order.find().sort({ createdAt: -1 });
    } else {
      // Isolated merchant overview
      products = await Product.find({ seller: targetSellerId });
      productIds = products.map((p) => p._id.toString());
      activeProducts = products.length;
      lowStockCount = products.filter((p) => p.stock < 5).length;
      orders = await Order.find({
        $or: [
          { 'items.seller': targetSellerId },
          { 'items.product': { $in: products.map((p) => p._id) } }
        ]
      }).sort({ createdAt: -1 });
    }

    let totalRevenue = 0;
    let totalUnitsSold = 0;
    let pendingOrders = 0;

    const formattedRecentOrders = [];

    for (const order of orders) {
      const isCancelled = order.status === 'Cancelled';

      // Sliced items belonging strictly to this seller (or all items if admin platform view)
      const sellerItems = (order.items || []).filter((item) => {
        if (isAdmin && !targetSellerId) return true;
        const itemSeller = item.seller ? item.seller.toString() : null;
        const itemProd = item.product
          ? item.product._id
            ? item.product._id.toString()
            : item.product.toString()
          : null;
        return (
          itemSeller === targetSellerId.toString() ||
          (itemProd && productIds.includes(itemProd))
        );
      });

      const orderSellerTotal = (isAdmin && !targetSellerId)
        ? (order.totalAmount || order.total || sellerItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0))
        : sellerItems.reduce(
            (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
            0
          );

      if (!isCancelled) {
        totalRevenue += orderSellerTotal;
        totalUnitsSold += sellerItems.reduce(
          (sum, it) => sum + (it.quantity || 1),
          0
        );
      }

      if (order.status === 'Pending' || order.status === 'Processing') {
        pendingOrders++;
      }

      if (formattedRecentOrders.length < 10) {
        formattedRecentOrders.push({
          _id: order._id,
          orderId: order.orderId || order._id,
          createdAt: order.createdAt,
          status: order.status,
          paymentStatus: order.paymentStatus,
          customerName: order.shippingAddress?.fullName || 'Customer',
          sellerItemsCount: sellerItems.length,
          sellerTotal: Math.round(orderSellerTotal * 100) / 100
        });
      }
    }

    // Commission & Settlement Calculation (10% platform fee, 90% merchant payout)
    const commissionRate = 0.1;
    const platformFee = Math.round(totalRevenue * commissionRate * 100) / 100;
    const netPayout = Math.round((totalRevenue - platformFee) * 100) / 100;

    return res.status(200).json({
      success: true,
      data: {
        isPlatformOverview: Boolean(isAdmin && !targetSellerId),
        metrics: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalUnitsSold,
          activeProducts,
          lowStockCount,
          pendingOrders,
          commissionRate,
          platformFee,
          netPayout
        },
        recentOrders: formattedRecentOrders
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve seller overview metrics',
      error: error.message
    });
  }
});

// ============================================================================
// 2. GET /api/seller/products
// Return isolated product catalog for this merchant with search & pagination
// ============================================================================
router.get('/products', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      q,
      stockStatus
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    const filter = {};

    // Multi-tenant check: non-admin can only view their own products
    const isAdmin = req.sellerUser && req.sellerUser.role === 'admin';
    const querySellerId = req.query.sellerId;
    if (isAdmin && querySellerId && querySellerId !== 'all') {
      filter.seller = querySellerId;
    } else if (!isAdmin || req.query.mine === 'true') {
      filter.seller = req.user.id;
    }

    // Category filter
    if (category && category !== 'All' && category !== 'all') {
      filter.category = category;
    }

    // Search query filter
    const queryTerm = (search || q || '').trim();
    if (queryTerm) {
      filter.$or = [
        { name: { $regex: queryTerm, $options: 'i' } },
        { title: { $regex: queryTerm, $options: 'i' } },
        { sku: { $regex: queryTerm, $options: 'i' } },
        { brand: { $regex: queryTerm, $options: 'i' } }
      ];
    }

    // Stock status filter
    if (stockStatus === 'low') {
      filter.stock = { $gt: 0, $lt: 5 };
    } else if (stockStatus === 'out') {
      filter.stock = { $lte: 0 };
    } else if (stockStatus === 'in') {
      filter.stock = { $gte: 5 };
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: products
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve seller products',
      error: error.message
    });
  }
});

// ============================================================================
// 3. POST /api/seller/products
// Merchant product listing with automatic seller tenancy attribution
// ============================================================================
router.post('/products', async (req, res) => {
  try {
    const {
      name,
      title,
      price,
      discountPrice,
      category,
      subcategory,
      brand,
      sku,
      description,
      stock,
      image,
      images,
      features,
      specifications,
      variants
    } = req.body;

    // Validate required fields
    if (!name && !title) {
      return res.status(400).json({
        success: false,
        message: 'Product name or title is required'
      });
    }

    if (price === undefined || price === null || isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive price is required'
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product category is required'
      });
    }

    if (stock === undefined || stock === null || isNaN(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid non-negative stock count is required'
      });
    }

    const sellerBusinessName =
      req.sellerUser?.sellerDetails?.businessName ||
      req.sellerUser?.name ||
      'Merchant';

    const cleanImages =
      Array.isArray(images) && images.length > 0
        ? images
        : image
        ? [image]
        : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'];

    const newProduct = new Product({
      name: (name || title).trim(),
      title: (title || name).trim(),
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      category: category.trim(),
      subcategory: subcategory ? subcategory.trim() : '',
      brand: brand ? brand.trim() : sellerBusinessName,
      sku: sku ? sku.trim() : undefined,
      description: description ? description.trim() : '',
      stock: Number(stock),
      inStock: Number(stock) > 0,
      image: cleanImages[0],
      images: cleanImages,
      features: Array.isArray(features) ? features : [],
      specifications: specifications || {},
      variants: Array.isArray(variants) ? variants : [],
      seller: req.user.id,
      sellerName: sellerBusinessName
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      success: true,
      message: 'Product listed successfully in merchant catalog',
      data: savedProduct
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create merchant product',
      error: error.message
    });
  }
});

// ============================================================================
// 4. PUT /api/seller/products/:id
// Update product with strict multi-tenant ownership verification
// ============================================================================
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Multi-tenant check: verified seller can ONLY edit their own product
    const isAdmin = req.sellerUser && req.sellerUser.role === 'admin';
    const isOwner =
      product.seller && product.seller.toString() === req.user.id.toString();

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this product.'
      });
    }

    // Apply allowed update fields
    const {
      name,
      title,
      price,
      discountPrice,
      category,
      subcategory,
      brand,
      description,
      stock,
      image,
      images,
      features,
      specifications,
      variants
    } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (title !== undefined) product.title = title.trim();
    if (price !== undefined) product.price = Number(price);
    if (discountPrice !== undefined)
      product.discountPrice = discountPrice ? Number(discountPrice) : null;
    if (category !== undefined) product.category = category.trim();
    if (subcategory !== undefined) product.subcategory = subcategory.trim();
    if (brand !== undefined) product.brand = brand.trim();
    if (description !== undefined) product.description = description.trim();
    if (stock !== undefined) {
      product.stock = Number(stock);
      product.inStock = product.stock > 0;
    }
    if (images && Array.isArray(images) && images.length > 0) {
      product.images = images;
      product.image = images[0];
    } else if (image) {
      product.image = image;
      product.images = [image];
    }
    if (features && Array.isArray(features)) product.features = features;
    if (specifications) product.specifications = specifications;
    if (variants !== undefined && Array.isArray(variants)) product.variants = variants;

    const updatedProduct = await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update merchant product',
      error: error.message
    });
  }
});

// ============================================================================
// 5. DELETE /api/seller/products/:id
// Remove product with strict multi-tenant ownership verification
// ============================================================================
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Multi-tenant check: verified seller can ONLY delete their own product
    const isAdmin = req.sellerUser && req.sellerUser.role === 'admin';
    const isOwner =
      product.seller && product.seller.toString() === req.user.id.toString();

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this product.'
      });
    }

    await Product.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully from merchant catalog'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete merchant product',
      error: error.message
    });
  }
});

// ============================================================================
// 6. GET /api/seller/orders
// Returns orders containing seller's items with strict multi-tenant item slicing
// ============================================================================
router.get('/orders', async (req, res) => {
  try {
    const isAdmin = req.sellerUser && req.sellerUser.role === 'admin';
    const querySellerId = req.query.sellerId;
    const targetSellerId = (isAdmin && querySellerId && querySellerId !== 'all')
      ? querySellerId
      : (isAdmin && (!querySellerId || querySellerId === 'all') ? null : req.user.id);

    let orders;
    let sellerProductIds = [];

    if (isAdmin && !targetSellerId) {
      orders = await Order.find().sort({ createdAt: -1 });
    } else {
      // Retrieve all products owned by this seller
      const sellerProducts = await Product.find({ seller: targetSellerId }).select('_id');
      sellerProductIds = sellerProducts.map((p) => p._id.toString());

      // Find orders containing this seller's items
      orders = await Order.find({
        $or: [
          { 'items.seller': targetSellerId },
          { 'items.product': { $in: sellerProducts.map((p) => p._id) } }
        ]
      }).sort({ createdAt: -1 });
    }

    // Multi-tenant Privacy Slicing:
    // Strip out all other sellers' products so Seller A never sees Seller B's items
    const filteredOrders = orders.map((order) => {
      const orderObj = order.toObject ? order.toObject() : { ...order };

      const sellerItems = (orderObj.items || []).filter((item) => {
        if (isAdmin && !targetSellerId) return true;
        const itemSellerId = item.seller ? item.seller.toString() : null;
        const itemProdId = item.product
          ? item.product._id
            ? item.product._id.toString()
            : item.product.toString()
          : null;
        return (
          itemSellerId === targetSellerId.toString() ||
          (itemProdId && sellerProductIds.includes(itemProdId))
        );
      });

      const sellerOrderTotal = (isAdmin && !targetSellerId)
        ? (orderObj.totalAmount || orderObj.total || sellerItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0))
        : sellerItems.reduce(
            (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
            0
          );

      return {
        _id: orderObj._id,
        orderId: orderObj.orderId || orderObj._id,
        createdAt: orderObj.createdAt,
        status: orderObj.status,
        paymentMethod: orderObj.paymentMethod,
        paymentStatus: orderObj.paymentStatus,
        shippingAddress: orderObj.shippingAddress,
        tracking: orderObj.tracking,
        items: sellerItems,
        sellerTotal: Math.round(sellerOrderTotal * 100) / 100
      };
    });

    return res.status(200).json({
      success: true,
      count: filteredOrders.length,
      data: filteredOrders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve merchant orders',
      error: error.message
    });
  }
});

// ============================================================================
// 7. PUT /api/seller/orders/:id/dispatch
// Mark order as shipped with tracking and trigger customer notification email
// ============================================================================
router.put('/orders/:id/dispatch', async (req, res) => {
  try {
    const { id } = req.params;
    const { carrier, trackingNumber, notes } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify order contains this seller's products
    const sellerProducts = await Product.find({ seller: req.user.id }).select('_id');
    const sellerProductIds = sellerProducts.map((p) => p._id.toString());
    const isAdmin = req.sellerUser && req.sellerUser.role === 'admin';

    const hasSellerItem = (order.items || []).some((item) => {
      const itemSellerId = item.seller ? item.seller.toString() : null;
      const itemProdId = item.product
        ? item.product._id
          ? item.product._id.toString()
          : item.product.toString()
        : null;
      return (
        itemSellerId === req.user.id.toString() ||
        (itemProdId && sellerProductIds.includes(itemProdId))
      );
    });

    if (!hasSellerItem && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. This order does not contain your merchant items.'
      });
    }

    const courierCarrier =
      carrier && carrier.trim() ? carrier.trim() : order.tracking?.carrier || 'Nexura Express';
    const courierTracking =
      trackingNumber && trackingNumber.trim()
        ? trackingNumber.trim()
        : order.tracking?.trackingNumber || `NX-TRK-${order._id.toString().slice(-6).toUpperCase()}`;

    // Update order status & tracking details
    order.status = 'Shipped';
    if (!order.tracking) {
      order.tracking = { carrier: courierCarrier, trackingNumber: courierTracking, history: [] };
    } else {
      order.tracking.carrier = courierCarrier;
      order.tracking.trackingNumber = courierTracking;
      if (!Array.isArray(order.tracking.history)) {
        order.tracking.history = [];
      }
    }

    order.tracking.history.push({
      status: 'Shipped',
      title: 'Order Dispatched by Merchant',
      location: 'Merchant Fulfillment Facility',
      description: notes || `Dispatched via ${courierCarrier} (AWB: ${courierTracking})`,
      timestamp: new Date()
    });

    const updatedOrder = await order.save();

    // Trigger transactional notification email non-blockingly
    const recipientEmail = order.user?.email || order.shippingAddress?.email;
    if (recipientEmail) {
      sendOrderStatusEmail(updatedOrder, 'Shipped', recipientEmail).catch((mailErr) => {
        console.warn('Dispatch notification email warning:', mailErr.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order dispatched successfully and shipping notification triggered',
      data: updatedOrder
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to dispatch order',
      error: error.message
    });
  }
});

module.exports = router;
