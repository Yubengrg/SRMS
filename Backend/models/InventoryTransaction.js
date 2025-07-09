// models/InventoryTransaction.js
const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'usage', 'wastage', 'return', 'adjustment'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number
  },
  totalPrice: {
    type: Number
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Calculate total price before saving
inventoryTransactionSchema.pre('save', function(next) {
  if (this.unitPrice) {
    this.totalPrice = this.quantity * this.unitPrice;
  }
  next();
});

// Create index for better query performance
inventoryTransactionSchema.index({ restaurant: 1, inventoryItem: 1 });
inventoryTransactionSchema.index({ restaurant: 1, type: 1, date: -1 });

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);

module.exports = InventoryTransaction;