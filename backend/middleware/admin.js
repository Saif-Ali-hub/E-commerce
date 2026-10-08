const User = require('../models/User');

/**
 * Admin Authorization Middleware
 * Verifies that the authenticated user has the 'admin' role in MongoDB.
 * Must be used after authMiddleware.
 */
const adminMiddleware = async (req, res, next) => {
  try {
    // If request has not been authenticated via JWT authMiddleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    // Always fetch user directly from MongoDB as the single source of truth
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User account not found.'
      });
    }

    // Check if user has admin privileges
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Admin privileges required.'
      });
    }

    // Attach verified admin user document to request
    req.admin = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error verifying authorization',
      error: error.message
    });
  }
};

module.exports = adminMiddleware;
