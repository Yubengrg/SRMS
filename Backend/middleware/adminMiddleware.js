// middleware/adminMiddleware.js
const User = require('../models/User');

// Check if user is an admin
const isAdmin = async (req, res, next) => {
  try {
    // User should already be in req.user from auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no user'
      });
    }
    
    // Get fresh user data to ensure role is up to date
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized, admin access required'
      });
    }
    
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error in admin authorization'
    });
  }
};

module.exports = { isAdmin };