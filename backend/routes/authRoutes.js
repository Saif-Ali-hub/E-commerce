const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Helper to format and mask seller details in API responses
function formatSellerDetails(seller) {
  if (!seller || !seller.businessName) return undefined;
  const rawPan = (seller.pan || '').toString().trim().toUpperCase();
  const maskedPan = rawPan.length === 10
    ? `${rawPan.slice(0, 5)}****${rawPan.slice(9)}`
    : (rawPan ? `${rawPan.slice(0, 2)}****` : '');

  return {
    businessName: seller.businessName || '',
    businessAddress: seller.businessAddress || '',
    contactNumber: seller.contactNumber || '',
    gstin: seller.gstin || 'Not Applicable',
    pan: maskedPan,
    verificationStatus: seller.verificationStatus || 'pending'
  };
}

// ============================================================
// 1. POST /api/auth/register - Register a new user
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, isSeller, role, phone, businessName, businessAddress, pan, gstin } = req.body;

    // Validate presence of base required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Validate password: minimum 8 characters AND must contain both letters and numbers
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasNumber) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and contain both letters and numbers.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Determine requested role (only allow 'customer' or 'seller' - never allow 'admin')
    const requestedRole = (isSeller === true || isSeller === 'true' || role === 'seller') ? 'seller' : 'customer';

    // Validate seller-specific fields if registering as seller
    let sellerDetails = undefined;
    const contactPhone = (phone ? String(phone).trim() : '') || (req.body.contactNumber ? String(req.body.contactNumber).trim() : '');

    if (requestedRole === 'seller') {
      if (!businessName || !String(businessName).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business name is required for seller registration.'
        });
      }

      if (!businessAddress || !String(businessAddress).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business address is required for seller registration.'
        });
      }

      if (!contactPhone) {
        return res.status(400).json({
          success: false,
          message: 'Contact number is required for seller registration.'
        });
      }

      const phoneClean = contactPhone.replace(/[\s\-\+]/g, '');
      if (phoneClean.length < 10 || phoneClean.length > 15 || !/^\d+$/.test(phoneClean)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit mobile / contact number.'
        });
      }

      if (!pan || !String(pan).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business PAN is required for seller registration.'
        });
      }

      const normalizedPan = String(pan).trim().toUpperCase();
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(normalizedPan)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Business PAN format. PAN must be 10 characters (e.g. ABCDE1234F).'
        });
      }

      let normalizedGstin = '';
      if (gstin && String(gstin).trim() && !/^(na|n\/a|not applicable|none|exempt)$/i.test(String(gstin).trim())) {
        normalizedGstin = String(gstin).trim().toUpperCase();
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(normalizedGstin)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid GSTIN format. Must be 15 characters (e.g. 22AAAAA0000A1Z5) or left blank if exempt.'
          });
        }
      }

      sellerDetails = {
        businessName: String(businessName).trim(),
        businessAddress: String(businessAddress).trim(),
        contactNumber: contactPhone,
        pan: normalizedPan,
        gstin: normalizedGstin || '',
        verificationStatus: 'pending'
      };
    }

    // Hash password with bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create and save new user (force requestedRole to either customer or seller)
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: requestedRole,
      status: 'active',
      phone: contactPhone,
      sellerDetails: requestedRole === 'seller' ? sellerDetails : undefined,
      cart: [],
      wishlist: []
    });

    const savedUser = await newUser.save();

    // Respond without password and with masked PAN
    res.status(201).json({
      success: true,
      message: requestedRole === 'seller' ? 'Seller registered successfully (Pending Verification)' : 'User registered successfully',
      data: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role || 'customer',
        phone: savedUser.phone || '',
        avatar: savedUser.avatar || '',
        sellerDetails: savedUser.role === 'seller' ? formatSellerDetails(savedUser.sellerDetails) : undefined,
        createdAt: savedUser.createdAt
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error registering user',
      error: error.message
    });
  }
});

// ============================================================
// 2. POST /api/auth/login - Authenticate user & return JWT
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user in database
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare provided password with hashed password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_miniecommerce_2026_secure';
    const token = jwt.sign(
      { id: user._id },
      jwtSecret,
      { expiresIn: '1d' }
    );

    // Return token and sanitized user details
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'customer',
        phone: user.phone || '',
        avatar: user.avatar || '',
        sellerDetails: user.role === 'seller' ? formatSellerDetails(user.sellerDetails) : undefined,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// ============================================================
// 3. GET /api/auth/me - Protected route: Return current user info
// ============================================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Find authenticated user by ID attached from JWT middleware
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'customer',
        status: user.status || 'active',
        phone: user.phone || '',
        avatar: user.avatar || '',
        sellerDetails: user.role === 'seller' ? formatSellerDetails(user.sellerDetails) : undefined,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user profile',
      error: error.message
    });
  }
});

// Alias: GET /api/auth/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'customer',
        status: user.status || 'active',
        phone: user.phone || '',
        avatar: user.avatar || '',
        sellerDetails: user.role === 'seller' ? formatSellerDetails(user.sellerDetails) : undefined,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user profile',
      error: error.message
    });
  }
});

// ============================================================
// 4. PUT /api/auth/profile - Protected route: Update user profile
// ============================================================
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (name && typeof name === 'string' && name.trim().length > 0) {
      user.name = name.trim();
    }

    if (phone !== undefined && typeof phone === 'string') {
      user.phone = phone.trim();
    }

    if (avatar !== undefined && typeof avatar === 'string') {
      user.avatar = avatar.trim();
    }

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role || 'customer',
        phone: updatedUser.phone || '',
        avatar: updatedUser.avatar || '',
        sellerDetails: updatedUser.role === 'seller' ? formatSellerDetails(updatedUser.sellerDetails) : undefined,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating profile',
      error: error.message
    });
  }
});

module.exports = router;
