const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper function to recalculate product rating and review count
const recalculateProductRating = (product) => {
  product.totalReviews = product.reviews.length;
  if (product.totalReviews === 0) {
    product.averageRating = 0;
  } else {
    const sum = product.reviews.reduce((acc, r) => acc + r.rating, 0);
    product.averageRating = Math.round((sum / product.totalReviews) * 10) / 10;
  }
};

// ============================================================
// 1. GET /api/products - Retrieve products (with server-side pagination, category, and search)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { page, limit, category, search, all } = req.query;

    const filter = {};

    // Category filter
    if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
      const escapedCat = category.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      filter.category = new RegExp('^' + escapedCat + '$', 'i');
    }

    // Search filter
    if (search && search.trim() !== '') {
      const escapedSearch = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      const searchConditions = [
        { name: searchRegex },
        { description: searchRegex }
      ];
      if (!filter.category) {
        searchConditions.push({ category: searchRegex });
      }
      filter.$or = searchConditions;
    }

    // Determine pagination: enabled if page/limit/category/search specified and all !== 'true'
    const hasPaginationOrFilter = page !== undefined || limit !== undefined || category !== undefined || search !== undefined;
    const isPaginated = hasPaginationOrFilter && all !== 'true';

    const totalProducts = await Product.countDocuments(filter);

    let products;
    let pageNum = 1;
    let limitNum = 12;

    if (isPaginated) {
      pageNum = Math.max(1, parseInt(page, 10) || 1);
      limitNum = Math.max(1, parseInt(limit, 10) || 12);
      const skip = (pageNum - 1) * limitNum;

      products = await Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
    } else {
      pageNum = 1;
      limitNum = totalProducts || 1;
      products = await Product.find(filter).sort({ createdAt: -1 });
    }

    const totalPages = Math.max(1, Math.ceil(totalProducts / limitNum));
    const allCategories = await Product.distinct('category');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
      products: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalProducts: totalProducts,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1
      },
      categories: allCategories.filter(Boolean).sort()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error.message
    });
  }
});

// ============================================================
// 1b. GET /api/products/categories - Distinct categories list
// ============================================================
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.status(200).json({
      success: true,
      data: categories.filter(Boolean).sort()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error.message
    });
  }
});

// ============================================================
// 1c. GET /api/products/suggestions - Lightweight search suggestions
// ============================================================
router.get('/suggestions', async (req, res) => {
  try {
    const query = (req.query.q || req.query.search || '').trim();

    // Do nothing / return empty array for 0 or 1 character
    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Escape regex special characters safely
    const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const nameRegex = new RegExp(escapedQuery, 'i');

    // Query MongoDB dynamically on product name, return minimal fields, limit to 10
    const matchingProducts = await Product.find({ name: nameRegex })
      .select('name category price image')
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      count: matchingProducts.length,
      data: matchingProducts.map((p) => ({
        id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product suggestions',
      error: error.message
    });
  }
});

// ============================================================
// 2. GET /api/products/:id - Retrieve a single product by ID
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(id);

    // If product does not exist
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving product',
      error: error.message
    });
  }
});

// ============================================================
// 2b. GET /api/products/:id/related - Retrieve related products
// ============================================================
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 8);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const category = currentProduct.category;
    const currentId = currentProduct._id;

    const relatedProducts = [];
    const seenIds = new Set();
    seenIds.add(currentId.toString());

    // 1. Same category, in-stock first (stock > 0), excluding current product
    const sameCatInStock = await Product.find({
      _id: { $ne: currentId },
      category: category,
      stock: { $gt: 0 }
    }).sort({ createdAt: -1 }).limit(limit);

    for (const p of sameCatInStock) {
      relatedProducts.push(p);
      seenIds.add(p._id.toString());
    }

    // 2. If needed, same category out-of-stock
    if (relatedProducts.length < limit) {
      const remaining = limit - relatedProducts.length;
      const sameCatAny = await Product.find({
        _id: { $nin: Array.from(seenIds) },
        category: category
      }).sort({ createdAt: -1 }).limit(remaining);

      for (const p of sameCatAny) {
        relatedProducts.push(p);
        seenIds.add(p._id.toString());
      }
    }

    // 3. If needed, other categories in-stock
    if (relatedProducts.length < limit) {
      const remaining = limit - relatedProducts.length;
      const otherInStock = await Product.find({
        _id: { $nin: Array.from(seenIds) },
        stock: { $gt: 0 }
      }).sort({ createdAt: -1 }).limit(remaining);

      for (const p of otherInStock) {
        relatedProducts.push(p);
        seenIds.add(p._id.toString());
      }
    }

    // 4. If still needed, any other available products
    if (relatedProducts.length < limit) {
      const remaining = limit - relatedProducts.length;
      const otherAny = await Product.find({
        _id: { $nin: Array.from(seenIds) }
      }).sort({ createdAt: -1 }).limit(remaining);

      for (const p of otherAny) {
        relatedProducts.push(p);
        seenIds.add(p._id.toString());
      }
    }

    res.status(200).json({
      success: true,
      count: relatedProducts.length,
      data: relatedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving related products',
      error: error.message
    });
  }
});

// ============================================================
// 3. POST /api/products - Create a new product (Admin only)
// ============================================================
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
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
      specifications
    } = req.body;

    const product = new Product({
      name,
      title: title || name,
      price,
      discountPrice: discountPrice || null,
      category,
      subcategory: subcategory || '',
      brand: brand || 'MiniStore',
      sku,
      description,
      stock,
      image,
      images: Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []),
      features: Array.isArray(features) ? features : [],
      specifications: specifications || {}
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
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

    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
});

// ============================================================
// 4. PUT /api/products/:id - Update an existing product by ID (Admin only)
// ============================================================
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      req.body,
      {
        returnDocument: 'after', // Return the updated document
        runValidators: true // Enforce schema validation rules on updates
      }
    );

    // If product does not exist
    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating product',
      error: error.message
    });
  }
});

// ============================================================
// 5. DELETE /api/products/:id - Delete a product by ID (Admin only)
// ============================================================
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    // If product does not exist
    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        id: deletedProduct._id,
        name: deletedProduct.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting product',
      error: error.message
    });
  }
});

// ============================================================
// 6. POST /api/products/:id/review - Add a review for a product
// ============================================================
router.post('/:id/review', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Validation: Rating
    if (rating === undefined || rating === null || rating === '') {
      return res.status(400).json({
        success: false,
        message: 'Rating is required'
      });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    // Validation: Comment
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review comment is required'
      });
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Review comment cannot exceed 500 characters'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check duplicate review from this user
    const alreadyReviewed = product.reviews.some(
      (r) => r.user.toString() === req.user.id.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. You can edit your existing review.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated user not found'
      });
    }

    const review = {
      user: user._id,
      userName: user.name,
      rating: numRating,
      comment: trimmedComment,
      createdAt: new Date()
    };

    product.reviews.push(review);
    recalculateProductRating(product);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: product
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error adding review',
      error: error.message
    });
  }
});

// ============================================================
// 7. PUT /api/products/:id/review - Edit customer's own review
// ============================================================
router.put('/:id/review', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Validation: Rating
    if (rating === undefined || rating === null || rating === '') {
      return res.status(400).json({
        success: false,
        message: 'Rating is required'
      });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    // Validation: Comment
    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review comment is required'
      });
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Review comment cannot exceed 500 characters'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const review = product.reviews.find(
      (r) => r.user.toString() === req.user.id.toString()
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'You have not reviewed this product yet'
      });
    }

    const user = await User.findById(req.user.id);
    if (user) {
      review.userName = user.name;
    }

    review.rating = numRating;
    review.comment = trimmedComment;
    review.createdAt = new Date();

    recalculateProductRating(product);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: product
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating review',
      error: error.message
    });
  }
});

// ============================================================
// 8. DELETE /api/products/:id/review - Delete customer's own review
// ============================================================
router.delete('/:id/review', authMiddleware, async (req, res) => {
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

    const reviewIndex = product.reviews.findIndex(
      (r) => r.user.toString() === req.user.id.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'You have not reviewed this product yet'
      });
    }

    product.reviews.splice(reviewIndex, 1);
    recalculateProductRating(product);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: product
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
