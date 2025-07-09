// routes/paymentRoutes.js - Simplified Customer Payment Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const {
  initializePayment,
  confirmPayment,
  getPaymentStatus,
  uploadPaymentProof,
  getPaymentMethods
} = require('../controllers/paymentController');

// Setup multer for payment proof uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/payment-proofs';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for payment proof!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max size
  },
  fileFilter: fileFilter
});

// ===== PUBLIC ROUTES =====

// Get available payment methods
router.get('/methods', getPaymentMethods);

// Get payment status - customers can check their payment status
router.get('/status/:transactionId', getPaymentStatus);

// ===== CUSTOMER PAYMENT ROUTES =====

// Initialize payment for an order
router.post('/initialize', optionalAuth, initializePayment);

// Upload payment proof (for IME Pay and Bank Transfer)
router.post('/proof/:transactionId', optionalAuth, upload.single('proofImage'), uploadPaymentProof);

// Confirm payment (when customer has completed payment)
router.post('/confirm/:transactionId', optionalAuth, confirmPayment);

// Get customer's payment history (requires authentication)
router.get('/my-payments', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const Payment = require('../models/Payment');

    const payments = await Payment.find({
      'customer.userId': userId
    })
    .populate('order', 'orderNumber totalAmount')
    .populate('restaurant', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    const total = await Payment.countDocuments({
      'customer.userId': userId
    });

    res.json({
      success: true,
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get customer payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history'
    });
  }
});

// Get payment instructions again (if customer lost them)
router.get('/instructions/:transactionId', optionalAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const Payment = require('../models/Payment');
    
    const payment = await Payment.findOne({ transactionId })
      .populate('order')
      .populate('restaurant', 'name');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Regenerate instructions based on payment method
    let instructions;
    const order = payment.order;
    
    switch (payment.paymentMethod) {
      case 'ime-pay':
        instructions = {
          method: 'ime-pay',
          title: 'Pay with IME Pay',
          steps: [
            'Open your IME Pay app',
            'Select "Send Money" or "QR Payment"',
            `Send NPR ${payment.amount} to: ${process.env.RESTAURANT_IME_PAY_NUMBER || '9841234567'}`,
            `Reference: ${payment.transactionId}`,
            'Take a screenshot of the transaction',
            'Upload the screenshot using the "Upload Proof" button below'
          ],
          recipientInfo: {
            phoneNumber: process.env.RESTAURANT_IME_PAY_NUMBER || '9841234567',
            name: payment.restaurant.name,
            reference: payment.transactionId
          }
        };
        break;
        
      case 'bank-transfer':
        instructions = {
          method: 'bank-transfer',
          title: 'Bank to Bank Transfer',
          steps: [
            'Open your mobile banking app',
            'Select "Fund Transfer"',
            'Use the bank details below',
            `Transfer NPR ${payment.amount}`,
            `Reference: ${payment.transactionId}`,
            'Save the receipt',
            'Upload the receipt using the "Upload Proof" button below'
          ],
          bankDetails: {
            bankName: process.env.RESTAURANT_BANK_NAME || 'Nepal Investment Bank',
            accountNumber: process.env.RESTAURANT_ACCOUNT_NUMBER || '0123456789',
            accountName: payment.restaurant.name,
            reference: payment.transactionId
          }
        };
        break;
        
      case 'cash':
        instructions = {
          method: 'cash',
          title: 'Cash Payment',
          steps: [
            'Visit the restaurant cashier',
            `Pay NPR ${payment.amount} in cash`,
            `Show reference: ${payment.transactionId}`,
            'Get your receipt'
          ]
        };
        break;
        
      case 'credit-card':
        instructions = {
          method: 'credit-card',
          title: 'Card Payment',
          steps: [
            'Visit the restaurant payment counter',
            'Inform staff you want to pay by card',
            `Amount: NPR ${payment.amount}`,
            'Use the card terminal',
            'Get your receipt'
          ]
        };
        break;
    }

    res.json({
      success: true,
      payment: {
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.paymentMethod
      },
      instructions
    });

  } catch (error) {
    console.error('Get payment instructions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment instructions'
    });
  }
});

// Cancel payment (if not yet processed)
router.post('/cancel/:transactionId', optionalAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;
    
    const Payment = require('../models/Payment');
    
    const payment = await Payment.findOne({ transactionId });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Can only cancel pending payments
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment cannot be cancelled as it is already processed'
      });
    }

    payment.status = 'cancelled';
    payment.failureReason = reason || 'Cancelled by customer';
    await payment.save();

    res.json({
      success: true,
      message: 'Payment cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel payment'
    });
  }
});

// Check if payment method is available
router.get('/check-availability/:method', async (req, res) => {
  try {
    const { method } = req.params;
    
    const availableMethods = {
      'ime-pay': {
        available: !!process.env.RESTAURANT_IME_PAY_NUMBER,
        message: process.env.RESTAURANT_IME_PAY_NUMBER 
          ? 'IME Pay is available' 
          : 'IME Pay is temporarily unavailable'
      },
      'bank-transfer': {
        available: !!(process.env.RESTAURANT_BANK_NAME && process.env.RESTAURANT_ACCOUNT_NUMBER),
        message: (process.env.RESTAURANT_BANK_NAME && process.env.RESTAURANT_ACCOUNT_NUMBER)
          ? 'Bank transfer is available'
          : 'Bank transfer is temporarily unavailable'
      },
      'cash': {
        available: true,
        message: 'Cash payment is always available'
      },
      'credit-card': {
        available: true,
        message: 'Card payment is available at our terminal'
      }
    };

    const methodInfo = availableMethods[method];
    
    if (!methodInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    res.json({
      success: true,
      method,
      ...methodInfo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check payment method availability'
    });
  }
});

// Error handling middleware for file uploads
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed for payment proof!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for payment proof'
    });
  }
  
  console.error('Payment Routes Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Payment processing error'
  });
});

module.exports = router;