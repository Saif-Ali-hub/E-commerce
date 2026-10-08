const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required']
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
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  }
});

const shippingAddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name snapshot is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number snapshot is required'],
      trim: true
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 snapshot is required'],
      trim: true
    },
    addressLine2: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      required: [true, 'City snapshot is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State snapshot is required'],
      trim: true
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code snapshot is required'],
      trim: true
    },
    country: {
      type: String,
      required: [true, 'Country snapshot is required'],
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item'
      }
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative']
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
      default: 'Pending',
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Completed']
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
