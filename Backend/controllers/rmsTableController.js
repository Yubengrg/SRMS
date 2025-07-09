// controllers/rmsTableController.js
const Table = require('../models/Table');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
// Add Order model import
let Order;
try {
  Order = mongoose.model('Order'); // Try to get Order model if it exists
} catch (e) {
  // Order model doesn't exist yet, which is fine
  console.log('Order model not available yet');
}

// Helper to generate and save QR code
const generateQRCode = async (restaurantId, tableId, tableNumber) => {
  try {
    // Create directory if it doesn't exist
    const dir = './uploads/restaurants/qrcodes';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Get base URL from environment or use a default
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Data to encode in QR code (URL to access table's ordering page)
    const data = `${baseUrl}/menu/${restaurantId}/${tableId}`;
    
    // Generate unique filename
    const filename = `table-${restaurantId}-${tableNumber}-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    
    // Generate QR code
    await QRCode.toFile(filePath, data, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });
    
    return `/uploads/restaurants/qrcodes/${filename}`;
  } catch (error) {
    console.error('QR code generation error:', error);
    // Return null instead of throwing an error
    return null;
  }
};

// Create a new table
const createTable = async (req, res) => {
  try {
    const { tableNumber, capacity, section, floor, isActive } = req.body;
    
    // Important: Get restaurant ID from req.restaurant
    const restaurantId = req.restaurant._id;
    
    // Debug logging
    console.log('Creating table with restaurantId:', restaurantId);
    console.log('Restaurant ID type:', typeof restaurantId);
    console.log('Table Number:', tableNumber);
    
    if (!tableNumber || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Table number and capacity are required'
      });
    }
    
    // Make sure restaurant ID is an ObjectID
    const restaurantObjectId = mongoose.Types.ObjectId.isValid(restaurantId.toString()) 
      ? new mongoose.Types.ObjectId(restaurantId.toString()) 
      : restaurantId;
    
    console.log('Restaurant ObjectId for query:', restaurantObjectId);
    
    // Find existing tables for this restaurant with this number
    const existingTable = await Table.findOne({
      restaurant: restaurantObjectId,
      tableNumber: tableNumber.trim()
    });
    
    console.log('Existing table check result:', existingTable);
    
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: `A table with number "${tableNumber}" already exists in this restaurant`
      });
    }
    
    // Create new table with normalized data
    const newTable = new Table({
      restaurant: restaurantObjectId,
      tableNumber: tableNumber.trim(),
      capacity: parseInt(capacity),
      section: section || 'Main',
      floor: floor || 'Ground',
      status: 'available',
      isActive: isActive !== false
    });
    
    // Generate QR code
    try {
      newTable.qrCode = await generateQRCode(restaurantId, newTable._id, tableNumber);
    } catch (qrError) {
      console.error('QR generation error:', qrError);
      // Continue without QR code
    }
    
    // Debug log before saving
    console.log('Saving new table with data:', {
      restaurant: newTable.restaurant,
      tableNumber: newTable.tableNumber,
      capacity: newTable.capacity
    });
    
    await newTable.save();
    
    res.status(201).json({
      success: true,
      message: 'Table created successfully',
      table: newTable
    });
  } catch (error) {
    console.error('Create table error details:', error);
    
    // Enhanced error handling for MongoDB errors
    if (error.code === 11000) {
      // Extract the duplicate key error details
      let errorDetail = error.message;
      if (error.keyValue) {
        errorDetail = JSON.stringify(error.keyValue);
      }
      
      return res.status(400).json({
        success: false,
        message: 'A table with this number already exists. Please use a different table number.',
        details: errorDetail
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating table',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all tables for a restaurant
const getAllTables = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    console.log('Fetching tables for restaurantId:', restaurantId);
    
    const { section, floor, status, isActive } = req.query;
    
    // Build query
    const query = { restaurant: restaurantId };
    
    if (section) query.section = section;
    if (floor) query.floor = floor;
    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    console.log('Table query:', query);
    
    // Get tables
    let tables;
    
    // Only try to populate currentOrder if Order model exists
    if (Order) {
      tables = await Table.find(query)
        .sort({ section: 1, floor: 1, tableNumber: 1 })
        .populate('currentOrder', 'orderNumber status totalAmount');
    } else {
      // If Order model doesn't exist, don't try to populate
      tables = await Table.find(query)
        .sort({ section: 1, floor: 1, tableNumber: 1 });
    }
    
    console.log(`Found ${tables.length} tables for restaurant:`, restaurantId);
    
    // Get sections and floors for filtering
    const sections = await Table.distinct('section', { restaurant: restaurantId });
    const floors = await Table.distinct('floor', { restaurant: restaurantId });
    
    res.status(200).json({
      success: true,
      count: tables.length,
      tables,
      filters: {
        sections,
        floors
      }
    });
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tables'
    });
  }
};

// Get a single table
const getTable = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    let table;
    
    if (Order) {
      table = await Table.findOne({
        _id: id,
        restaurant: restaurantId
      }).populate('currentOrder', 'orderNumber status totalAmount items');
    } else {
      table = await Table.findOne({
        _id: id,
        restaurant: restaurantId
      });
    }
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    res.status(200).json({
      success: true,
      table
    });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching table'
    });
  }
};

// Update a table
const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { tableNumber, capacity, section, floor, status, isActive } = req.body;
    const restaurantId = req.restaurant._id;
    
    console.log(`Updating table ${id} for restaurant ${restaurantId}`);
    
    // Find table
    const table = await Table.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Check if updating to an existing table number
    if (tableNumber && tableNumber !== table.tableNumber) {
      // Convert restaurant ID to ObjectId if needed
      const restaurantObjectId = mongoose.Types.ObjectId.isValid(restaurantId.toString()) 
        ? new mongoose.Types.ObjectId(restaurantId.toString()) 
        : restaurantId;
        
      const existingTable = await Table.findOne({
        restaurant: restaurantObjectId,
        tableNumber: tableNumber.trim(),
        _id: { $ne: id }
      });
      
      console.log('Existing table check for update:', existingTable);
      
      if (existingTable) {
        return res.status(400).json({
          success: false,
          message: `A table with number "${tableNumber}" already exists in this restaurant`
        });
      }
    }
    
    // Update fields
    if (tableNumber) table.tableNumber = tableNumber.trim();
    if (capacity) table.capacity = parseInt(capacity);
    if (section) table.section = section;
    if (floor) table.floor = floor;
    if (status) table.status = status;
    if (isActive !== undefined) table.isActive = isActive === true;
    
    // If table number changed, generate new QR code
    if (tableNumber && tableNumber !== table.tableNumber) {
      try {
        table.qrCode = await generateQRCode(restaurantId, table._id, tableNumber);
      } catch (qrError) {
        console.error('QR update error:', qrError);
        // Continue without updating QR code
      }
    }
    
    await table.save();
    
    res.status(200).json({
      success: true,
      message: 'Table updated successfully',
      table
    });
  } catch (error) {
    console.error('Update table error:', error);
    
    // Enhanced error handling for MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A table with this number already exists. Please use a different table number.',
        details: error.keyValue
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating table'
    });
  }
};

// Delete a table
const deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find table
    const table = await Table.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Check if table has active order
    if (table.currentOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with active order'
      });
    }
    
    // Check if table has future reservations
    const futureReservations = table.reservations && table.reservations.filter(
      reservation => new Date(reservation.startTime) > new Date() 
                    && reservation.status !== 'cancelled'
                    && reservation.status !== 'no-show'
    );
    
    if (futureReservations && futureReservations.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete table with ${futureReservations.length} future reservations`
      });
    }
    
    // Delete QR code file if exists
    if (table.qrCode) {
      const qrCodePath = path.join(__dirname, '..', table.qrCode);
      if (fs.existsSync(qrCodePath)) {
        try {
          fs.unlinkSync(qrCodePath);
        } catch (err) {
          console.error('Error deleting QR code file:', err);
          // Continue with deletion even if QR file deletion fails
        }
      }
    }
    
    // Delete table
    await Table.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Table deleted successfully'
    });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting table'
    });
  }
};

// Change table status
const changeTableStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantId = req.restaurant._id;
    
    if (!status || !['available', 'reserved', 'occupied', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    // Find table
    const table = await Table.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Check if table can be marked as available when it has an active order
    if (status === 'available' && table.currentOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark table as available while it has an active order'
      });
    }
    
    // Update status
    table.status = status;
    
    // If status is available, clear current order
    if (status === 'available') {
      table.currentOrder = null;
    }
    
    await table.save();
    
    res.status(200).json({
      success: true,
      message: 'Table status updated successfully',
      table
    });
  } catch (error) {
    console.error('Change table status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating table status'
    });
  }
};

// Regenerate QR code
const regenerateQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find table
    const table = await Table.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Delete old QR code if exists
    if (table.qrCode) {
      const qrCodePath = path.join(__dirname, '..', table.qrCode);
      if (fs.existsSync(qrCodePath)) {
        try {
          fs.unlinkSync(qrCodePath);
        } catch (err) {
          console.error('Error deleting old QR code:', err);
          // Continue even if old file deletion fails
        }
      }
    }
    
    // Generate new QR code
    try {
      table.qrCode = await generateQRCode(restaurantId, table._id, table.tableNumber);
      await table.save();
      
      res.status(200).json({
        success: true,
        message: 'QR code regenerated successfully',
        qrCode: table.qrCode
      });
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating QR code'
      });
    }
  } catch (error) {
    console.error('Regenerate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while regenerating QR code'
    });
  }
};

// Add reservation to table
const addReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      startTime, endTime, customerName, customerPhone, 
      customerEmail, partySize, notes 
    } = req.body;
    const restaurantId = req.restaurant._id;
    
    if (!startTime || !endTime || !customerName || !partySize) {
      return res.status(400).json({
        success: false,
        message: 'Start time, end time, customer name, and party size are required'
      });
    }
    
    // Find table
    const table = await Table.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
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
        message: 'Cannot make reservation for inactive table'
      });
    }
    
    // Parse dates
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    
    // Validate dates
    if (startDateTime >= endDateTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }
    
    if (startDateTime < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot make reservation in the past'
      });
    }
    
    // Check if table is available at the requested time
    if (!table.isAvailableAt(startDateTime, endDateTime)) {
      return res.status(400).json({
        success: false,
        message: 'Table is not available at the requested time'
      });
    }
    
    // Create reservation
    const reservation = {
      startTime: startDateTime,
      endTime: endDateTime,
      customerName,
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      partySize: parseInt(partySize),
      notes: notes || '',
      status: 'confirmed'
    };
    
    // Add reservation to table
    table.reservations.push(reservation);
    await table.save();
    
    res.status(201).json({
      success: true,
      message: 'Reservation added successfully',
      reservation: table.reservations[table.reservations.length - 1]
    });
  } catch (error) {
    console.error('Add reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding reservation'
    });
  }
};

// Update reservation
const updateReservation = async (req, res) => {
  try {
    const { tableId, reservationId } = req.params;
    const { 
      startTime, endTime, customerName, customerPhone, 
      customerEmail, partySize, notes, status 
    } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Find table
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
    
    // Find reservation
    const reservation = table.reservations.id(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }
    
    // If updating time, validate
    if (startTime && endTime) {
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(endTime);
      
      // Validate dates
      if (startDateTime >= endDateTime) {
        return res.status(400).json({
          success: false,
          message: 'End time must be after start time'
        });
      }
      
      // Remove current reservation from list to check availability
      const currentReservationIndex = table.reservations.findIndex(
        r => r._id.toString() === reservationId
      );
      
      const tempReservations = [...table.reservations];
      tempReservations.splice(currentReservationIndex, 1);
      
      // Check for conflicts with other reservations
      const conflict = tempReservations.some(r => {
        if (r.status === 'cancelled' || r.status === 'no-show') {
          return false;
        }
        
        return (startDateTime < new Date(r.endTime) && endDateTime > new Date(r.startTime));
      });
      
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: 'Updated time conflicts with another reservation'
        });
      }
      
      reservation.startTime = startDateTime;
      reservation.endTime = endDateTime;
    }
    
    // Update other fields
    if (customerName) reservation.customerName = customerName;
    if (customerPhone !== undefined) reservation.customerPhone = customerPhone;
    if (customerEmail !== undefined) reservation.customerEmail = customerEmail;
    if (partySize) reservation.partySize = parseInt(partySize);
    if (notes !== undefined) reservation.notes = notes;
    if (status && ['confirmed', 'seated', 'completed', 'no-show', 'cancelled'].includes(status)) {
      reservation.status = status;
    }
    
    await table.save();
    
    res.status(200).json({
      success: true,
      message: 'Reservation updated successfully',
      reservation
    });
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating reservation'
    });
  }
};

// Cancel reservation
const cancelReservation = async (req, res) => {
  try {
    const { tableId, reservationId } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find table
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
    
    // Find reservation
    const reservation = table.reservations.id(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }
    
    // Update status to cancelled
    reservation.status = 'cancelled';
    await table.save();
    
    res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully',
      reservation
    });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling reservation'
    });
  }
};

// Get all reservations
const getAllReservations = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { date, status, upcoming } = req.query;
    
    // Prepare date filters
    let startDate, endDate;
    
    if (date) {
      // If specific date provided, get reservations for that day
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    } else if (upcoming === 'true') {
      // If upcoming is true, get future reservations
      startDate = new Date();
    }
    
    // Find tables with matching reservations
    const tables = await Table.find({ restaurant: restaurantId });
    
    // Extract and filter reservations
    let allReservations = [];
    
    tables.forEach(table => {
      const tableReservations = table.reservations
        .filter(res => {
          // Apply date filters if provided
          if (startDate && endDate) {
            return new Date(res.startTime) >= startDate && new Date(res.startTime) <= endDate;
          }
          if (startDate) {
            return new Date(res.startTime) >= startDate;
          }
          
          // Apply status filter if provided
          if (status && res.status !== status) {
            return false;
          }
          
          return true;
        })
        .map(res => ({
          ...res.toObject(),
          tableNumber: table.tableNumber,
          tableId: table._id,
          section: table.section,
          floor: table.floor
        }));
      
      allReservations = [...allReservations, ...tableReservations];
    });
    
    // Sort by start time
    allReservations.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    res.status(200).json({
      success: true,
      count: allReservations.length,
      reservations: allReservations
    });
  } catch (error) {
    console.error('Get all reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reservations'
    });
  }
};

// Exported functions
module.exports = {
  createTable,
  getAllTables,
  getTable,
  updateTable,
  deleteTable,
  changeTableStatus,
  regenerateQRCode,
  addReservation,
  updateReservation,
  cancelReservation,
  getAllReservations
};