// controllers/restaurantStaffController.js
const RestaurantStaff = require('../models/RestaurantStaff');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const jwt = require('jsonwebtoken');

// Search for users to add as staff
const searchUsers = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    
    if (!searchTerm || searchTerm.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 3 characters'
      });
    }
    
    // Search for users by email or name
    const users = await User.find({
      $or: [
        { email: { $regex: searchTerm, $options: 'i' } },
        { name: { $regex: searchTerm, $options: 'i' } },
        { phoneNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select('name email profilePicture');
    
    res.status(200).json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching users'
    });
  }
};

// Add a staff member to restaurant
const addStaffMember = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const restaurantId = req.restaurant._id;
    const ownerId = req.user.id;
    
    // Validate input
    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        message: 'User ID and role are required'
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is already staff at this restaurant
    const existingStaff = await RestaurantStaff.findOne({
      restaurant: restaurantId,
      user: userId
    });
    
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a staff member at this restaurant'
      });
    }
    
    // Set default permissions based on role
    const permissions = getDefaultPermissions(role);
    
    // Create staff record
    const staffMember = new RestaurantStaff({
      restaurant: restaurantId,
      user: userId,
      role,
      permissions,
      addedBy: ownerId
    });
    
    await staffMember.save();
    
    res.status(201).json({
      success: true,
      message: 'Staff member added successfully',
      staffMember: {
        id: staffMember._id,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        role: staffMember.role,
        permissions: staffMember.permissions
      }
    });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding staff member'
    });
  }
};

// Helper function to set default permissions based on role
const getDefaultPermissions = (role) => {
  switch(role) {
    case 'manager':
      return [
        'manage_menu', 'manage_tables', 'take_orders',
        'view_orders', 'manage_payments', 'view_reports'
      ];
    case 'waiter':
      return ['take_orders', 'view_orders'];
    case 'chef':
      return ['view_orders'];
    case 'cashier':
      return ['view_orders', 'manage_payments'];
    default:
      return [];
  }
};

// Get all staff for a restaurant
const getRestaurantStaff = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    const staffMembers = await RestaurantStaff.find({ 
      restaurant: restaurantId 
    }).populate('user', 'name email profilePicture');
    
    res.status(200).json({
      success: true,
      staffMembers: staffMembers.map(staff => ({
        id: staff._id,
        user: {
          id: staff.user._id,
          name: staff.user.name,
          email: staff.user.email,
          profilePicture: staff.user.profilePicture
        },
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive
      }))
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff members'
    });
  }
};

// Update staff member
const updateStaffMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions, isActive } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Find the staff record
    const staffMember = await RestaurantStaff.findOne({
      _id: id,
      restaurant: restaurantId
    }).populate('user', 'name email');
    
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    // Update fields
    if (role) {
      staffMember.role = role;
      // Reset permissions based on new role if not explicitly provided
      if (!permissions) {
        staffMember.permissions = getDefaultPermissions(role);
      }
    }
    
    if (permissions) {
      staffMember.permissions = permissions;
    }
    
    if (isActive !== undefined) {
      staffMember.isActive = isActive;
    }
    
    await staffMember.save();
    
    res.status(200).json({
      success: true,
      message: 'Staff member updated successfully',
      staffMember: {
        id: staffMember._id,
        user: {
          id: staffMember.user._id,
          name: staffMember.user.name,
          email: staffMember.user.email
        },
        role: staffMember.role,
        permissions: staffMember.permissions,
        isActive: staffMember.isActive
      }
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating staff member'
    });
  }
};

// Remove staff member
const removeStaffMember = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    const result = await RestaurantStaff.findOneAndDelete({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Staff member removed successfully'
    });
  } catch (error) {
    console.error('Remove staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing staff member'
    });
  }
};

// Staff login to RMS
const staffRmsLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if user is a staff member for any restaurant
    const staffPosition = await RestaurantStaff.findOne({
      user: user._id,
      isActive: true
    }).populate('restaurant', 'name verificationStatus');
    
    if (!staffPosition) {
      return res.status(403).json({
        success: false,
        message: 'You are not a staff member for any restaurant'
      });
    }
    
    // Check if the restaurant is verified
    if (staffPosition.restaurant.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'The restaurant is not verified yet'
      });
    }
    
    // Create token with staff info
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        restaurantId: staffPosition.restaurant._id,
        staffId: staffPosition._id,
        role: staffPosition.role,
        permissions: staffPosition.permissions,
        isStaff: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: staffPosition.role,
        permissions: staffPosition.permissions
      },
      restaurant: {
        id: staffPosition.restaurant._id,
        name: staffPosition.restaurant.name
      }
    });
  } catch (error) {
    console.error('Staff RMS login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

module.exports = {
  searchUsers,
  addStaffMember,
  getRestaurantStaff,
  updateStaffMember,
  removeStaffMember,
  staffRmsLogin
};