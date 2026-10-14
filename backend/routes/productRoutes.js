const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { getProductEffectivePrice } = require('../config/festiveDeals');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper function to recalculate product rating and review count
const recalculateProductRating = (product) => {
  if (!product.reviews || !Array.isArray(product.reviews)) {
    product.reviews = [];
  }
  product.totalReviews = product.reviews.length;
  if (product.totalReviews === 0) {
    product.averageRating = 0;
    product.ratings = 0;
  } else {
    const sum = product.reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    const avg = Math.round((sum / product.totalReviews) * 10) / 10;
    product.averageRating = avg;
    product.ratings = avg;
  }
};

/**
 * Seller or Admin Authorization Middleware
 * Allows access only to:
 * - Admin users: user.role === 'admin'
 * - Verified sellers: user.sellerDetails.verificationStatus === 'verified'
 * Rejects unauthenticated users, normal customers, and unverified sellers.
 * Strictly queries MongoDB; never trusts role or verification status in request bodies.
 */
const sellerOrAdminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User account not found.'
      });
    }

    const isAdmin = user.role === 'admin';
    const isVerifiedSeller = Boolean(
      user.sellerDetails && user.sellerDetails.verificationStatus === 'verified'
    );

    if (!isAdmin && !isVerifiedSeller) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Admin or verified seller privileges required.'
      });
    }

    if (isAdmin) {
      req.admin = user;
    }
    req.userDoc = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error verifying authorization',
      error: error.message
    });
  }
};

// ============================================================
// 1. GET /api/products - Retrieve products (with server-side pagination, category, and search)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const {
      page,
      limit,
      category,
      search,
      all,
      minPrice,
      maxPrice,
      rating,
      inStock,
      sortBy,
      sort
    } = req.query;

    const andConditions = [];
    const baseConditions = [];

    // Category filter
    if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
      const escapedCat = category.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const catRegex = new RegExp('^' + escapedCat + '$', 'i');
      andConditions.push({ category: catRegex });
      baseConditions.push({ category: catRegex });
    }

    // Search filter
    if (search && search.trim() !== '') {
      const normalizedSearch = search.trim().replace(/\s+/g, ' ');
      const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
      const escapedTokens = tokens.map((t) => t.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'));

      if (escapedTokens.length > 1) {
        // Multi-word search: all words must be found across name/description/category
        const searchConds = escapedTokens.map((token) => {
          const regex = new RegExp(token, 'i');
          const conditions = [
            { name: regex },
            { description: regex }
          ];
          if (!category || category.toLowerCase() === 'all') {
            conditions.push({ category: regex });
          }
          return { $or: conditions };
        });
        andConditions.push(...searchConds);
        baseConditions.push(...searchConds);
      } else if (escapedTokens.length === 1) {
        const searchRegex = new RegExp(escapedTokens[0], 'i');
        const conditions = [
          { name: searchRegex },
          { description: searchRegex }
        ];
        if (!category || category.toLowerCase() === 'all') {
          conditions.push({ category: searchRegex });
        }
        andConditions.push({ $or: conditions });
        baseConditions.push({ $or: conditions });
      }
    }

    // Price range filter
    const priceCondition = {};
    if (minPrice !== undefined && minPrice !== '' && !isNaN(Number(minPrice))) {
      priceCondition.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== '' && !isNaN(Number(maxPrice))) {
      priceCondition.$lte = Number(maxPrice);
    }
    if (Object.keys(priceCondition).length > 0) {
      andConditions.push({ price: priceCondition });
    }

    // Customer review rating filter
    if (rating !== undefined && rating !== '' && !isNaN(Number(rating))) {
      const minRating = Number(rating);
      andConditions.push({
        $or: [
          { averageRating: { $gte: minRating } },
          { ratings: { $gte: minRating } }
        ]
      });
    }

    // In-stock availability filter
    if (inStock !== undefined && inStock !== '') {
      const isInStockOnly = inStock === 'true' || inStock === true || inStock === '1';
      if (isInStockOnly) {
        andConditions.push({
          stock: { $gt: 0 },
          inStock: true
        });
      }
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    const baseFilter = baseConditions.length > 0 ? { $and: baseConditions } : {};

    // Sorting order
    let sortOption = { createdAt: -1 };
    const effectiveSort = (sortBy || sort || '').toLowerCase().trim();
    if (effectiveSort === 'price_asc' || effectiveSort === 'price-asc') {
      sortOption = { price: 1 };
    } else if (effectiveSort === 'price_desc' || effectiveSort === 'price-desc') {
      sortOption = { price: -1 };
    } else if (effectiveSort === 'rating_desc' || effectiveSort === 'rating') {
      sortOption = { averageRating: -1, ratings: -1, totalReviews: -1 };
    } else if (effectiveSort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (effectiveSort === 'popular' || effectiveSort === 'trending') {
      sortOption = { averageRating: -1, totalReviews: -1, stock: -1 };
    } else {
      // featured / default
      sortOption = { createdAt: -1 };
    }

    // Determine pagination: enabled if page/limit/category/search/filters specified and all !== 'true'
    const hasPaginationOrFilter =
      page !== undefined ||
      limit !== undefined ||
      category !== undefined ||
      search !== undefined ||
      minPrice !== undefined ||
      maxPrice !== undefined ||
      rating !== undefined ||
      inStock !== undefined ||
      sortBy !== undefined ||
      sort !== undefined;
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
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum);
    } else {
      pageNum = 1;
      limitNum = totalProducts || 1;
      products = await Product.find(filter).sort(sortOption);
    }

    const totalPages = Math.max(1, Math.ceil(totalProducts / limitNum));
    const allCategories = await Product.distinct('category');

    // Facet metadata calculation
    let facetAggregation;
    if (andConditions.length > 0) {
      facetAggregation = await Product.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            inStockCount: {
              $sum: {
                $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $eq: ['$inStock', true] }] }, 1, 0]
              }
            }
          }
        }
      ]);
    } else {
      facetAggregation = await Product.aggregate([
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            inStockCount: {
              $sum: {
                $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $eq: ['$inStock', true] }] }, 1, 0]
              }
            }
          }
        }
      ]);
    }

    const facetStats = (facetAggregation && facetAggregation[0]) || {
      minPrice: 0,
      maxPrice: 0,
      inStockCount: 0
    };

    // Calculate scope bounds (category or global bounds before price/rating/stock filters)
    let scopeMinPrice = facetStats.minPrice || 0;
    let scopeMaxPrice = facetStats.maxPrice || 0;
    if (baseConditions.length > 0) {
      const scopeAggregation = await Product.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            inStockCount: {
              $sum: {
                $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $eq: ['$inStock', true] }] }, 1, 0]
              }
            }
          }
        }
      ]);
      if (scopeAggregation && scopeAggregation[0]) {
        scopeMinPrice = scopeAggregation[0].minPrice || 0;
        scopeMaxPrice = scopeAggregation[0].maxPrice || 0;
      }
    }

    const facets = {
      minPrice: facetStats.minPrice !== null && facetStats.minPrice !== undefined ? facetStats.minPrice : 0,
      maxPrice: facetStats.maxPrice !== null && facetStats.maxPrice !== undefined ? facetStats.maxPrice : 0,
      inStockCount: facetStats.inStockCount || 0,
      scopeMinPrice: scopeMinPrice,
      scopeMaxPrice: scopeMaxPrice
    };

    res.status(200).json({
      success: true,
      total: totalProducts,
      count: products.length,
      facets: facets,
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
// Alias: GET /api/products/search/autocomplete
// ============================================================
const handleProductSuggestions = async (req, res) => {
  try {
    const rawQuery = (req.query.q || req.query.search || '');
    // Normalize query: trim and collapse multiple consecutive whitespace characters
    const query = rawQuery.trim().replace(/\s+/g, ' ');

    // Return empty array for empty or whitespace-only queries
    if (!query || query.length < 1) {
      return res.status(200).json({
        success: true,
        count: 0,
        totalMatches: 0,
        hasMore: false,
        data: []
      });
    }

    // Configurable limit: default 12, clamped between 1 and 25
    const limitParam = parseInt(req.query.limit, 10);
    const limit = (!isNaN(limitParam) && limitParam > 0) ? Math.min(limitParam, 25) : 12;

    // Split into tokens for multi-word search
    const tokens = query.split(/\s+/).filter(Boolean);
    const escapedTokens = tokens.map((t) => t.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'));

    // Construct filter: if multiple tokens, all must match within the product name
    const filter = escapedTokens.length > 1
      ? { $and: escapedTokens.map((t) => ({ name: new RegExp(t, 'i') })) }
      : { name: new RegExp(escapedTokens[0], 'i') };

    // Count total matching products to inform frontend if more results exist
    const totalMatches = await Product.countDocuments(filter);

    // Fetch products matching the filter (up to 3x limit for accurate in-memory relevance sorting)
    const fetchLimit = Math.min(totalMatches, limit * 3);
    const candidateProducts = await Product.find(filter)
      .select('name category price image stock')
      .limit(fetchLimit)
      .lean();

    // Smart relevance sorting:
    // 1. Product name starts with full query
    // 2. Product name contains full contiguous query
    // 3. Alphabetical / natural order
    const queryLower = query.toLowerCase();
    candidateProducts.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(queryLower);
      const bStarts = bName.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const aContiguous = aName.includes(queryLower);
      const bContiguous = bName.includes(queryLower);
      if (aContiguous && !bContiguous) return -1;
      if (!aContiguous && bContiguous) return 1;

      return aName.localeCompare(bName);
    });

    // Fetch matching categories to suggest quick category jump chips
    const matchingCategories = await Product.distinct('category', {
      category: new RegExp(escapedTokens[0], 'i')
    });

    const matchingProducts = candidateProducts.slice(0, limit);

    res.status(200).json({
      success: true,
      count: matchingProducts.length,
      totalMatches: totalMatches,
      limit: limit,
      hasMore: totalMatches > matchingProducts.length,
      categories: matchingCategories.slice(0, 3),
      data: matchingProducts.map((p) => {
        const effectivePrice = getProductEffectivePrice(p);
        const hasDiscount = effectivePrice < p.price;
        const discountPercent = hasDiscount ? Math.round(((p.price - effectivePrice) / p.price) * 100) : 0;
        return {
          id: p._id.toString(),
          _id: p._id.toString(),
          name: p.name,
          category: p.category,
          price: effectivePrice,
          regularPrice: p.price,
          hasDiscount,
          discountPercent,
          image: p.image,
          stock: p.stock
        };
      })
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product suggestions'
    });
  }
};

router.get('/suggestions', handleProductSuggestions);
router.get('/search/autocomplete', handleProductSuggestions);

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
// 3. POST /api/products - Create a new product (Admin or Verified Seller)
// ============================================================
router.post('/', authMiddleware, sellerOrAdminMiddleware, async (req, res) => {
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
      specifications: specifications || {},
      variants: Array.isArray(variants) ? variants : []
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
// 4. PUT /api/products/:id - Update an existing product by ID (Admin or Verified Seller)
// ============================================================
router.put('/:id', authMiddleware, sellerOrAdminMiddleware, async (req, res) => {
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
// 6. POST /api/products/:id/review & /api/products/:id/reviews - Add a review
// ============================================================
const handleAddReview = async (req, res) => {
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
      (r) => r.user && r.user.toString() === req.user.id.toString()
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
};

router.post('/:id/review', authMiddleware, handleAddReview);
router.post('/:id/reviews', authMiddleware, handleAddReview);

// ============================================================
// 7. PUT /api/products/:id/review & /api/products/:id/reviews - Edit customer's own review
// ============================================================
const handleUpdateReview = async (req, res) => {
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
      (r) => r.user && r.user.toString() === req.user.id.toString()
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'You have not reviewed this product yet'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated user not found'
      });
    }

    review.userName = user.name;

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
};

router.put('/:id/review', authMiddleware, handleUpdateReview);
router.put('/:id/reviews', authMiddleware, handleUpdateReview);

// ============================================================
// 8. DELETE /api/products/:id/review & /api/products/:id/reviews - Delete customer's own review
// ============================================================
const handleDeleteReview = async (req, res) => {
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

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated user not found'
      });
    }

    const reviewIndex = product.reviews.findIndex(
      (r) => r.user && r.user.toString() === req.user.id.toString()
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
};

router.delete('/:id/review', authMiddleware, handleDeleteReview);
router.delete('/:id/reviews', authMiddleware, handleDeleteReview);

// ============================================================
// 9. Product Q&A Subsystem (Customer Questions & Answers)
// ============================================================

// 9a. GET /api/products/:id/questions - Retrieve product questions & answers
router.get('/:id/questions', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await Product.findById(id).select('name questions');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const questions = Array.isArray(product.questions) ? product.questions : [];
    // Sort questions: newest first
    const sortedQuestions = [...questions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // For each question, sort answers: verified seller/admin first, then by upvotes descending, then newest
    sortedQuestions.forEach(q => {
      if (Array.isArray(q.answers)) {
        q.answers.sort((a, b) => {
          const aPriority = (a.isVerifiedSeller || a.userRole === 'admin' || a.userRole === 'seller') ? 1 : 0;
          const bPriority = (b.isVerifiedSeller || b.userRole === 'admin' || b.userRole === 'seller') ? 1 : 0;
          if (bPriority !== aPriority) return bPriority - aPriority;
          if ((b.upvotes || 0) !== (a.upvotes || 0)) return (b.upvotes || 0) - (a.upvotes || 0);
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }
    });

    res.status(200).json({
      success: true,
      count: sortedQuestions.length,
      data: sortedQuestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving product questions',
      error: error.message
    });
  }
});

// 9b. POST /api/products/:id/questions - Submit a new question
router.post('/:id/questions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { questionText } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Question text is required'
      });
    }

    const trimmedQuestion = questionText.trim();
    if (trimmedQuestion.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Question must be at least 3 characters long'
      });
    }

    if (trimmedQuestion.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Question cannot exceed 500 characters'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found'
      });
    }

    if (!Array.isArray(product.questions)) {
      product.questions = [];
    }

    const newQuestion = {
      questionId: new mongoose.Types.ObjectId().toString(),
      user: user._id,
      userName: user.name || 'Customer',
      questionText: trimmedQuestion,
      createdAt: new Date(),
      answers: []
    };

    product.questions.push(newQuestion);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Question posted successfully',
      data: newQuestion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error posting question',
      error: error.message
    });
  }
});

// 9c. POST /api/products/:id/questions/:questionId/answers - Submit an answer to a question
router.post('/:id/questions/:questionId/answers', authMiddleware, async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const { answerText } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    if (!answerText || typeof answerText !== 'string' || !answerText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Answer text is required'
      });
    }

    const trimmedAnswer = answerText.trim();
    if (trimmedAnswer.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Answer must be at least 2 characters long'
      });
    }

    if (trimmedAnswer.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Answer cannot exceed 1000 characters'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!Array.isArray(product.questions)) {
      product.questions = [];
    }

    const question = product.questions.find(
      q => q.questionId === questionId || String(q._id) === questionId
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found'
      });
    }

    const isAdmin = user.role === 'admin';
    const isVerifiedSeller = Boolean(
      user.role === 'seller' || (user.sellerDetails && user.sellerDetails.verificationStatus === 'verified')
    );

    let userRole = 'customer';
    if (isAdmin) {
      userRole = 'admin';
    } else if (isVerifiedSeller) {
      userRole = 'seller';
    }

    if (!Array.isArray(question.answers)) {
      question.answers = [];
    }

    const newAnswer = {
      answerId: new mongoose.Types.ObjectId().toString(),
      user: user._id,
      userName: user.name || 'User',
      userRole: userRole,
      isVerifiedSeller: isVerifiedSeller || isAdmin,
      answerText: trimmedAnswer,
      createdAt: new Date(),
      upvotes: 0,
      upvotedBy: []
    };

    question.answers.push(newAnswer);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Answer submitted successfully',
      data: newAnswer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error submitting answer',
      error: error.message
    });
  }
});

// 9d. POST & PUT /api/products/:id/questions/:questionId/answers/:answerId/upvote - Upvote / toggle helpful vote
const handleUpvoteAnswer = async (req, res) => {
  try {
    const { id, questionId, answerId } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const question = (product.questions || []).find(
      q => q.questionId === questionId || String(q._id) === questionId
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const answer = (question.answers || []).find(
      a => a.answerId === answerId || String(a._id) === answerId
    );

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }

    if (!Array.isArray(answer.upvotedBy)) {
      answer.upvotedBy = [];
    }

    const userIdStr = String(req.user.id);
    const existingIndex = answer.upvotedBy.findIndex(uId => String(uId) === userIdStr);
    let hasUpvoted = false;

    if (existingIndex !== -1) {
      // Toggle off
      answer.upvotedBy.splice(existingIndex, 1);
      answer.upvotes = Math.max(0, (answer.upvotes || 1) - 1);
      hasUpvoted = false;
    } else {
      // Toggle on
      answer.upvotedBy.push(req.user.id);
      answer.upvotes = (answer.upvotes || 0) + 1;
      hasUpvoted = true;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: hasUpvoted ? 'Answer upvoted successfully' : 'Upvote removed',
      upvotes: answer.upvotes,
      hasUpvoted: hasUpvoted,
      answerId: answer.answerId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating upvote',
      error: error.message
    });
  }
};

router.post('/:id/questions/:questionId/answers/:answerId/upvote', authMiddleware, handleUpvoteAnswer);
router.put('/:id/questions/:questionId/answers/:answerId/upvote', authMiddleware, handleUpvoteAnswer);

module.exports = router;
