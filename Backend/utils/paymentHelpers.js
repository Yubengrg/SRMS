// utils/paymentHelpers.js
const crypto = require('crypto');

// Generate secure hash for payment verification
const generatePaymentHash = (data, secretKey) => {
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys.map(key => `${key}=${data[key]}`).join('&');
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
};

// Validate payment amount
const validatePaymentAmount = (orderAmount, paymentAmount, tolerance = 1) => {
  return Math.abs(orderAmount - paymentAmount) <= tolerance;
};

// Format currency for display
const formatCurrency = (amount, currency = 'NPR') => {
  return new Intl.NumberFormat('ne-NP', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

// Generate payment receipt data
const generateReceiptData = (payment, order) => {
  return {
    receiptNumber: payment.gatewayPaymentId || payment.transactionId,
    transactionId: payment.transactionId,
    orderNumber: order.orderNumber,
    restaurantName: order.restaurant.name,
    customerName: payment.customer.name,
    paymentMethod: payment.paymentMethod.toUpperCase(),
    amount: payment.amount,
    vatAmount: payment.vatAmount,
    currency: payment.currency,
    paymentDate: payment.updatedAt,
    status: payment.status
  };
};

// Validate phone number for Nepal
const validateNepalPhoneNumber = (phoneNumber) => {
  // Nepal phone number validation (mobile: 98XXXXXXXX, 97XXXXXXXX)
  const nepalMobileRegex = /^(98|97)\d{8}$/;
  const cleanedNumber = phoneNumber.replace(/[\s\-\+]/g, '');
  return nepalMobileRegex.test(cleanedNumber);
};

// Payment method configurations
const getPaymentMethodConfig = (method) => {
  const configs = {
    esewa: {
      name: 'eSewa',
      currency: 'NPR',
      minAmount: 10,
      maxAmount: 100000,
      processingTime: 'Instant',
      fees: '0%'
    },
    khalti: {
      name: 'Khalti',
      currency: 'NPR',
      minAmount: 10,
      maxAmount: 100000,
      processingTime: 'Instant',
      fees: '0%'
    },
    imepay: {
      name: 'IME Pay',
      currency: 'NPR',
      minAmount: 100,
      maxAmount: 50000,
      processingTime: 'Instant',
      fees: '0%'
    },
    cash: {
      name: 'Cash Payment',
      currency: 'NPR',
      minAmount: 1,
      maxAmount: 1000000,
      processingTime: 'Manual verification',
      fees: '0%'
    }
  };
  
  return configs[method] || null;
};

module.exports = {
  generatePaymentHash,
  validatePaymentAmount,
  formatCurrency,
  generateReceiptData,
  validateNepalPhoneNumber,
  getPaymentMethodConfig
};