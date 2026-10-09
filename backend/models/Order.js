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
    shippingAddress: {
      type: shippingAddressSnapshotSchema,
      required: false
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['UPI', 'COD', 'NET_BANKING'],
        message: 'Invalid payment method. Allowed: UPI, COD, NET_BANKING'
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
    paymentUpdatedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      default: 'Pending'
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to normalize totalAmount <-> total and items <-> products
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
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
