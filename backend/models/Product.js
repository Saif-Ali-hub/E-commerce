const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

// Optional Product Variant Schema (Size, Color, Storage, SKU, price/stock overrides)
const variantSchema = new mongoose.Schema(
  {
    variantId: { type: String, required: true },
    sku: { type: String, trim: true },
    title: { type: String, trim: true }, // e.g. "Space Grey / 128GB" or "Navy Blue / M"
    attributes: {
      size: { type: String, trim: true },
      color: { type: String, trim: true },
      storage: { type: String, trim: true }
    },
    price: { type: Number, required: true, min: [0, 'Variant price cannot be negative'] },
    stock: { type: Number, default: 0, min: [0, 'Variant stock cannot be negative'] },
    image: { type: String, trim: true }
  },
  { _id: false }
);

// Product Q&A: Answer Subdocument Schema
const answerSchema = new mongoose.Schema(
  {
    answerId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
      trim: true
    },
    userRole: {
      type: String,
      enum: ['admin', 'seller', 'customer'],
      default: 'customer'
    },
    isVerifiedSeller: {
      type: Boolean,
      default: false
    },
    answerText: {
      type: String,
      required: [true, 'Answer text is required'],
      trim: true,
      maxlength: [1000, 'Answer cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    upvotes: {
      type: Number,
      default: 0
    },
    upvotedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  { _id: false }
);

// Product Q&A: Question Subdocument Schema
const questionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
      trim: true
    },
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: [500, 'Question cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    answers: {
      type: [answerSchema],
      default: []
    }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be a positive number']
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price must be a positive number'],
      default: null
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true
    },
    subcategory: {
      type: String,
      trim: true,
      default: ''
    },
    brand: {
      type: String,
      trim: true,
      default: 'MiniStore'
    },
    sku: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0
    },
    inStock: {
      type: Boolean,
      default: true
    },
    image: {
      type: String,
      trim: true,
      default: ''
    },
    images: {
      type: [String],
      default: []
    },
    imageMetadata: {
      gridFSId: { type: mongoose.Schema.Types.ObjectId, default: null },
      filename: { type: String, default: null },
      contentType: { type: String, default: null },
      size: { type: Number, default: 0 },
      uploadDate: { type: Date, default: null }
    },
    features: {
      type: [String],
      default: []
    },
    specifications: {
      type: Map,
      of: String,
      default: () => ({})
    },
    // Merchant / Multi-Tenant Isolation
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    sellerName: {
      type: String,
      trim: true,
      default: 'MiniStore'
    },
    // Optional Product Variants (Size, Color, Storage, SKU, price/stock overrides)
    variants: {
      type: [variantSchema],
      default: []
    },
    // Legacy fields preserved from existing E-commerce database
    ratings: {
      type: Number,
      default: 0
    },
    tags: {
      type: [String],
      default: []
    },
    reviews: [reviewSchema],
    // Customer Questions & Answers Subsystem
    questions: {
      type: [questionSchema],
      default: []
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Average rating cannot be negative'],
      max: [5, 'Average rating cannot exceed 5']
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

// Synchronous pre-save hook for Mongoose 8/9
productSchema.pre('save', function () {
  if (!this.title) {
    this.title = this.name;
  }
  if (!this.images || this.images.length === 0) {
    this.images = this.image ? [this.image] : [];
  }
  this.inStock = typeof this.stock === 'number' && this.stock > 0;
  if (!this.sku && this._id) {
    const catCode = (this.category || 'GEN').slice(0, 3).toUpperCase();
    const idSuffix = this._id.toString().slice(-6).toUpperCase();
    this.sku = `MS-${catCode}-${idSuffix}`;
  }
  if (!this.averageRating && this.ratings) {
    this.averageRating = this.ratings;
  }
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
