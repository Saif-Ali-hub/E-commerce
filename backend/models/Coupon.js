const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [20, 'Coupon code cannot exceed 20 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    discountType: {
      type: String,
      enum: {
        values: ['PERCENTAGE', 'FLAT'],
        message: 'Discount type must be either PERCENTAGE or FLAT'
      },
      required: [true, 'Discount type is required'],
      default: 'FLAT'
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be at least 1']
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative']
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Max discount amount cannot be negative']
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required']
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
      min: [1, 'Usage limit must be at least 1']
    },
    usageCount: {
      type: Number,
      default: 0,
      min: [0, 'Usage count cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: String,
      default: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

// Method to validate eligibility for a given order amount
couponSchema.methods.checkEligibility = function (orderAmount = 0) {
  const now = new Date();

  if (!this.isActive) {
    return {
      valid: false,
      message: `Coupon "${this.code}" is currently disabled.`
    };
  }

  if (this.startDate && now < new Date(this.startDate)) {
    return {
      valid: false,
      message: `Coupon "${this.code}" is not yet active.`
    };
  }

  if (this.expiryDate && now > new Date(this.expiryDate)) {
    return {
      valid: false,
      message: `Coupon "${this.code}" has expired.`
    };
  }

  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return {
      valid: false,
      message: `Coupon "${this.code}" has reached its maximum usage limit.`
    };
  }

  if (this.minOrderAmount && orderAmount < this.minOrderAmount) {
    const needed = Math.round(this.minOrderAmount - orderAmount);
    return {
      valid: false,
      message: `Add ₹${needed} more to your cart to use coupon "${this.code}" (Min. order ₹${this.minOrderAmount}).`
    };
  }

  return { valid: true };
};

// Method to compute exact discount in INR
couponSchema.methods.calculateDiscount = function (orderAmount = 0) {
  let discount = 0;
  if (this.discountType === 'PERCENTAGE') {
    discount = Math.round((orderAmount * this.discountValue) / 100);
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else {
    // FLAT discount
    discount = Math.min(this.discountValue, orderAmount);
  }
  return Math.max(0, discount);
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
