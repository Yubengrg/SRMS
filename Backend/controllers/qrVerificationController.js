// controllers/qrVerificationController.js
const Table = require('../models/Table');
const Restaurant = require('../models/Restaurant');
const mongoose = require('mongoose');

// Verify QR code and return table information
const verifyQRCode = async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(restaurantId) || !mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code'
      });
    }

    // Find table with restaurant info
    const table = await Table.findOne({
      _id: tableId,
      restaurant: restaurantId
    }).populate('restaurant', 'name logo description address');

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Check if table is inactive
    if (!table.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This table is currently inactive'
      });
    }

    // Return table and restaurant information
    res.status(200).json({
      success: true,
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        section: table.section,
        floor: table.floor,
        status: table.status
      },
      restaurant: table.restaurant
    });
  } catch (error) {
    console.error('QR verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying QR code'
    });
  }
};

// Get table details for displaying menu
const getTableDetails = async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;

    // Find table with restaurant info
    const table = await Table.findOne({
      _id: tableId,
      restaurant: restaurantId
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Get restaurant with menu categories
    const restaurant = await Restaurant.findById(restaurantId)
      .populate({
        path: 'menuCategories',
        select: 'name description isActive',
        match: { isActive: true },
        populate: {
          path: 'menuItems',
          select: 'name description price image isAvailable options',
          match: { isAvailable: true }
        }
      });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.status(200).json({
      success: true,
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        section: table.section,
        floor: table.floor
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        logo: restaurant.logo,
        description: restaurant.description,
        address: restaurant.address,
        menuCategories: restaurant.menuCategories
      }
    });
  } catch (error) {
    console.error('Get table details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching table details'
    });
  }
};

module.exports = {
  verifyQRCode,
  getTableDetails
};