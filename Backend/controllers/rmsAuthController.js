// controllers/rmsAuthController.js
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// RMS Login for restaurant owners
const rmsLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ 
        success: false,
        message: "Your account is not verified. Please verify your email first." 
      });
    }

    // Check if user has any restaurants
    const restaurants = await Restaurant.find({ owner: user._id });
    if (restaurants.length === 0) {
      return res.status(403).json({ 
        success: false,
        message: "No restaurants associated with this account. Please register a restaurant first." 
      });
    }

    // Get verified restaurants
    const verifiedRestaurants = restaurants.filter(restaurant => 
      restaurant.verificationStatus === 'verified'
    );

    if (verifiedRestaurants.length === 0) {
      // Get pending restaurants to show status
      const pendingRestaurants = restaurants.filter(restaurant => 
        restaurant.verificationStatus === 'pending'
      );
      
      // Get rejected restaurants to show reason
      const rejectedRestaurants = restaurants.filter(restaurant => 
        restaurant.verificationStatus === 'rejected'
      );
      
      return res.status(403).json({ 
        success: false,
        message: "None of your restaurants are verified yet.",
        pendingRestaurants: pendingRestaurants.map(r => ({
          id: r._id,
          name: r.name,
          status: r.verificationStatus
        })),
        rejectedRestaurants: rejectedRestaurants.map(r => ({
          id: r._id,
          name: r.name,
          status: r.verificationStatus,
          reason: r.rejectionReason
        }))
      });
    }

    // If user has only one restaurant, automatically select it
    if (verifiedRestaurants.length === 1) {
      const restaurant = verifiedRestaurants[0];
      
      // Generate JWT token with user and restaurant info
      const token = jwt.sign(
        { 
          id: user._id, 
          email: user.email,
          restaurantId: restaurant._id 
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          verificationStatus: restaurant.verificationStatus
        },
        hasMultipleRestaurants: false
      });
    } else {
      // User has multiple restaurants, return them all
      // Generate JWT token with user info but without specific restaurant
      // User will need to select a restaurant after login
      const token = jwt.sign(
        { 
          id: user._id, 
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        success: true,
        message: "Login successful. Please select a restaurant to manage.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        restaurants: verifiedRestaurants.map(restaurant => ({
          id: restaurant._id,
          name: restaurant.name,
          verificationStatus: restaurant.verificationStatus
        })),
        hasMultipleRestaurants: true
      });
    }
  } catch (error) {
    console.error('RMS Login error:', error);
    return res.status(500).json({ 
      success: false,
      message: "Server error during login" 
    });
  }
};

// Select a restaurant to manage (for users with multiple restaurants)
const selectRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const userId = req.user.id; // From auth middleware
    
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Restaurant ID is required"
      });
    }
    
    // Verify the restaurant exists and belongs to the user
    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      owner: userId,
      verificationStatus: 'verified'
    });
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found or not verified"
      });
    }
    
    // Generate a new token that includes the selected restaurant
    const token = jwt.sign(
      { 
        id: userId, 
        email: req.user.email,
        restaurantId: restaurant._id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    return res.status(200).json({
      success: true,
      message: "Restaurant selected successfully",
      token,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      }
    });
  } catch (error) {
    console.error('Select restaurant error:', error);
    return res.status(500).json({
      success: false,
      message: "Server error while selecting restaurant"
    });
  }
};

// Verify RMS token
const verifyRmsToken = async (req, res) => {
  try {
    // User should already be in req.user from auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    // Get fresh user data
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if token has restaurantId
    if (!req.user.restaurantId) {
      // Get user's verified restaurants
      const restaurants = await Restaurant.find({ 
        owner: user._id,
        verificationStatus: 'verified' 
      });
      
      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        restaurants: restaurants.map(r => ({
          id: r._id,
          name: r.name
        })),
        hasMultipleRestaurants: true,
        needsRestaurantSelection: true
      });
    }
    
    // Get restaurant data for the selected restaurant
    const restaurant = await Restaurant.findOne({ 
      _id: req.user.restaurantId,
      owner: user._id,
      verificationStatus: 'verified' 
    });
    
    if (!restaurant) {
      return res.status(403).json({
        success: false,
        message: 'No verified restaurant found for this selection'
      });
    }
    
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      hasMultipleRestaurants: false
    });
  } catch (error) {
    console.error('Verify RMS token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during token verification'
    });
  }
};

module.exports = { rmsLogin, verifyRmsToken, selectRestaurant };