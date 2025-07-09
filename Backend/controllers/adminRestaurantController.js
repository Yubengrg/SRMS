// controllers/adminRestaurantController.js
const Restaurant = require('../models/Restaurant');

// Get all restaurant verification requests
const getAllRestaurantVerifications = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get only restaurants with pending verification by default
    const status = req.query.status || 'pending';
    
    // Create filter
    const filter = {};
    if (status !== 'all') {
      filter.verificationStatus = status;
    }
    
    // Get total count for pagination
    const total = await Restaurant.countDocuments(filter);
    
    // Get restaurant requests with owner data
    const restaurants = await Restaurant.find(filter)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      restaurants,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ message: 'Server error while fetching verification requests' });
  }
};

// Get a single restaurant verification details
const getVerificationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const restaurant = await Restaurant.findById(id)
      .populate('owner', 'name email phoneNumber');
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant verification request not found' });
    }
    
    res.status(200).json({ restaurant });
  } catch (error) {
    console.error('Get verification details error:', error);
    res.status(500).json({ message: 'Server error while fetching verification details' });
  }
};

// Approve a restaurant verification
const approveVerification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const restaurant = await Restaurant.findById(id);
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant verification request not found' });
    }
    
    // Update verification status
    restaurant.verificationStatus = 'verified';
    restaurant.rejectionReason = null; // Clear any previous rejection reason
    
    await restaurant.save();
    
    // TODO: Send email notification to restaurant owner
    
    res.status(200).json({ 
      message: 'Restaurant verification approved successfully',
      restaurant
    });
  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({ message: 'Server error while approving verification' });
  }
};

// Reject a restaurant verification
const rejectVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    const restaurant = await Restaurant.findById(id);
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant verification request not found' });
    }
    
    // Update verification status
    restaurant.verificationStatus = 'rejected';
    restaurant.rejectionReason = reason;
    
    await restaurant.save();
    
    // TODO: Send email notification to restaurant owner
    
    res.status(200).json({ 
      message: 'Restaurant verification rejected successfully',
      restaurant
    });
  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({ message: 'Server error while rejecting verification' });
  }
};

module.exports = {
  getAllRestaurantVerifications,
  getVerificationDetails,
  approveVerification,
  rejectVerification,
};