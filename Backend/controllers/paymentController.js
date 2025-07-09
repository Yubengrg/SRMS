// controllers/paymentController.js - Simplified Payment System
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { updateOrderSocket } = require('../socket/orderSocket');
const { updatePaymentSocket } = require('../socket/paymentSocket');

// Initialize payment for an order
const initializePayment = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    const customerId = req.user?.id;

    // Find the order
    const order = await Order.findById(orderId).populate('restaurant');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is eligible for payment
    if (!['ready', 'served'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order is not ready for payment'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ 
      order: orderId, 
      status: { $in: ['pending', 'processing', 'completed'] }
    });
    
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Payment already initiated for this order',
        payment: {
          transactionId: existingPayment.transactionId,
          status: existingPayment.status,
          paymentMethod: existingPayment.paymentMethod
        }
      });
    }

    // Create payment record
    const payment = new Payment({
      order: orderId,
      restaurant: order.restaurant._id,
      customer: {
        userId: customerId,
        name: req.user?.name || order.customer.name,
        email: req.user?.email || order.customer.email,
        phone: req.user?.phone || order.customer.phone
      },
      amount: order.totalAmount,
      paymentMethod,
      status: 'pending',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    await payment.save();

    // Generate payment instructions based on method
    let paymentInstructions;
    switch (paymentMethod) {
      case 'ime-pay':
        paymentInstructions = await generateIMEPayInstructions(payment, order);
        break;
      case 'bank-transfer':
        paymentInstructions = await generateBankTransferInstructions(payment, order);
        break;
      case 'cash':
        paymentInstructions = await generateCashInstructions(payment, order);
        break;
      case 'credit-card':
        paymentInstructions = await generateCreditCardInstructions(payment, order);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported payment method'
        });
    }

    // Emit socket event for real-time updates
    if (global.io) {
      updatePaymentSocket(global.io, payment);
    }

    res.status(200).json({
  success: true,
  message: 'Payment initialized successfully',
  payment: {
    id: payment._id,
    transactionId: payment.transactionId, // CRITICAL: Add this line
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    status: payment.status
  },
  instructions: {
    ...paymentInstructions,
    transactionId: payment.transactionId // Also add it to instructions
  }
});

  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize payment'
    });
  }
};

// IME Pay Instructions (Manual QR/Phone number based)
const generateIMEPayInstructions = async (payment, order) => {
  return {
    method: 'ime-pay',
    title: 'Pay with IME Pay',
    instructions: [
      'Open your IME Pay app',
      'Select "Send Money" or "QR Payment"',
      `Send NPR ${payment.amount} to: ${process.env.RESTAURANT_IME_PAY_NUMBER || '9841234567'}`,
      `Reference: ${payment.transactionId}`,
      'Take a screenshot of the transaction',
      'Upload the screenshot below or show it to the restaurant staff'
    ],
    recipientInfo: {
      phoneNumber: process.env.RESTAURANT_IME_PAY_NUMBER || '9841234567',
      name: order.restaurant.name,
      reference: payment.transactionId
    },
    amount: payment.amount,
    nextSteps: 'After completing the payment, please upload your transaction screenshot or show it to our staff for verification.'
  };
};

// Bank Transfer Instructions
const generateBankTransferInstructions = async (payment, order) => {
  return {
    method: 'bank-transfer',
    title: 'Bank to Bank Transfer',
    instructions: [
      'Open your mobile banking app or visit your bank',
      'Select "Fund Transfer" or "Send Money"',
      'Use the bank details provided below',
      `Transfer amount: NPR ${payment.amount}`,
      `Reference/Remarks: ${payment.transactionId}`,
      'Complete the transfer',
      'Take a screenshot or save the receipt',
      'Upload the receipt below or show it to restaurant staff'
    ],
    bankDetails: {
      bankName: process.env.RESTAURANT_BANK_NAME || 'Nepal Investment Bank',
      accountNumber: process.env.RESTAURANT_ACCOUNT_NUMBER || '0123456789',
      accountName: process.env.RESTAURANT_ACCOUNT_NAME || order.restaurant.name,
      branchCode: process.env.RESTAURANT_BRANCH_CODE || 'NIBL001',
      reference: payment.transactionId
    },
    amount: payment.amount,
    nextSteps: 'After completing the transfer, please upload your transaction receipt or show it to our staff for verification.'
  };
};

// Cash Payment Instructions
const generateCashInstructions = async (payment, order) => {
  return {
    method: 'cash',
    title: 'Cash Payment',
    instructions: [
      'Please proceed to the cashier or payment counter',
      `Total amount to pay: NPR ${payment.amount}`,
      `Order reference: ${order.orderNumber}`,
      `Payment reference: ${payment.transactionId}`,
      'Show this screen to the cashier',
      'Pay in cash and get your receipt'
    ],
    paymentInfo: {
      orderNumber: order.orderNumber,
      amount: payment.amount,
      reference: payment.transactionId,
      tableNumber: order.table?.tableNumber || 'Takeaway'
    },
    nextSteps: 'Please show this screen to our cashier and pay the amount in cash.'
  };
};

// Credit Card Instructions (Manual/Terminal based)
const generateCreditCardInstructions = async (payment, order) => {
  return {
    method: 'credit-card',
    title: 'Credit/Debit Card Payment',
    instructions: [
      'Please proceed to the payment counter',
      'Inform staff you want to pay by card',
      `Amount to pay: NPR ${payment.amount}`,
      `Reference: ${payment.transactionId}`,
      'Follow the card terminal instructions',
      'Enter your PIN when prompted',
      'Take your receipt after successful payment'
    ],
    paymentInfo: {
      amount: payment.amount,
      reference: payment.transactionId,
      orderNumber: order.orderNumber,
      cardTypes: ['Visa', 'Mastercard', 'UnionPay', 'NCB Debit Cards']
    },
    nextSteps: 'Please visit our payment counter with your card. Our staff will assist you with the card payment process.'
  };
};

// Confirm payment (when customer uploads proof or staff confirms)
const confirmPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { proofImage, staffConfirmation, actualAmount, notes } = req.body;

    const payment = await Payment.findOne({ transactionId })
      .populate('order');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update payment with confirmation details
    payment.status = 'completed';
    payment.gatewayResponse = {
      confirmedAt: new Date(),
      confirmedBy: req.user?.name || 'Customer',
      proofImage: proofImage || null,
      staffConfirmation: staffConfirmation || false,
      actualAmount: actualAmount || payment.amount,
      notes: notes || 'Payment confirmed',
      confirmationType: staffConfirmation ? 'staff' : 'customer'
    };

    await payment.save();

    // Update order payment status
    const order = await Order.findById(payment.order);
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      transactionId: payment.transactionId,
      paymentDate: new Date(),
      receiptNumber: payment.transactionId,
      method: payment.paymentMethod
    };

    // Add to processing history
    order.processingHistory.push({
      status: 'payment-completed',
      timestamp: new Date(),
      note: `Payment completed via ${payment.paymentMethod}`,
      user: req.user?.name || 'Customer'
    });

    // If order is served and payment is complete, mark as completed
    if (order.status === 'served') {
      order.status = 'completed';
      order.completedAt = new Date();
      order.processingHistory.push({
        status: 'completed',
        timestamp: new Date(),
        note: 'Order completed after payment confirmation',
        user: 'System'
      });
    }

    await order.save();

    // Emit socket events
    if (global.io) {
      updateOrderSocket(global.io, order);
      updatePaymentSocket(global.io, payment);
      
      // Notify restaurant of payment completion
      global.io.to(`restaurant_${order.restaurant}`).emit('paymentCompleted', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        transactionId: payment.transactionId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: {
        transactionId: payment.transactionId,
        status: payment.status,
        amount: payment.amount,
        confirmedAt: payment.gatewayResponse.confirmedAt
      }
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const payment = await Payment.findOne({ transactionId })
      .populate('order', 'orderNumber status totalAmount')
      .populate('restaurant', 'name');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      payment: {
        id: payment._id,
        transactionId: payment.transactionId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        order: payment.order,
        restaurant: payment.restaurant,
        createdAt: payment.createdAt,
        gatewayResponse: payment.gatewayResponse
      }
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status'
    });
  }
};

// Upload payment proof (for IME Pay and Bank Transfer)
// Fixed uploadPaymentProof function in paymentController.js
// In paymentController.js - Fix the uploadPaymentProof function
// Fixed backend uploadPaymentProof function in paymentController.js
const uploadPaymentProof = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    console.log('=== BACKEND UPLOAD PROOF DEBUG ===');
    console.log('1. Transaction ID:', transactionId);
    console.log('2. File received:', req.file ? 'YES' : 'NO');
    console.log('3. Request body:', req.body);
    console.log('4. File details:', req.file);
    
    // Handle file upload here - multer middleware should handle this
    const proofImage = req.file ? req.file.path : null;
    const { notes } = req.body;

    if (!proofImage) {
      console.log('5. ERROR: No proof image received');
      return res.status(400).json({
        success: false,
        message: 'Payment proof image is required'
      });
    }

    console.log('5. Proof image path:', proofImage);

    // Find payment by transactionId
    const payment = await Payment.findOne({ transactionId });
    
    if (!payment) {
      console.log('6. ERROR: Payment not found for transactionId:', transactionId);
      return res.status(404).json({
        success: false,
        message: 'Payment not found. Please check your transaction ID.'
      });
    }

    console.log('6. Payment found:', {
      id: payment._id,
      currentStatus: payment.status,
      currentVerificationStatus: payment.verificationStatus
    });

    // Update payment with proof
    payment.status = 'processing';
    payment.proofImage = proofImage; // Store the file path
    payment.verificationStatus = 'pending';
    
    // Create full image URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/${proofImage.replace(/\\/g, '/')}`;
    
    console.log('7. Image URL created:', imageUrl);
    
    // Update or create gatewayResponse
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      proofImage: proofImage,
      proofImageUrl: imageUrl, // Store full URL as well
      proofUploadedAt: new Date(),
      customerNotes: notes || '',
      awaitingVerification: true
    };

    await payment.save();
    
    console.log('8. Payment updated successfully:', {
      id: payment._id,
      newStatus: payment.status,
      newVerificationStatus: payment.verificationStatus,
      proofImagePath: payment.proofImage
    });

    // Notify restaurant staff about proof upload
    if (global.io) {
      console.log('9. Emitting socket event for proof upload');
      global.io.to(`restaurant_payments_${payment.restaurant}`).emit('paymentProofUploaded', {
        transactionId: payment.transactionId,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount,
        proofImageUrl: imageUrl,
        customerNotes: notes || ''
      });
      
      // Also emit to general restaurant room
      global.io.to(`restaurant_${payment.restaurant}`).emit('paymentProofUploaded', {
        transactionId: payment.transactionId,
        orderNumber: payment.order?.orderNumber || 'Unknown',
        amount: payment.amount
      });
    }

    console.log('10. SUCCESS: Sending response');
    res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully. Please wait for verification.',
      payment: {
        transactionId: payment.transactionId,
        status: payment.status,
        verificationStatus: payment.verificationStatus,
        proofUploadedAt: payment.gatewayResponse.proofUploadedAt,
        proofImageUrl: imageUrl // Return full URL
      }
    });

  } catch (error) {
    console.error('=== BACKEND UPLOAD ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload payment proof. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get available payment methods
const getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = [
      {
        id: 'ime-pay',
        name: 'IME Pay',
        description: 'Digital wallet payment via IME Pay',
        icon: '/icons/imepay.png',
        isEnabled: true,
        type: 'digital-wallet',
        processingTime: 'Instant verification after proof upload'
      },
      {
        id: 'bank-transfer',
        name: 'Bank Transfer',
        description: 'Direct bank to bank transfer',
        icon: '/icons/bank.png',
        isEnabled: true,
        type: 'bank-transfer',
        processingTime: 'Usually verified within 5-10 minutes'
      },
      {
        id: 'cash',
        name: 'Cash Payment',
        description: 'Pay with cash at the counter',
        icon: '/icons/cash.png',
        isEnabled: true,
        type: 'cash',
        processingTime: 'Immediate'
      },
      {
        id: 'credit-card',
        name: 'Credit/Debit Card',
        description: 'Pay with your card at our terminal',
        icon: '/icons/card.png',
        isEnabled: true,
        type: 'card',
        processingTime: 'Immediate'
      }
    ];

    res.json({
      success: true,
      paymentMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods'
    });
  }
};

module.exports = {
  initializePayment,
  confirmPayment,
  getPaymentStatus,
  uploadPaymentProof,
  getPaymentMethods
};