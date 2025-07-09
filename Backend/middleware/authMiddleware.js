// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check if authorization header exists and has Bearer token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // If no token was provided
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, no token'
        });
      }
      
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Debug decoded token
        console.log('Decoded token:', decoded);
        
        // Get user from the token (excluding password)
        req.user = await User.findById(decoded.id).select('-password');
        
        // Debug user object
        console.log('User from token:', {
          id: req.user?._id,
          email: req.user?.email,
          role: req.user?.role
        });
        
        if (!req.user) {
          throw new Error('User not found');
        }
        
        next();
      } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
          success: false,
          message: 'Not authorized, invalid token'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authorization'
    });
  }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check if authorization header exists and has Bearer token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      if (token) {
        try {
          // Verify token
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Get user from the token (excluding password)
          req.user = await User.findById(decoded.id).select('-password');
          
          // Log the user if found
          if (req.user) {
            console.log('User from token:', {
              id: req.user._id,
              email: req.user.email,
              role: req.user.role
            });
          }
        } catch (error) {
          // Failed to verify token, but continue without user
          console.log('Optional auth - invalid token:', error.message);
        }
      }
    }
    
    // Continue regardless of authentication result
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Continue without user authentication
    next();
  }
};

// Role authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    // Check if user's role is included in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this resource`
      });
    }
    
    next();
  };
};

module.exports = { protect, optionalAuth, authorize };