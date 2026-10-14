const User = require('../models/User');

/**
 * Seller or Admin Authorization Middleware
 * Allows access only to:
 * - Admin users: user.role === 'admin'
 * - Verified sellers: user.sellerDetails.verificationStatus === 'verified'
 *
 * Rejects:
 * - Unauthenticated users (401)
 * - Normal customers (403)
 * - Unverified or pending sellers (403)
 */
const sellerOrAdminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User account not found.'
      });
    }

    const isAdmin = user.role === 'admin';
    const isVerifiedSeller = Boolean(
      user.sellerDetails && user.sellerDetails.verificationStatus === 'verified'
    );

    if (!isAdmin && !isVerifiedSeller) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Admin or verified merchant privileges required.'
      });
    }

    if (isAdmin) {
      req.admin = user;
    }
    req.sellerUser = user;
    req.userDoc = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error verifying authorization',
      error: error.message
    });
  }
};

module.exports = {
  sellerOrAdminMiddleware
};
