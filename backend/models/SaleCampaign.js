const mongoose = require('mongoose');

const campaignHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['CREATED', 'EXTENDED', 'ENDED', 'RESUMED', 'UPDATED']
    },
    performedBy: {
      type: String,
      default: 'Admin'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      default: ''
    }
  },
  { _id: true }
);

const saleCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sale campaign name is required'],
      trim: true,
      default: 'The Grand Festival Mega Sale'
    },
    tagline: {
      type: String,
      trim: true,
      default: 'Festive Deals Live! Up to 60% OFF on Top Picks'
    },
    bannerBadge: {
      type: String,
      trim: true,
      default: 'DIWALI SPECIAL'
    },
    saleType: {
      type: String,
      trim: true,
      default: 'festival'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    discountPctMax: {
      type: Number,
      default: 60
    },
    couponCode: {
      type: String,
      trim: true,
      default: 'FESTIVE10'
    },
    couponDiscount: {
      type: String,
      trim: true,
      default: 'Flat ₹200 OFF on orders above ₹1,999'
    },
    discountDescription: {
      type: String,
      trim: true,
      default: 'Heavy festive discounts up to 60% OFF on select products across Electronics, Accessories & Home.'
    },
    bannerStatusMessage: {
      type: String,
      trim: true,
      default: ''
    },
    history: [campaignHistorySchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SaleCampaign', saleCampaignSchema);
