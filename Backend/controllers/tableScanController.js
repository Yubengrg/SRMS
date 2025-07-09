// controllers/tableScanController.js
const TableScan = require('../models/TableScan');
const Table = require('../models/Table');
const User = require('../models/User');
const mongoose = require('mongoose');
const { updateTableStatusSocket } = require('../socket/tableStatusSocket');

// Start a new scan when a QR code is scanned
const scanTable = async (req, res) => {
  try {
    const { tableId, numberOfGuests, specialRequests } = req.body;
    const userId = req.user.id;

    // Validate tableId
    if (!tableId || !mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid table ID is required'
      });
    }

    // Check if table exists
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Check if table is active
    if (!table.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This table is currently inactive'
      });
    }

    // Check if table status allows scanning
    if (table.status === 'maintenance') {
      return res.status(400).json({
        success: false,
        message: 'This table is currently under maintenance'
      });
    }

    // Create new scan
    const newScan = new TableScan({
      table: tableId,
      user: userId,
      scanTime: new Date(),
      active: true
    });

    await newScan.save();

    // Update table status and customer info
    table.status = 'occupied';
    table.currentCustomer = {
      userId: userId,
      name: req.user.name,
      phone: req.user.phoneNumber,
      numberOfGuests: numberOfGuests || 1,
      checkinTime: new Date(),
      specialRequests: specialRequests || '',
      isGuest: false
    };
    
    await table.save();

    // Emit socket event for real-time update
    if (global.io) {
      global.io.to(`restaurant_${table.restaurant}`).emit('tableStatusUpdate', {
        tableId: table._id,
        status: table.status,
        currentCustomer: table.currentCustomer
      });
    }

    // Populate restaurant info
    await table.populate('restaurant', 'name');

    res.status(201).json({
      success: true,
      message: 'Table scanned successfully',
      scan: newScan,
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        section: table.section,
        floor: table.floor,
        status: table.status,
        currentCustomer: table.currentCustomer,
        restaurant: table.restaurant
      }
    });
  } catch (error) {
    console.error('Scan table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while scanning table'
    });
  }
};

// controllers/tableScanController.js - Updated endScan method
// controllers/tableScanController.js - Fixed endScan method
const endScan = async (req, res) => {
  try {
    const { scanId } = req.params;
    const userId = req.user.id;

    // Find the scan
    const scan = await TableScan.findOne({
      _id: scanId,
      user: userId,
      active: true
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Active scan not found'
      });
    }

    // Find the table
    const table = await Table.findById(scan.table);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Check if table has an active order
    let hasActiveOrder = false;
    let orderStatus = null;

    if (table.currentOrder) {
      try {
        // Try to populate the current order
        await table.populate('currentOrder');
        
        if (table.currentOrder) {
          orderStatus = table.currentOrder.status;
          // Check if order is still active (not completed or cancelled)
          hasActiveOrder = !['completed', 'cancelled'].includes(orderStatus);
        }
      } catch (populateError) {
        console.log('Error populating currentOrder, but continuing...', populateError);
        // If population fails, assume no active order (currentOrder might be stale)
        hasActiveOrder = false;
      }
    } else {
      // No current order reference, so no active order
      hasActiveOrder = false;
    }

    // Additional check: Look for any active orders for this table directly in the Order collection
    if (!hasActiveOrder) {
      try {
        const Order = require('../models/Order');
        const activeOrder = await Order.findOne({
          table: table._id,
          status: { $nin: ['completed', 'cancelled'] }
        });
        
        if (activeOrder) {
          hasActiveOrder = true;
          orderStatus = activeOrder.status;
        }
      } catch (orderCheckError) {
        console.log('Error checking for active orders, but continuing...', orderCheckError);
      }
    }

    // If there's still an active order, prevent ending the session
    if (hasActiveOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot end table session while order is active. Please wait for your order to be completed or contact staff for assistance.',
        orderStatus: orderStatus
      });
    }

    // If we reach here, either there's no order or the order is completed/cancelled
    // Update scan to inactive
    scan.active = false;
    scan.endTime = new Date();
    await scan.save();

    // Check if there are other active scans for this table
    const otherActiveScans = await TableScan.countDocuments({
      table: scan.table,
      active: true
    });

    // If no other active scans, update table status back to available
    if (otherActiveScans === 0) {
      // Clear customer info and set table to available
      await table.clearCustomerInfo();
      
      // Emit socket event for real-time update
      if (global.io) {
        global.io.to(`restaurant_${table.restaurant}`).emit('tableStatusUpdate', {
          tableId: table._id,
          status: 'available',
          currentCustomer: null,
          currentOrder: null
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Scan ended successfully',
      scan
    });
  } catch (error) {
    console.error('End scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while ending scan'
    });
  }
};

// Handle guest scanning (no authentication required)
const scanTableGuest = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { guestName, guestPhone, numberOfGuests, specialRequests } = req.body;

    // Validate input
    if (!guestName || !guestPhone || !numberOfGuests) {
      return res.status(400).json({
        success: false,
        message: 'Guest name, phone, and number of guests are required'
      });
    }

    // Check if table exists
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Check if table is available
    if (table.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'This table is currently unavailable'
      });
    }

    // Update table status and guest info
    table.status = 'occupied';
    table.currentCustomer = {
      name: guestName,
      phone: guestPhone,
      numberOfGuests,
      checkinTime: new Date(),
      specialRequests: specialRequests || '',
      isGuest: true
    };
    
    await table.save();

    // Emit socket event for real-time update
    if (global.io) {
      global.io.to(`restaurant_${table.restaurant}`).emit('tableStatusUpdate', {
        tableId: table._id,
        status: table.status,
        currentCustomer: table.currentCustomer
      });
    }

    res.status(200).json({
      success: true,
      message: 'Table checked in successfully',
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        section: table.section,
        floor: table.floor,
        status: table.status,
        restaurant: table.restaurant
      }
    });
  } catch (error) {
    console.error('Guest scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking in'
    });
  }
};

// Get user's active scans
const getUserActiveScans = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user's active scans
    const activeScans = await TableScan.find({
      user: userId,
      active: true
    }).populate({
      path: 'table',
      select: 'tableNumber section floor status restaurant currentCustomer',
      populate: {
        path: 'restaurant',
        select: 'name'
      }
    });

    res.status(200).json({
      success: true,
      count: activeScans.length,
      scans: activeScans
    });
  } catch (error) {
    console.error('Get user active scans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active scans'
    });
  }
};

// Get user's scan history
const getUserScanHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Pagination options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { scanTime: -1 },
      populate: {
        path: 'table',
        select: 'tableNumber section floor restaurant',
        populate: {
          path: 'restaurant',
          select: 'name'
        }
      }
    };

    // Find user's scan history
    const scans = await TableScan.paginate({ user: userId }, options);

    res.status(200).json({
      success: true,
      scans: scans.docs,
      pagination: {
        total: scans.totalDocs,
        limit: scans.limit,
        page: scans.page,
        pages: scans.totalPages,
        hasNextPage: scans.hasNextPage,
        nextPage: scans.nextPage,
        hasPrevPage: scans.hasPrevPage,
        prevPage: scans.prevPage
      }
    });
  } catch (error) {
    console.error('Get user scan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching scan history'
    });
  }
};

// Get scans for a specific table (for restaurant owners)
const getTableScans = async (req, res) => {
  try {
    const { tableId } = req.params;
    const restaurantId = req.restaurant._id;
    const { active, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    // Check if table belongs to the restaurant
    const table = await Table.findOne({
      _id: tableId,
      restaurant: restaurantId
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found or does not belong to your restaurant'
      });
    }

    // Build query
    const query = { table: tableId };
    
    // Add active filter if provided
    if (active !== undefined) {
      query.active = active === 'true';
    }

    // Add date range filters if provided
    if (dateFrom || dateTo) {
      query.scanTime = {};
      if (dateFrom) {
        query.scanTime.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.scanTime.$lte = new Date(dateTo);
      }
    }

    // Pagination options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { scanTime: -1 },
      populate: {
        path: 'user',
        select: 'name email profilePicture'
      }
    };

    // Get table scans
    const scans = await TableScan.paginate(query, options);

    res.status(200).json({
      success: true,
      scans: scans.docs,
      pagination: {
        total: scans.totalDocs,
        limit: scans.limit,
        page: scans.page,
        pages: scans.totalPages,
        hasNextPage: scans.hasNextPage,
        nextPage: scans.nextPage,
        hasPrevPage: scans.hasPrevPage,
        prevPage: scans.prevPage
      }
    });
  } catch (error) {
    console.error('Get table scans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching table scans'
    });
  }
};

module.exports = {
  scanTable,
  endScan,
  scanTableGuest,
  getUserActiveScans,
  getUserScanHistory,
  getTableScans
};