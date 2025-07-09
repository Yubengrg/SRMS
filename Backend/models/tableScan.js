const mongoose = require('mongoose');

const tableScanSchema = new mongoose.Schema({
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scanTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Create a compound index to ensure a user can't have multiple active scans for the same table
tableScanSchema.index({ table: 1, user: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.model('TableScan', tableScanSchema);