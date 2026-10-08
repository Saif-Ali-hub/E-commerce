const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// ============================================================
// 1. POST /api/auth/register - Register a new user
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate presence of required fields
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

    // Hash password with bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create and save new user (force role: 'customer' to prevent privilege escalation)
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'customer'
    });

    const savedUser = await newUser.save();

    // Respond without password
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role || 'customer',
        phone: savedUser.phone || '',
        avatar: savedUser.avatar || '',
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
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
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
        phone: user.phone || '',
        avatar: user.avatar || '',
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
