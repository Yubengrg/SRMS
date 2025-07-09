// middleware/rmsMiddleware.js
const Restaurant = require('../models/Restaurant');
const mongoose = require('mongoose');
const RestaurantStaff = require('../models/RestaurantStaff');

// Middleware to check if user is a verified restaurant owner or staff
const isRestaurantOwner = async (req, res, next) => {
  try {
    // User should already be in req.user from auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no user'
      });
    }
    
    const userId = req.user.id;
    console.log('isRestaurantOwner middleware - userId:', userId);
    
    // Check multiple sources for restaurantId
    let restaurantId = req.user.restaurantId;
    console.log('isRestaurantOwner middleware - restaurantId from token:', restaurantId);
    
    // Try to get from query params if not in token
    if (!restaurantId && req.query && req.query.restaurantId) {
      console.log('Using restaurantId from query params:', req.query.restaurantId);
      restaurantId = req.query.restaurantId;
    }
    
    // Try to get from request body if not in token or query
    if (!restaurantId && req.body && req.body.restaurantId) {
      console.log('Using restaurantId from request body:', req.body.restaurantId);
      restaurantId = req.body.restaurantId;
    }
    
    // If still no restaurant ID, check if user has only one restaurant
    if (!restaurantId) {
      console.log('No restaurantId found, checking if user has only one restaurant');
      const userRestaurants = await Restaurant.find({
        owner: userId,
        verificationStatus: 'verified'
      });
      
      console.log(`Found ${userRestaurants.length} restaurants for user ${userId}`);
      
      if (userRestaurants.length === 1) {
        restaurantId = userRestaurants[0]._id;
        console.log('Using user\'s only restaurant:', restaurantId);
      } else {
        return res.status(403).json({
          success: false,
          message: 'No restaurant selected. Please select a restaurant first.'
        });
      }
    }
    
    // IMPORTANT: Ensure restaurantId is a proper ObjectId
    if (typeof restaurantId === 'string') {
      if (mongoose.Types.ObjectId.isValid(restaurantId)) {
        restaurantId = new mongoose.Types.ObjectId(restaurantId);
        console.log('Converted string restaurantId to ObjectId:', restaurantId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid restaurant ID format'
        });
      }
    }
    
    // Find restaurant by ID
    console.log(`Looking for restaurant with _id: ${restaurantId}`);
    const restaurant = await Restaurant.findOne({ 
      _id: restaurantId,
      verificationStatus: 'verified'
    });
    
    if (!restaurant) {
      console.log('Restaurant not found or not verified');
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or not verified'
      });
    }
    
    // Check if user is owner or staff
    let isOwner = false;
    let permissions = [];
    
    if (restaurant.owner.toString() === userId) {
      isOwner = true;
      permissions = ['all']; // Owner has all permissions
      console.log('User is the owner of this restaurant');
    } else {
      // Check if user is a staff member
      const staff = await RestaurantStaff.findOne({
        restaurant: restaurantId,
        user: userId,
        isActive: true
      });
      
      if (!staff) {
        console.log('User is not owner or staff of this restaurant');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have access to this restaurant.'
        });
      }
      
      // Staff member found, get their permissions
      permissions = staff.permissions || [];
      console.log('User is staff with permissions:', permissions);
    }
    
    // Check if user has inventory permission for inventory-related endpoints
    if (req.originalUrl.includes('/inventory') && 
        !permissions.includes('all') && 
        !permissions.includes('manage_inventory')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage inventory'
      });
    }
    
    // Add restaurant and role info to req object
    req.restaurant = restaurant;
    req.isRestaurantOwner = isOwner;
    req.permissions = permissions;
    
    console.log('Restaurant access granted, setting req.restaurant:', restaurant._id);
    next();
  } catch (error) {
    console.error('RMS middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in RMS authorization'
    });
  }
};

// Get user's restaurants (including owned and staff roles)
const getUserRestaurants = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Find restaurants where user is the owner
    const ownedRestaurants = await Restaurant.find({ 
      owner: userId,
      verificationStatus: 'verified'
    });
    
    // Find restaurants where user is staff
    const staffRestaurants = await RestaurantStaff.find({ 
      user: userId,
      isActive: true
    }).populate('restaurant');
    
    // Filter out restaurants that are not verified
    const verifiedStaffRestaurants = staffRestaurants
      .filter(staff => staff.restaurant && staff.restaurant.verificationStatus === 'verified')
      .map(staff => staff.restaurant);
    
    // Combine and deduplicate
    const allRestaurants = [
      ...ownedRestaurants,
      ...verifiedStaffRestaurants
    ];
    
    // De-duplicate by restaurant ID
    const uniqueRestaurants = Array.from(
      new Map(allRestaurants.map(r => [r._id.toString(), r])).values()
    );
    
    // Attach restaurants to request object
    req.restaurants = uniqueRestaurants;
    next();
  } catch (error) {
    console.error('Get user restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Check if user has at least one restaurant
const checkUserHasRestaurant = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user has a restaurant
    const restaurant = await Restaurant.findOne({ 
      owner: userId,
      verificationStatus: 'verified'
    });
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'You do not have a restaurant yet'
      });
    }
    
    // Attach restaurant to request object
    req.restaurant = restaurant;
    next();
  } catch (error) {
    console.error('Check user has restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Validate restaurant owner (stricter check, only owners)
const validateRestaurantOwner = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user.id;
    
    const restaurant = await Restaurant.findById(restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }
    
    // Check if user is the owner
    if (restaurant.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to perform this action'
      });
    }
    
    // Attach restaurant to request object
    req.restaurant = restaurant;
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  isRestaurantOwner,
  getUserRestaurants,
  checkUserHasRestaurant,
  validateRestaurantOwner
};