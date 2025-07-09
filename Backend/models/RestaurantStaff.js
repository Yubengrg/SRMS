// models/RestaurantStaff.js
const mongoose = require('mongoose');

const restaurantStaffSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['manager', 'waiter', 'chef', 'cashier'],
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      'manage_menu', 
      'manage_tables', 
      'take_orders',
      'view_orders',
      'manage_payments',
      'view_reports',
      'manage_inventory' // Add this new permission
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Create compound index to ensure a user can only have one role per restaurant
restaurantStaffSchema.index({ restaurant: 1, user: 1 }, { unique: true });

const RestaurantStaff = mongoose.model('RestaurantStaff', restaurantStaffSchema);

module.exports = RestaurantStaff;