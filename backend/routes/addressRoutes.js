const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Address = require('../models/Address');
const authMiddleware = require('../middleware/auth');

// Pincode Zones Directory for Indian Postal System
const PIN_ZONE_DIRECTORY = {
  '1': { zone: 'North Zone', region: 'Delhi, Haryana, Punjab, HP, J&K', days: '1-2 Days', cod: true },
  '2': { zone: 'North Zone', region: 'Uttar Pradesh, Uttarakhand', days: '2-3 Days', cod: true },
  '3': { zone: 'West Zone', region: 'Rajasthan, Gujarat', days: '2-3 Days', cod: true },
  '4': { zone: 'West Zone', region: 'Maharashtra, Goa, MP, Chhattisgarh', days: '2-3 Days', cod: true },
  '5': { zone: 'South Zone', region: 'Karnataka, Andhra Pradesh, Telangana', days: '2-3 Days', cod: true },
  '6': { zone: 'South Zone', region: 'Tamil Nadu, Kerala', days: '2-3 Days', cod: true },
  '7': { zone: 'East Zone', region: 'West Bengal, Odisha, North-East', days: '3-4 Days', cod: true },
  '8': { zone: 'East Zone', region: 'Bihar, Jharkhand', days: '3-4 Days', cod: true },
  '9': { zone: 'Army Postal Zone', region: 'Field Post Offices', days: '3-5 Days', cod: false }
};

const METRO_PINCODES = {
  '110': { city: 'New Delhi', state: 'Delhi', days: 'Tomorrow', express: true },
  '400': { city: 'Mumbai', state: 'Maharashtra', days: '1-2 Days', express: true },
  '411': { city: 'Pune', state: 'Maharashtra', days: '1-2 Days', express: true },
  '560': { city: 'Bengaluru', state: 'Karnataka', days: '1-2 Days', express: true },
  '500': { city: 'Hyderabad', state: 'Telangana', days: '1-2 Days', express: true },
  '600': { city: 'Chennai', state: 'Tamil Nadu', days: '1-2 Days', express: true },
  '700': { city: 'Kolkata', state: 'West Bengal', days: '1-2 Days', express: true },
  '380': { city: 'Ahmedabad', state: 'Gujarat', days: '1-2 Days', express: true },
  '302': { city: 'Jaipur', state: 'Rajasthan', days: '1-2 Days', express: true },
  '226': { city: 'Lucknow', state: 'Uttar Pradesh', days: '2 Days', express: true },
  '160': { city: 'Chandigarh', state: 'Chandigarh', days: '1-2 Days', express: true }
};

// ============================================================
// Public: GET /api/addresses/check-pincode/:pincode
// Fast delivery estimator & courier serviceability
// ============================================================
router.get('/check-pincode/:pincode', (req, res) => {
  try {
    const rawPin = String(req.params.pincode || '').trim();
    const pinRegex = /^[1-9][0-9]{5}$/;

    if (!pinRegex.test(rawPin)) {
      return res.status(400).json({
        success: false,
        serviceable: false,
        message: 'Please enter a valid 6-digit Indian PIN code (e.g. 110001, 560001).'
      });
    }

    const firstChar = rawPin[0];
    const first3 = rawPin.substring(0, 3);
    const zoneInfo = PIN_ZONE_DIRECTORY[firstChar] || { zone: 'All-India Zone', region: 'India', days: '3-5 Days', cod: true };
    const metroInfo = METRO_PINCODES[first3] || null;

    // Calculate delivery date target
    const now = new Date();
    let addDays = 3;
    if (metroInfo && metroInfo.days === 'Tomorrow') {
      addDays = 1;
    } else if (zoneInfo.days.includes('1-2')) {
      addDays = 2;
    } else if (zoneInfo.days.includes('2-3')) {
      addDays = 3;
    } else {
      addDays = 4;
    }

    const deliveryDate = new Date(now.getTime() + addDays * 24 * 60 * 60 * 1000);
    const dateFormatted = deliveryDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    const city = metroInfo ? metroInfo.city : zoneInfo.region.split(',')[0].trim();
    const state = metroInfo ? metroInfo.state : zoneInfo.zone;

    res.status(200).json({
      success: true,
      serviceable: true,
      pincode: rawPin,
      city,
      state,
      zone: zoneInfo.zone,
      estimatedDeliveryDate: dateFormatted,
      estimatedDays: metroInfo ? metroInfo.days : zoneInfo.days,
      freeDelivery: true,
      codAvailable: zoneInfo.cod,
      expressAvailable: Boolean(metroInfo && metroInfo.express),
      cutoffText: 'Order within 3 hrs 15 mins for fastest dispatch'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      serviceable: false,
      message: 'Server error checking pincode',
      error: error.message
    });
  }
});

// All address CRUD routes below require JWT authentication
router.use(authMiddleware);

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ============================================================
// 1. GET /api/addresses - Retrieve all addresses for authenticated user
// ============================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Return addresses belonging to the authenticated user, default first, then newest
    const addresses = await Address.find({ user: userId }).sort({
      isDefault: -1,
      updatedAt: -1
    });

    res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving addresses',
      error: error.message
    });
  }
});

// ============================================================
// 2. GET /api/addresses/:id - Retrieve a single address by ID
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID format'
      });
    }

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      data: address
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving address',
      error: error.message
    });
  }
});

// ============================================================
// 3. POST /api/addresses - Create a new address for authenticated user
// ============================================================
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      addressType,
      isDefault
    } = req.body;

    // Check if this is the user's first address
    const existingCount = await Address.countDocuments({ user: userId });

    // First address must automatically become the default
    const shouldBeDefault = existingCount === 0 ? true : Boolean(isDefault);

    // If setting as default, unset default on all other addresses belonging to this user
    if (shouldBeDefault && existingCount > 0) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const address = new Address({
      user: userId,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country: country || 'India',
      addressType: addressType || 'Home',
      isDefault: shouldBeDefault
    });

    const savedAddress = await address.save();

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: savedAddress
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error creating address',
      error: error.message
    });
  }
});

// ============================================================
// 4. PUT /api/addresses/:id/default - Set an address as default
// ============================================================
router.put('/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID format'
      });
    }

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Unset default on all other addresses of this user
    await Address.updateMany(
      { user: userId, _id: { $ne: address._id } },
      { isDefault: false }
    );

    address.isDefault = true;
    const updatedAddress = await address.save();

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: updatedAddress
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error setting default address',
      error: error.message
    });
  }
});

// ============================================================
// 5. PUT /api/addresses/:id - Update an address
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID format'
      });
    }

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      addressType,
      isDefault
    } = req.body;

    // Handle isDefault logic
    if (isDefault === true && !address.isDefault) {
      // Unset default on all other addresses
      await Address.updateMany(
        { user: userId, _id: { $ne: address._id } },
        { isDefault: false }
      );
      address.isDefault = true;
    } else if (isDefault === false && address.isDefault) {
      // If user unsets default, see if there are other addresses
      const otherAddress = await Address.findOne({
        user: userId,
        _id: { $ne: address._id }
      });
      if (otherAddress) {
        otherAddress.isDefault = true;
        await otherAddress.save();
        address.isDefault = false;
      }
      // If no other address, remains the only address (can keep default or set false)
    }

    // Update fields if provided
    if (fullName !== undefined) address.fullName = fullName;
    if (phone !== undefined) address.phone = phone;
    if (addressLine1 !== undefined) address.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (postalCode !== undefined) address.postalCode = postalCode;
    if (country !== undefined) address.country = country;
    if (addressType !== undefined) address.addressType = addressType;

    const updatedAddress = await address.save();

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: updatedAddress
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating address',
      error: error.message
    });
  }
});

// ============================================================
// 6. DELETE /api/addresses/:id - Delete an address
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID format'
      });
    }

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const wasDefault = address.isDefault;

    await Address.findByIdAndDelete(address._id);

    // If the deleted address was default, promote another address to default if one exists
    if (wasDefault) {
      const remainingAddress = await Address.findOne({ user: userId }).sort({
        updatedAt: -1
      });
      if (remainingAddress) {
        remainingAddress.isDefault = true;
        await remainingAddress.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting address',
      error: error.message
    });
  }
});

module.exports = router;
