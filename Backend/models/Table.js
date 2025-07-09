// models/Table.js
const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true
  },
  tableNumber: {
    type: String,
    required: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'maintenance'],
    default: 'available'
  },
  qrCode: {
    type: String  // URL to the generated QR code
  },
  section: {
    type: String,
    trim: true,
    default: 'Main'
  },
  floor: {
    type: String,
    trim: true,
    default: 'Ground'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  // NEW FIELD FOR CUSTOMER TRACKING
  currentCustomer: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    phone: String,
    numberOfGuests: Number,
    checkinTime: Date,
    specialRequests: String,
    isGuest: Boolean
  },
  // Updated reservations array
  reservations: [{
    startTime: Date,
    endTime: Date,
    customerName: String,
    customerPhone: String,
    customerEmail: String,
    partySize: Number,
    notes: String,
    status: {
      type: String,
      enum: ['confirmed', 'seated', 'completed', 'no-show', 'cancelled'],
      default: 'confirmed'
    }
  }]
}, { timestamps: true });

// Create compound index for faster queries and to ensure uniqueness per restaurant
tableSchema.index({ restaurant: 1, tableNumber: 1 }, { unique: true });

// Method to check if table is available at a given time
tableSchema.methods.isAvailableAt = function(startTime, endTime) {
  const overlappingReservations = this.reservations.filter(res => {
    return res.status !== 'cancelled' && res.status !== 'no-show' &&
           ((startTime >= res.startTime && startTime < res.endTime) ||
            (endTime > res.startTime && endTime <= res.endTime) ||
            (startTime <= res.startTime && endTime >= res.endTime));
  });
  
  return overlappingReservations.length === 0 && this.status !== 'maintenance';
};

// ENHANCED METHOD: Clear customer info when table is made available
tableSchema.methods.clearCustomerInfo = async function() {
  // Log the current state for debugging
  console.log(`Clearing table ${this._id} with current status: ${this.status}, currentOrder: ${this.currentOrder}`);

  // Clear all customer and order data
  this.currentCustomer = null;
  this.status = 'available';
  this.currentOrder = null;

  // Save and return the updated table
  return this.save();
};

// Add a pre-save hook to ensure tableNumber is trimmed
tableSchema.pre('save', function(next) {
  if (this.tableNumber) {
    this.tableNumber = this.tableNumber.trim();
  }
  next();
});

const Table = mongoose.model('Table', tableSchema);

module.exports = Table;