const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          // Sensible Indian phone validation: accepts 10 digits with optional +91 or 0 prefix
          return /^(?:(?:\+|0{0,2})91(\s*[\- ]\s*)?|[0]?)?[6789]\d{9}$/.test(v.replace(/\s+/g, ''));
        },
        message: props => `${props.value} is not a valid phone number. Please enter a valid 10-digit mobile number.`
      }
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      maxlength: [200, 'Address line 1 cannot exceed 200 characters']
    },
    addressLine2: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Address line 2 cannot exceed 200 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters']
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters']
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
      validate: {
        validator: function (v) {
          // Sensible Indian PIN code validation: 6 digits, does not start with 0
          return /^[1-9][0-9]{5}$/.test(v.replace(/\s+/g, ''));
        },
        message: props => `${props.value} is not a valid 6-digit PIN code.`
      }
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'India',
      maxlength: [100, 'Country cannot exceed 100 characters']
    },
    addressType: {
      type: String,
      enum: {
        values: ['Home', 'Work', 'Other'],
        message: 'Address type must be Home, Work, or Other'
      },
      default: 'Home'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Index user field for fast retrieval
addressSchema.index({ user: 1 });

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;
