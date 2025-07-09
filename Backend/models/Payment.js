// models/Payment.js - Updated for Simplified Payment System
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  customer: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    phone: String
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NPR'
  },
  paymentMethod: {
    type: String,
    enum: ['ime-pay', 'bank-transfer', 'cash', 'credit-card'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  // Simplified transaction tracking
  transactionId: {
    type: String,
    unique: true
  },
  
  // Payment proof and verification
  proofImage: String, // Path to uploaded proof image
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    staffName: String,
    verifiedAt: Date,
    notes: String
  },
  
  // Simplified gateway response for manual payments
  gatewayResponse: {
    // For IME Pay
    imePayNumber: String,
    imeTransactionId: String,
    
    // For Bank Transfer
    bankName: String,
    accountNumber: String,
    bankTransactionId: String,
    
    // For Cash
    receivedBy: String,
    cashReceiptNumber: String,
    
    // For Credit Card
    cardLastFour: String,
    cardType: String,
    terminalId: String,
    
    // Common fields
    confirmedAt: Date,
    confirmedBy: String,
    proofImage: String,
    customerNotes: String,
    staffNotes: String,
    actualAmount: Number,
    confirmationType: {
      type: String,
      enum: ['customer', 'staff', 'auto'],
      default: 'customer'
    }
  },
  
  failureReason: String,
  
  // Refund information (simplified)
  refundDetails: {
    refundAmount: Number,
    refundReason: String,
    refundDate: Date,
    refundMethod: String, // 'cash', 'bank-transfer', etc.
    refundedBy: String,
    refundNotes: String
  },
  
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String,
    location: String
  }
}, { 
  timestamps: true,
});

// Generate unique transaction ID
paymentSchema.pre('save', async function(next) {
  if (!this.transactionId && this.isNew) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.transactionId = `PAY${timestamp.slice(-6)}${random}`;
  }
  next();
});

// Virtual for display amount
paymentSchema.virtual('displayAmount').get(function() {
  return `NPR ${this.amount.toLocaleString()}`;
});

// Method to mark as verified by staff
paymentSchema.methods.verifyPayment = function(staffInfo, notes) {
  this.status = 'completed';
  this.verificationStatus = 'verified';
  this.verifiedBy = {
    staffId: staffInfo.id,
    staffName: staffInfo.name,
    verifiedAt: new Date(),
    notes: notes || 'Payment verified by staff'
  };
  
  if (!this.gatewayResponse) {
    this.gatewayResponse = {};
  }
  this.gatewayResponse.confirmedAt = new Date();
  this.gatewayResponse.confirmedBy = staffInfo.name;
  this.gatewayResponse.confirmationType = 'staff';
  
  return this.save();
};

// Method to reject payment
paymentSchema.methods.rejectPayment = function(staffInfo, reason) {
  this.status = 'failed';
  this.verificationStatus = 'rejected';
  this.failureReason = reason;
  this.verifiedBy = {
    staffId: staffInfo.id,
    staffName: staffInfo.name,
    verifiedAt: new Date(),
    notes: `Payment rejected: ${reason}`
  };
  
  return this.save();
};

// Static method to get pending verifications for restaurant
paymentSchema.statics.getPendingVerifications = function(restaurantId) {
  return this.find({
    restaurant: restaurantId,
    status: 'processing',
    verificationStatus: 'pending'
  }).populate('order', 'orderNumber')
    .sort({ createdAt: -1 });
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = function(restaurantId, startDate, endDate) {
  const matchConditions = { restaurant: restaurantId };
  
  if (startDate || endDate) {
    matchConditions.createdAt = {};
    if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
    if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        processingPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
        },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
        },
        averageAmount: { $avg: '$amount' },
        paymentMethodBreakdown: {
          $push: {
            method: '$paymentMethod',
            amount: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
          }
        }
      }
    }
  ]);
};

// Index for faster queries
paymentSchema.index({ restaurant: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ 'customer.userId': 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;