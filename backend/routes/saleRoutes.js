const express = require('express');
const router = express.Router();
const {
  getLiveSaleCampaign,
  isSaleCurrentlyActive,
  FESTIVE_DEALS_CATALOG
} = require('../config/festiveDeals');

// ============================================================
// GET /api/sales/current - Public active sale campaign endpoint
// ============================================================
router.get('/current', async (req, res) => {
  try {
    const campaign = await getLiveSaleCampaign();
    const now = Date.now();
    const endMs = new Date(campaign.endDate).getTime();
    const remainingMs = Math.max(0, endMs - now);
    const isLive = Boolean(campaign.isActive && remainingMs > 0);

    const discountedProductsCount = Object.keys(FESTIVE_DEALS_CATALOG).length;

    res.status(200).json({
      success: true,
      data: {
        _id: campaign._id,
        name: campaign.name,
        tagline: campaign.tagline,
        bannerBadge: campaign.bannerBadge,
        saleType: campaign.saleType,
        isActive: campaign.isActive,
        isLive,
        status: isLive ? 'LIVE' : (!campaign.isActive ? 'ENDED' : 'EXPIRED'),
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        remainingMs,
        discountPctMax: campaign.discountPctMax || 60,
        couponCode: campaign.couponCode,
        couponDiscount: campaign.couponDiscount,
        discountDescription: campaign.discountDescription,
        discountedProductsCount,
        history: (campaign.history || []).slice(-10).reverse()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving current sale campaign',
      error: error.message
    });
  }
});

module.exports = router;
