// models/Inventory.js
const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['ingredient', 'beverage', 'packaging', 'cleaning', 'other'],
    default: 'ingredient'
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number
  },
  reorderLevel: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    name: {
      type: String,
      trim: true
    },
    contactInfo: {
      type: String,
      trim: true
    }
  },
  location: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Calculate total price before saving
inventoryItemSchema.pre('save', function(next) {
  this.totalPrice = this.quantity * this.unitPrice;
  this.lastUpdated = new Date();
  next();
});

// Virtual for days until expiry
inventoryItemSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const diffTime = this.expiryDate - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Create index for better query performance
inventoryItemSchema.index({ restaurant: 1, category: 1 });
inventoryItemSchema.index({ restaurant: 1, name: 1 });

const Inventory = mongoose.model('Inventory', inventoryItemSchema);

module.exports = Inventory;