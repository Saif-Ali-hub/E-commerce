const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const authMiddleware = require('../middleware/auth');

// Seed default initial coupons if collection is empty
const seedDefaultCouponsIfEmpty = async () => {
  try {
    const count = await Coupon.countDocuments();
    if (count === 0) {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 90); // 90 days valid

      const defaultCoupons = [
        {
          code: 'FESTIVE10',
          description: 'Special Festive Discount: Flat ₹200 OFF on orders above ₹999!',
          discountType: 'FLAT',
          discountValue: 200,
          minOrderAmount: 999,
          expiryDate: farFuture,
          usageLimit: 500,
          isActive: true,
          createdBy: 'System Seed'
        },
        {
          code: 'WELCOME100',
          description: 'Welcome Bonus: Flat ₹100 OFF on orders above ₹499!',
          discountType: 'FLAT',
          discountValue: 100,
          minOrderAmount: 499,
          expiryDate: farFuture,
          usageLimit: 1000,
          isActive: true,
          createdBy: 'System Seed'
        },
        {
          code: 'DIWALI20',
          description: 'Festive Flash Deal: 20% OFF (up to ₹500) on orders above ₹799!',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          maxDiscountAmount: 500,
          minOrderAmount: 799,
          expiryDate: farFuture,
          usageLimit: 300,
          isActive: true,
          createdBy: 'System Seed'
        },
        {
          code: 'SUPER50',
          description: 'Everyday Saver: Flat ₹50 OFF on any order!',
          discountType: 'FLAT',
          discountValue: 50,
          minOrderAmount: 199,
          expiryDate: farFuture,
          usageLimit: 1000,
          isActive: true,
          createdBy: 'System Seed'
        }
      ];

      await Coupon.insertMany(defaultCoupons);
      console.log('Seeded default store coupons successfully.');
    }
  } catch (err) {
    console.error('Error seeding default coupons:', err.message);
  }
};

// Auto-run seed check on startup
seedDefaultCouponsIfEmpty();

// ============================================================
// 1. GET /api/coupons/active - List all currently active coupons
// ============================================================
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gte: now },
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ]
    }).sort({ minOrderAmount: 1 });

    // Filter out any coupon where usageCount has reached usageLimit
    const availableCoupons = coupons.filter(c => !c.usageLimit || c.usageCount < c.usageLimit);

    res.status(200).json({
      success: true,
      count: availableCoupons.length,
      data: availableCoupons.map(c => ({
        _id: c._id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderAmount: c.minOrderAmount,
        maxDiscountAmount: c.maxDiscountAmount,
        expiryDate: c.expiryDate
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving available coupons',
      error: error.message
    });
  }
});

// ============================================================
// 2. POST /api/coupons/validate - Validate a coupon for given subtotal
// ============================================================
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Please provide a coupon code.'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const orderSubtotal = Math.max(parseFloat(subtotal) || 0, 0);

    const coupon = await Coupon.findOne({ code: cleanCode });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: `Coupon code "${cleanCode}" is invalid.`
      });
    }

    // Check eligibility
    const eligibility = coupon.checkEligibility(orderSubtotal);
    if (!eligibility.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: eligibility.message
      });
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderSubtotal);
    const finalTotal = Math.max(0, orderSubtotal - discountAmount);

    res.status(200).json({
      success: true,
      valid: true,
      message: `Coupon "${coupon.code}" applied successfully! You save ₹${discountAmount}.`,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        subtotal: orderSubtotal,
        finalTotal
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error validating coupon',
      error: error.message
    });
  }
});

module.exports = router;
