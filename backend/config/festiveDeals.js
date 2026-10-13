/**
 * Shared Festive Deals Rules & Pricing Helpers
 * Used by Cart, Orders, Admin Portal, and Public Storefront.
 */

const SaleCampaign = require('../models/SaleCampaign');

const FESTIVE_DEALS_CATALOG = {
  // Electronics
  'wireless mouse': { discountPct: 50 },
  'mechanical gaming keyboard': { discountPct: 54 },
  'wireless noise-canceling headphones': { discountPct: 60 },
  'smart fitness watch': { discountPct: 52 },
  'waterproof bluetooth speaker': { discountPct: 50 },
  'wireless anc earbuds': { discountPct: 50 },
  '10,000mah magnetic power bank': { discountPct: 53 },
  'rgb gaming soundbar': { discountPct: 50 },
  'usb condenser microphone': { discountPct: 52 },

  // Computers
  'gaming laptop': { discountPct: 40 },

  // Accessories
  'canvas laptop backpack': { discountPct: 60 },
  'polarized aviator sunglasses': { discountPct: 56 },
  'stainless steel mesh watch': { discountPct: 50 },
  'crossbody sling bag': { discountPct: 50 },
  'waxed canvas duffel bag': { discountPct: 52 },

  // Home
  'minimalist led desk lamp': { discountPct: 50 },
  'aromatherapy essential oil diffuser': { discountPct: 50 },
  'linen throw blanket': { discountPct: 50 },
  'rechargeable led table lamp': { discountPct: 50 },

  // Kitchen
  'electric gooseneck kettle': { discountPct: 44 },
  'borosilicate glass french press': { discountPct: 50 },
  'cast iron dutch oven': { discountPct: 44 },
  'non-stick frying pan': { discountPct: 46 },

  // Sports
  'insulated sports bottle 1l': { discountPct: 50 },
  'non-slip yoga mat': { discountPct: 50 },
  'high-density foam roller': { discountPct: 50 },
  'resistance bands (set of 5)': { discountPct: 50 }
};

let cachedCampaign = null;
let lastCacheTime = 0;
const CACHE_TTL = 3000; // 3 seconds in-memory TTL

async function getLiveSaleCampaign() {
  const now = Date.now();
  if (cachedCampaign && (now - lastCacheTime) < CACHE_TTL) {
    return cachedCampaign;
  }

  try {
    let campaign = await SaleCampaign.findOne({ saleType: 'festival' }).sort({ createdAt: -1 });
    if (!campaign) {
      campaign = await SaleCampaign.create({
        name: 'The Grand Festival Mega Sale',
        tagline: 'Festive Deals Live! Up to 60% OFF on Top Picks',
        bannerBadge: 'DIWALI SPECIAL',
        saleType: 'festival',
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        discountPctMax: 60,
        couponCode: 'FESTIVE10',
        couponDiscount: 'Flat ₹200 OFF on orders above ₹1,999',
        discountDescription: 'Heavy festive discounts up to 60% OFF on 27 top products across Electronics, Accessories & Home Essentials.',
        history: [{
          action: 'CREATED',
          performedBy: 'System',
          timestamp: new Date(),
          details: 'Initial Festival Sale campaign initialized'
        }]
      });
    }

    cachedCampaign = campaign;
    lastCacheTime = now;
    return campaign;
  } catch (err) {
    if (!cachedCampaign) {
      cachedCampaign = {
        name: 'The Grand Festival Mega Sale',
        tagline: 'Festive Deals Live! Up to 60% OFF on Top Picks',
        bannerBadge: 'DIWALI SPECIAL',
        saleType: 'festival',
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        discountPctMax: 60,
        couponCode: 'FESTIVE10',
        couponDiscount: 'Flat ₹200 OFF on orders above ₹1,999',
        history: []
      };
    }
    return cachedCampaign;
  }
}

// Check synchronously if festive sale is active
function isSaleCurrentlyActive() {
  if (!cachedCampaign) return true;
  const isTimeValid = new Date(cachedCampaign.endDate).getTime() > Date.now();
  return Boolean(cachedCampaign.isActive && isTimeValid);
}

function getProductEffectivePrice(product) {
  if (!product || typeof product !== 'object') return 0;
  const regularPrice = Number(product.price) || 0;
  if (regularPrice <= 0) return 0;

  // 1. If product already has an explicit permanent discountPrice set in DB
  if (product.discountPrice && Number(product.discountPrice) < regularPrice) {
    return Number(product.discountPrice);
  }

  // If admin has ended the sale or campaign has expired, festive discount is inactive
  if (!isSaleCurrentlyActive()) {
    return regularPrice;
  }

  // 2. Check festive deals catalog
  const nameKey = (product.name || '').trim().toLowerCase();
  for (const [key, rule] of Object.entries(FESTIVE_DEALS_CATALOG)) {
    if (nameKey === key || nameKey.includes(key) || key.includes(nameKey)) {
      const discountPct = rule.discountPct || 50;
      let festivePrice = Math.round((regularPrice * (1 - (discountPct / 100))) / 10) * 10 - 1;
      if (festivePrice <= 0 || festivePrice >= regularPrice) {
        festivePrice = Math.floor(regularPrice * (1 - (discountPct / 100)));
      }
      return festivePrice;
    }
  }

  return regularPrice;
}

function isProductOnFestiveDiscount(product) {
  if (!product || typeof product !== 'object') return false;
  const regularPrice = Number(product.price) || 0;
  const effectivePrice = getProductEffectivePrice(product);
  return effectivePrice < regularPrice;
}

// Admin Operations
async function endLiveSale(performedBy = 'Admin') {
  const campaign = await getLiveSaleCampaign();
  campaign.isActive = false;
  campaign.history.push({
    action: 'ENDED',
    performedBy,
    timestamp: new Date(),
    details: 'Sale ended manually by store admin'
  });
  await campaign.save();
  cachedCampaign = campaign;
  lastCacheTime = Date.now();
  return campaign;
}

async function resumeLiveSale(performedBy = 'Admin') {
  const campaign = await getLiveSaleCampaign();
  campaign.isActive = true;
  // If sale was expired, give it 7 days fresh window
  if (new Date(campaign.endDate).getTime() <= Date.now()) {
    campaign.endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  campaign.history.push({
    action: 'RESUMED',
    performedBy,
    timestamp: new Date(),
    details: `Sale resumed by admin. Valid until ${campaign.endDate.toLocaleString()}`
  });
  await campaign.save();
  cachedCampaign = campaign;
  lastCacheTime = Date.now();
  return campaign;
}

async function extendLiveSale(hours = 24, customEndDate = null, performedBy = 'Admin') {
  const campaign = await getLiveSaleCampaign();
  const now = Date.now();
  let currentEnd = new Date(campaign.endDate).getTime();
  if (isNaN(currentEnd) || currentEnd < now) {
    currentEnd = now;
  }

  let newEnd;
  if (customEndDate) {
    newEnd = new Date(customEndDate);
  } else {
    newEnd = new Date(currentEnd + (Number(hours) * 60 * 60 * 1000));
  }

  campaign.endDate = newEnd;
  campaign.isActive = true;
  campaign.history.push({
    action: 'EXTENDED',
    performedBy,
    timestamp: new Date(),
    details: customEndDate
      ? `Sale extended until ${newEnd.toLocaleString()}`
      : `Sale extended by ${hours} hours until ${newEnd.toLocaleString()}`
  });
  await campaign.save();
  cachedCampaign = campaign;
  lastCacheTime = Date.now();
  return campaign;
}

async function updateLiveSale(updates = {}, performedBy = 'Admin') {
  const campaign = await getLiveSaleCampaign();
  if (updates.name) campaign.name = updates.name.trim();
  if (updates.tagline) campaign.tagline = updates.tagline.trim();
  if (updates.bannerBadge) campaign.bannerBadge = updates.bannerBadge.trim();
  if (updates.couponCode) campaign.couponCode = updates.couponCode.trim();
  if (updates.couponDiscount) campaign.couponDiscount = updates.couponDiscount.trim();
  if (updates.discountDescription) campaign.discountDescription = updates.discountDescription.trim();
  if (updates.endDate) campaign.endDate = new Date(updates.endDate);
  if (typeof updates.isActive === 'boolean') campaign.isActive = updates.isActive;

  campaign.history.push({
    action: 'UPDATED',
    performedBy,
    timestamp: new Date(),
    details: 'Sale campaign settings updated by admin'
  });
  await campaign.save();
  cachedCampaign = campaign;
  lastCacheTime = Date.now();
  return campaign;
}

module.exports = {
  FESTIVE_DEALS_CATALOG,
  getProductEffectivePrice,
  isProductOnFestiveDiscount,
  isSaleCurrentlyActive,
  getLiveSaleCampaign,
  endLiveSale,
  resumeLiveSale,
  extendLiveSale,
  updateLiveSale
};
