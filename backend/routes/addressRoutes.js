const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Address = require('../models/Address');
const authMiddleware = require('../middleware/auth');

// All address routes require JWT authentication
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
