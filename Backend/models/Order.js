// models/Order.js - Complete model with cancellation features
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  customizations: [{
    name: String,
    options: [String],
    price: Number
  }],
  specialInstructions: String,
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'ready', 'served', 'cancelled'],
    default: 'pending'
  },
  preparedBy: {
    type: String,
    default: null
  },
  servedBy: {
    type: String,
    default: null
  },
  preparationStartTime: Date,
  preparationEndTime: Date,
  cancellationReason: {
    type: String,
    default: null
  }
});

const orderSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  orderUUID: {
    type: String,
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when present
  },
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  customer: {
    name: String,
    phone: String,
    email: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'ready', 'served', 'completed', 'cancelled'],
    default: 'pending'
  },
  specialInstructions: String,
  subTotal: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    required: true
  },
  taxPercentage: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  discountCode: String,
  serviceCharge: {
    type: Number,
    default: 0
  },
  tipAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit', 'debit', 'upi', 'wallet', 'esewa', 'khalti', 'imepay', 'connectips', 'other'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    receiptNumber: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  orderType: {
    type: String,
    enum: ['dine-in', 'takeaway', 'delivery'],
    default: 'dine-in'
  },
  orderSource: {
    type: String,
    enum: ['in-person', 'phone', 'website', 'app', 'third-party'],
    default: 'app'
  },
  estimatedReadyTime: Date,
  completedAt: Date,
  
  // Cancellation fields
  cancellationReason: {
    type: String,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: String,
    enum: ['customer', 'restaurant', 'system'],
    default: null
  },
  
  processingHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    user: String
  }],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  preparationStartedAt: Date,
  preparationCompletedAt: Date,
  ratings: {
    food: { type: Number, min: 1, max: 5 },
    service: { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5 },
    feedback: String,
    ratedAt: Date
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1, restaurant: 1 });
orderSchema.index({ 'customer.userId': 1 });
orderSchema.index({ table: 1 });

// Virtual for order age in minutes
orderSchema.virtual('orderAge').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const diffMs = now.getTime() - this.createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
});

// Virtual for estimated wait time remaining
orderSchema.virtual('waitTimeRemaining').get(function() {
  if (!this.estimatedReadyTime) return null;
  const now = new Date();
  const diffMs = this.estimatedReadyTime.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60))); // Convert to minutes, minimum 0
});

// Virtual to check if order is overdue
orderSchema.virtual('isOverdue').get(function() {
  if (!this.estimatedReadyTime || this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.estimatedReadyTime;
});

// Pre-save hook to generate order number and UUID
orderSchema.pre('save', async function(next) {
  // Only generate for new orders
  if (!this.isNew) {
    return next();
  }
  
  try {
    // Generate order UUID for guest orders or as backup identifier
    if (!this.orderUUID) {
      const { v4: uuidv4 } = require('uuid');
      this.orderUUID = uuidv4();
    }
    
    // Generate order number if not already set
    if (!this.orderNumber) {
      // Get today's date in YYYYMMDD format
      const today = new Date();
      const dateString = today.getFullYear().toString() +
                        (today.getMonth() + 1).toString().padStart(2, '0') +
                        today.getDate().toString().padStart(2, '0');
      
      // Find the latest order for this restaurant today
      const latestOrder = await this.constructor.findOne(
        { 
          restaurant: this.restaurant,
          orderNumber: { $regex: `^${dateString}` }
        },
        { orderNumber: 1 },
        { sort: { orderNumber: -1 } }
      );
      
      let nextOrderNumber = 1;
      
      if (latestOrder) {
        // Extract the number part from the latest order number
        const latestNumber = parseInt(latestOrder.orderNumber.substring(8));
        nextOrderNumber = latestNumber + 1;
      }
      
      // Format: YYYYMMDD0001
      this.orderNumber = `${dateString}${nextOrderNumber.toString().padStart(4, '0')}`;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save hook to update timestamps for status changes
orderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case 'in-progress':
        if (!this.preparationStartedAt) {
          this.preparationStartedAt = now;
        }
        break;
      case 'ready':
        if (!this.preparationCompletedAt) {
          this.preparationCompletedAt = now;
        }
        break;
      case 'completed':
        if (!this.completedAt) {
          this.completedAt = now;
        }
        break;
      case 'cancelled':
        if (!this.cancelledAt) {
          this.cancelledAt = now;
        }
        break;
    }
  }
  
  next();
});

// Method to calculate order totals
orderSchema.methods.calculateTotals = function() {
  // Calculate subtotal (exclude cancelled items)
  this.subTotal = this.items.reduce((sum, item) => {
    return item.status !== 'cancelled' ? sum + (item.price * item.quantity) : sum;
  }, 0);
  
  // Calculate tax amount
  this.taxAmount = (this.subTotal * this.taxPercentage) / 100;
  
  // Calculate total
  this.totalAmount = this.subTotal + this.taxAmount + this.serviceCharge - this.discountAmount + this.tipAmount;
  
  return this;
};

// Add a processing event to history
orderSchema.methods.addToHistory = function(status, note, user) {
  this.processingHistory.push({
    status,
    note,
    user,
    timestamp: new Date()
  });
  
  return this;
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return this.status === 'pending';
};

// Method to cancel the order
orderSchema.methods.cancelOrder = function(reason, cancelledBy = 'customer') {
  if (!this.canBeCancelled()) {
    throw new Error(`Cannot cancel order with status: ${this.status}`);
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  
  this.addToHistory('cancelled', `Order cancelled by ${cancelledBy}. Reason: ${reason}`, cancelledBy);
  
  return this;
};

// Method to check if order can be modified
orderSchema.methods.canBeModified = function() {
  return ['pending', 'in-progress'].includes(this.status);
};

// Method to update item status
orderSchema.methods.updateItemStatus = function(itemId, newStatus, user) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Item not found in order');
  }
  
  const oldStatus = item.status;
  item.status = newStatus;
  
  // Add to processing history
  this.addToHistory(
    'item-status-changed',
    `Item "${item.name}" status changed from ${oldStatus} to ${newStatus}`,
    user
  );
  
  return this;
};

// Method to get order summary for customer
orderSchema.methods.getCustomerSummary = function() {
  return {
    _id: this._id,
    orderNumber: this.orderNumber,
    status: this.status,
    items: this.items.map(item => ({
      _id: item._id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      status: item.status
    })),
    totalAmount: this.totalAmount,
    paymentStatus: this.paymentStatus,
    estimatedReadyTime: this.estimatedReadyTime,
    createdAt: this.createdAt,
    restaurant: this.restaurant,
    table: this.table
  };
};

// Method to get order summary for restaurant staff
orderSchema.methods.getRestaurantSummary = function() {
  return {
    _id: this._id,
    orderNumber: this.orderNumber,
    status: this.status,
    orderType: this.orderType,
    priority: this.priority,
    customer: this.customer,
    items: this.items,
    totalAmount: this.totalAmount,
    paymentStatus: this.paymentStatus,
    paymentMethod: this.paymentMethod,
    specialInstructions: this.specialInstructions,
    estimatedReadyTime: this.estimatedReadyTime,
    createdAt: this.createdAt,
    table: this.table,
    orderAge: this.orderAge,
    isOverdue: this.isOverdue
  };
};

// Static method to get active orders count for a restaurant
orderSchema.statics.getActiveOrdersCount = async function(restaurantId) {
  return this.countDocuments({
    restaurant: restaurantId,
    status: { $nin: ['completed', 'cancelled'] }
  });
};

// Static method to get orders by status for a restaurant
orderSchema.statics.getOrdersByStatus = async function(restaurantId, status) {
  const query = { restaurant: restaurantId };
  
  if (Array.isArray(status)) {
    query.status = { $in: status };
  } else if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('table', 'tableNumber section')
    .populate('customer.userId', 'name email phone')
    .sort({ createdAt: -1 });
};

// Static method to get kitchen view orders
orderSchema.statics.getKitchenOrders = async function(restaurantId) {
  return this.find({
    restaurant: restaurantId,
    status: { $in: ['pending', 'in-progress'] }
  })
  .populate('table', 'tableNumber section')
  .populate('items.menuItem', 'name preparationTime')
  .sort({ priority: -1, createdAt: 1 }); // High priority first, then oldest
};

// Static method to get overdue orders
orderSchema.statics.getOverdueOrders = async function(restaurantId) {
  const now = new Date();
  
  return this.find({
    restaurant: restaurantId,
    status: { $nin: ['completed', 'cancelled'] },
    estimatedReadyTime: { $lt: now }
  })
  .populate('table', 'tableNumber section')
  .sort({ estimatedReadyTime: 1 });
};

// Static method to get revenue statistics
orderSchema.statics.getRevenueStats = async function(restaurantId, startDate, endDate) {
  const matchStage = {
    restaurant: new mongoose.Types.ObjectId(restaurantId),
    status: { $in: ['completed', 'served'] },
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: '$totalAmount' },
        totalTax: { $sum: '$taxAmount' },
        totalServiceCharge: { $sum: '$serviceCharge' }
      }
    }
  ]);
  
  return stats[0] || {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalTax: 0,
    totalServiceCharge: 0
  };
};

// Static method to get popular items
orderSchema.statics.getPopularItems = async function(restaurantId, limit = 10) {
  return this.aggregate([
    { $match: { restaurant: new mongoose.Types.ObjectId(restaurantId) } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItem',
        name: { $first: '$items.name' },
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit }
  ]);
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;