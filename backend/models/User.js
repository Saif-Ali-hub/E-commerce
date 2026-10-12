const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please enter a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long']
    },
    role: {
      type: String,
      enum: ['customer', 'seller', 'admin'],
      default: 'customer'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active'
    },
    avatar: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    // Seller details for merchant accounts
    sellerDetails: {
      businessName: {
        type: String,
        trim: true,
        default: ''
      },
      businessAddress: {
        type: String,
        trim: true,
        default: ''
      },
      contactNumber: {
        type: String,
        trim: true,
        default: ''
      },
      pan: {
        type: String,
        trim: true,
        uppercase: true,
        default: ''
      },
      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        default: ''
      },
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      }
    },
    addresses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
      }
    ],
    // Section 5: User-Specific Cart embedded directly in user document
    cart: {
      type: [cartItemSchema],
      default: []
    },
    // Section 6: User-Specific Wishlist referencing Product ObjectIds
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Defense-in-depth: Never return password hash in public JSON conversions and mask sensitive PAN
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    if (ret.sellerDetails && ret.sellerDetails.pan) {
      const p = ret.sellerDetails.pan;
      ret.sellerDetails.pan = p.length === 10 ? `${p.slice(0, 5)}****${p.slice(9)}` : `${p.slice(0, 2)}****`;
    }
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
