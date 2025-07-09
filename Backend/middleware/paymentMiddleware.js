// middleware/paymentMiddleware.js
const Payment = require('../models/Payment');
const { validatePaymentAmount } = require('../utils/paymentHelpers');

// Middleware to validate payment request
const validatePaymentRequest = async (req, res, next) => {
  try {
    const { orderId, paymentMethod, amount } = req.body;
    
    if (!orderId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and payment method are required'
      });
    }
    
    // Validate payment method
    const validMethods = ['esewa', 'khalti', 'imepay', 'connectips', 'cash'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }
    
    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      order: orderId,
      status: { $in: ['pending', 'processing'] }
    });
    
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Payment already in progress for this order',
        existingPayment: {
          transactionId: existingPayment.transactionId,
          status: existingPayment.status
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Payment validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment validation failed'
    });
  }
};

// Middleware to verify payment gateway webhook signatures
const verifyWebhookSignature = (gateway) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['authorization'];
      
      if (!signature) {
        return res.status(401).json({
          success: false,
          message: 'Missing signature'
        });
      }
      
      // Implement signature verification based on gateway
      switch (gateway) {
        case 'khalti':
          // Khalti signature verification logic
          break;
        case 'esewa':
          // eSewa signature verification logic
          break;
        default:
          console.warn(`No signature verification implemented for ${gateway}`);
      }
      
      next();
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }
  };
};

module.exports = {
  validatePaymentRequest,
  verifyWebhookSignature
};