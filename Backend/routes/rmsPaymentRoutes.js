// routes/rmsPaymentRoutes.js - Simplified RMS Payment Management
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

// All routes require authentication and restaurant access
router.use(protect);
router.use(isRestaurantOwner);

// ===== PAYMENT TRACKING & VERIFICATION =====

// Get all payments for restaurant with filtering
router.get('/', async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { 
      status, 
      paymentMethod, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      search,
      verificationStatus
    } = req.query;

    // Build query
    const query = { restaurant: restaurantId };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    if (verificationStatus && verificationStatus !== 'all') {
      query.verificationStatus = verificationStatus;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { transactionId: searchRegex },
        { 'customer.name': searchRegex },
        { 'customer.phone': searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(query)
      .populate('order', 'orderNumber status totalAmount table')
      .populate({
        path: 'order',
        populate: {
          path: 'table',
          select: 'tableNumber section'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalPayments = await Payment.countDocuments(query);

    res.json({
      success: true,
      payments,
      pagination: {
        total: totalPayments,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalPayments / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
});

// Get payments requiring verification
router.get('/pending-verification', async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    const pendingPayments = await Payment.find({
      restaurant: restaurantId,
      status: 'processing',
      verificationStatus: 'pending'
    })
    .populate('order', 'orderNumber table')
    .populate({
      path: 'order',
      populate: {
        path: 'table',
        select: 'tableNumber'
      }
    })
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingPayments.length,
      payments: pendingPayments
    });

  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending verifications'
    });
  }
});

// Verify payment (approve or reject)
router.post('/:paymentId/verify', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action, notes, actualAmount } = req.body; // action: 'approve' or 'reject'
    const restaurantId = req.restaurant._id;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }
    
    const payment = await Payment.findOne({
      _id: paymentId,
      restaurant: restaurantId
    }).populate('order');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const staffInfo = {
      id: req.user.id,
      name: req.user.name
    };

    if (action === 'approve') {
      // Approve payment
      await payment.verifyPayment(staffInfo, notes);
      
      // Update order payment status
      const order = await Order.findById(payment.order._id);
      if (order) {
        order.paymentStatus = 'paid';
        order.paymentDetails = {
          transactionId: payment.transactionId,
          paymentDate: new Date(),
          receiptNumber: payment.transactionId,
          method: payment.paymentMethod,
          verifiedBy: req.user.name
        };
        
        // Add to processing history
        order.processingHistory.push({
          status: 'payment-verified',
          timestamp: new Date(),
          note: `Payment verified and approved by ${req.user.name}`,
          user: req.user.name
        });

        // If order is served, mark as completed
        if (order.status === 'served') {
          order.status = 'completed';
          order.completedAt = new Date();
          order.processingHistory.push({
            status: 'completed',
            timestamp: new Date(),
            note: 'Order completed after payment verification',
            user: req.user.name
          });
        }
        
        await order.save();
      }

      // Emit socket events
      if (global.io) {
        // Notify customer
        global.io.to(`payment_${payment.transactionId}`).emit('paymentVerified', {
          transactionId: payment.transactionId,
          status: 'completed',
          message: 'Your payment has been verified and approved!'
        });
        
        // Notify restaurant staff
        global.io.to(`restaurant_payments_${restaurantId}`).emit('paymentVerificationComplete', {
          transactionId: payment.transactionId,
          action: 'approved',
          verifiedBy: req.user.name
        });
      }

      res.json({
        success: true,
        message: 'Payment approved successfully',
        payment: {
          transactionId: payment.transactionId,
          status: payment.status,
          verificationStatus: payment.verificationStatus
        }
      });

    } else {
      // Reject payment
      const reason = notes || 'Payment verification failed';
      await payment.rejectPayment(staffInfo, reason);
      
      // Emit socket events
      if (global.io) {
        // Notify customer
        global.io.to(`payment_${payment.transactionId}`).emit('paymentRejected', {
          transactionId: payment.transactionId,
          status: 'failed',
          reason: reason,
          message: 'Your payment verification was unsuccessful. Please try again or contact us.'
        });
        
        // Notify restaurant staff
        global.io.to(`restaurant_payments_${restaurantId}`).emit('paymentVerificationComplete', {
          transactionId: payment.transactionId,
          action: 'rejected',
          reason: reason,
          verifiedBy: req.user.name
        });
      }

      res.json({
        success: true,
        message: 'Payment rejected',
        payment: {
          transactionId: payment.transactionId,
          status: payment.status,
          verificationStatus: payment.verificationStatus,
          reason: reason
        }
      });
    }

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

// Confirm cash payment directly
// Fixed backend cash payment confirmation in rmsPaymentRoutes.js
router.post('/:orderId/cash/confirm', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, receivedBy, notes } = req.body;
    const restaurantId = req.restaurant._id;
    
    console.log('=== BACKEND CASH PAYMENT CONFIRM DEBUG ===');
    console.log('1. Order ID:', orderId);
    console.log('2. Restaurant ID:', restaurantId);
    console.log('3. Request body:', req.body);
    
    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      restaurant: restaurantId
    });
    
    if (!order) {
      console.log('4. ERROR: Order not found');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    console.log('4. Order found:', {
      id: order._id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      currentPaymentStatus: order.paymentStatus
    });
    
    // Create or update payment record
    let payment = await Payment.findOne({ order: orderId });
    
    if (!payment) {
      console.log('5. Creating new payment record');
      payment = new Payment({
        order: orderId,
        restaurant: restaurantId,
        customer: {
          name: order.customer?.name || 'Guest',
          phone: order.customer?.phone || '',
          email: order.customer?.email || ''
        },
        amount: amount || order.totalAmount,
        paymentMethod: 'cash',
        status: 'completed',
        verificationStatus: 'verified'
      });
    } else {
      console.log('5. Updating existing payment record:', payment._id);
      payment.status = 'completed';
      payment.verificationStatus = 'verified';
      payment.amount = amount || payment.amount;
      payment.paymentMethod = 'cash';
    }
    
    // Add confirmation details
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      confirmedBy: req.user.name,
      receivedBy: receivedBy || req.user.name,
      staffNotes: notes || 'Cash payment confirmed by staff',
      confirmationTime: new Date(),
      confirmationType: 'staff',
      actualAmount: amount || payment.amount
    };
    
    payment.verifiedBy = {
      staffId: req.user.id,
      staffName: req.user.name,
      verifiedAt: new Date(),
      notes: notes || 'Cash payment received and confirmed'
    };
    
    await payment.save();
    
    console.log('6. Payment record saved:', {
      id: payment._id,
      transactionId: payment.transactionId,
      status: payment.status,
      verificationStatus: payment.verificationStatus
    });
    
    // Update order payment status
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      transactionId: payment.transactionId,
      paymentDate: new Date(),
      method: 'cash',
      receivedBy: receivedBy || req.user.name
    };
    
    // Add to processing history
    order.processingHistory.push({
      status: 'payment-completed',
      timestamp: new Date(),
      note: `Cash payment received by ${receivedBy || req.user.name}`,
      user: req.user.name
    });
    
    await order.save();
    
    console.log('7. Order updated:', {
      id: order._id,
      paymentStatus: order.paymentStatus,
      paymentDetails: order.paymentDetails
    });
    
    // Emit socket events
    if (global.io) {
      console.log('8. Emitting socket events');
      global.io.to(`restaurant_${restaurantId}`).emit('cashPaymentConfirmed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        transactionId: payment.transactionId,
        amount: payment.amount,
        confirmedBy: req.user.name
      });
      
      // Emit payment update
      global.io.to(`restaurant_payments_${restaurantId}`).emit('paymentStatusUpdated', {
        transactionId: payment.transactionId,
        status: payment.status,
        verificationStatus: payment.verificationStatus
      });
    }
    
    console.log('9. SUCCESS: Sending response');
    res.json({
      success: true,
      message: 'Cash payment confirmed successfully',
      payment: {
        id: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        verificationStatus: payment.verificationStatus,
        confirmedBy: req.user.name,
        confirmedAt: payment.verifiedBy.verifiedAt
      }
    });
    
  } catch (error) {
    console.error('=== BACKEND CASH PAYMENT ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to confirm cash payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Confirm card payment
router.post('/:orderId/card/confirm', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, cardLastFour, cardType, terminalId, notes } = req.body;
    const restaurantId = req.restaurant._id;
    
    const order = await Order.findOne({
      _id: orderId,
      restaurant: restaurantId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Create or update payment record
    let payment = await Payment.findOne({ order: orderId });
    
    if (!payment) {
      payment = new Payment({
        order: orderId,
        restaurant: restaurantId,
        customer: {
          name: order.customer?.name || 'Guest',
          phone: order.customer?.phone || '',
          email: order.customer?.email || ''
        },
        amount: amount || order.totalAmount,
        paymentMethod: 'credit-card',
        status: 'completed',
        verificationStatus: 'verified'
      });
    } else {
      payment.status = 'completed';
      payment.verificationStatus = 'verified';
    }
    
    // Add card payment details
    payment.gatewayResponse = {
      confirmedBy: req.user.name,
      confirmationTime: new Date(),
      confirmationType: 'staff',
      cardLastFour: cardLastFour,
      cardType: cardType || 'Unknown',
      terminalId: terminalId,
      staffNotes: notes || 'Card payment processed at terminal',
      actualAmount: amount || payment.amount
    };
    
    payment.verifiedBy = {
      staffId: req.user.id,
      staffName: req.user.name,
      verifiedAt: new Date(),
      notes: `Card payment processed - ${cardType} ending in ${cardLastFour}`
    };
    
    await payment.save();
    
    // Update order
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      transactionId: payment.transactionId,
      paymentDate: new Date(),
      method: 'credit-card',
      cardInfo: `${cardType} ending in ${cardLastFour}`
    };
    
    order.processingHistory.push({
      status: 'payment-completed',
      timestamp: new Date(),
      note: `Card payment processed by ${req.user.name}`,
      user: req.user.name
    });
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Card payment confirmed successfully',
      payment: {
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        cardLastFour: cardLastFour
      }
    });
    
  } catch (error) {
    console.error('Confirm card payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm card payment'
    });
  }
});

// Get payment analytics
router.get('/analytics', async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { period = 'month' } = req.query;
    
    // Define date range
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const stats = await Payment.getPaymentStats(restaurantId, startDate, endDate);

    // Get method-wise breakdown
    const methodStats = await Payment.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      analytics: stats[0] || {
        totalPayments: 0,
        completedPayments: 0,
        pendingPayments: 0,
        processingPayments: 0,
        totalRevenue: 0,
        averageAmount: 0
      },
      methodStats
    });

  } catch (error) {
    console.error('Payment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment analytics'
    });
  }
});

// Generate daily summary
router.get('/summary/daily', async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { date } = req.query;
    
    const targetDate = date ? new Date(date) : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    const payments = await Payment.find({
      restaurant: restaurantId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('order', 'orderNumber');
    
    // Calculate metrics
    const completedPayments = payments.filter(p => p.status === 'completed');
    const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingVerifications = payments.filter(p => p.verificationStatus === 'pending');
    
    // Group by payment method
    const methodBreakdown = {};
    completedPayments.forEach(payment => {
      const method = payment.paymentMethod;
      if (!methodBreakdown[method]) {
        methodBreakdown[method] = { count: 0, amount: 0 };
      }
      methodBreakdown[method].count++;
      methodBreakdown[method].amount += payment.amount;
    });
    
    res.json({
      success: true,
      summary: {
        date: targetDate.toISOString().split('T')[0],
        totalRevenue,
        totalTransactions: payments.length,
        completedTransactions: completedPayments.length,
        pendingVerifications: pendingVerifications.length,
        methodBreakdown,
        recentPayments: payments.slice(0, 10)
      }
    });
    
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily summary'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('RMS Payment Routes Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Payment management error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Get payment details for a specific order
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find payment for the order
    const payment = await Payment.findOne({ 
      order: orderId,
      restaurant: restaurantId 
    }).populate('order', 'orderNumber totalAmount status paymentStatus')
      .populate('restaurant', 'name');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'No payment found for this order'
      });
    }
    
    res.json({
      success: true,
      payment: {
        _id: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        verificationStatus: payment.verificationStatus,
        proofImage: payment.proofImage,
        gatewayResponse: payment.gatewayResponse,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        order: payment.order,
        customer: payment.customer
      }
    });
    
  } catch (error) {
    console.error('Get order payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment details'
    });
  }
});

module.exports = router;