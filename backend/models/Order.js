const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  name: {
    type: String,
    required: [true, 'Product name snapshot is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Product price snapshot is required'],
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  subtotal: {
    type: Number,
    required: false,
    min: [0, 'Subtotal cannot be negative']
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sellerName: {
    type: String,
    trim: true,
    default: null
  },
  selectedVariant: {
    variantId: { type: String, default: null },
    sku: { type: String, default: null },
    title: { type: String, default: null },
    price: { type: Number, default: null },
    attributes: { type: mongoose.Schema.Types.Mixed, default: null }
  }
});

const shippingAddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false,
      trim: true
    },
    phone: {
      type: String,
      required: false,
      trim: true
    },
    addressLine1: {
      type: String,
      required: false,
      trim: true
    },
    addressLine2: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      required: false,
      trim: true
    },
    state: {
      type: String,
      required: false,
      trim: true
    },
    postalCode: {
      type: String,
      required: false,
      trim: true
    },
    country: {
      type: String,
      required: false,
      trim: true,
      default: 'India'
    },
    addressType: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home'
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Legacy support: 'orderId' string (e.g., ORD001)
    orderId: {
      type: String,
      trim: true
    },
    // User can be an ObjectId reference or legacy String name
    user: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'User reference is required']
    },
    items: {
      type: [orderItemSchema],
      default: []
    },
    // Legacy field from existing E-commerce database
    products: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    totalAmount: {
      type: Number,
      required: false,
      min: [0, 'Total amount cannot be negative']
    },
    // Legacy field from existing E-commerce database
    total: {
      type: Number,
      required: false
    },
    subtotalAmount: {
      type: Number,
      default: 0
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    coupon: {
      code: { type: String, trim: true, default: null },
      discountAmount: { type: Number, default: 0 },
      discountType: { type: String, default: null },
      discountValue: { type: Number, default: 0 }
    },
    // MiniStore Wallet & Loyalty Rewards (Feature 5)
    walletDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Wallet discount cannot be negative']
    },
    coinsEarned: {
      type: Number,
      default: 0,
      min: [0, 'Coins earned cannot be negative']
    },
    shippingAddress: {
      type: shippingAddressSnapshotSchema,
      required: false
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['UPI', 'COD', 'NET_BANKING', 'WALLET', 'RAZORPAY', 'CARD'],
        message: 'Invalid payment method. Allowed: UPI, COD, NET_BANKING, WALLET, RAZORPAY, CARD'
      },
      required: false
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['Pending', 'Paid', 'Failed'],
        message: 'Invalid payment status. Allowed: Pending, Paid, Failed'
      },
      default: 'Pending'
    },
    paymentReference: {
      type: String,
      trim: true,
      default: null
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: null
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: null
    },
    stockDeducted: {
      type: Boolean,
      default: false
    },
    paymentUpdatedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      default: 'Pending'
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: null
    },
    tracking: {
      carrier: {
        type: String,
        trim: true,
        default: 'MiniStore Express'
      },
      trackingNumber: {
        type: String,
        trim: true,
        default: null
      },
      estimatedDeliveryDate: {
        type: Date,
        default: null
      },
      history: [
        {
          status: { type: String, required: true },
          title: { type: String, required: true },
          description: { type: String, default: '' },
          location: { type: String, default: 'Fulfillment Center' },
          timestamp: { type: Date, default: Date.now }
        }
      ]
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to normalize totalAmount <-> total, items <-> products, invoiceNumber, and tracking defaults
orderSchema.pre('save', function () {
  if (this.totalAmount === undefined && this.total !== undefined) {
    this.totalAmount = this.total;
  }
  if (this.total === undefined && this.totalAmount !== undefined) {
    this.total = this.totalAmount;
  }
  if ((!this.items || this.items.length === 0) && Array.isArray(this.products) && this.products.length > 0) {
    this.items = this.products.map(p => ({
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      subtotal: p.price * p.quantity
    }));
  }

  // Auto-generate invoiceNumber if not set
  if (!this.invoiceNumber) {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.invoiceNumber = `INV-${ymd}-${rand}`;
  }

  // Auto-initialize tracking details if not set
  if (!this.tracking) {
    this.tracking = {};
  }
  if (!this.tracking.carrier) {
    this.tracking.carrier = 'MiniStore Express';
  }
  if (!this.tracking.trackingNumber) {
    const randCode = Math.floor(100000 + Math.random() * 900000);
    this.tracking.trackingNumber = `MS-TRK-${randCode}`;
  }
  if (!this.tracking.estimatedDeliveryDate) {
    // Expected delivery in 3 days
    this.tracking.estimatedDeliveryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  }
  if (!Array.isArray(this.tracking.history) || this.tracking.history.length === 0) {
    this.tracking.history = [
      {
        status: 'Placed',
        title: 'Order Placed & Confirmed',
        description: 'Your order has been verified and queued for fulfillment.',
        location: 'Central Fulfillment Hub, Mumbai',
        timestamp: new Date()
      }
    ];
  }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
