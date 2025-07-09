// socket/paymentSocket.js
const Payment = require('../models/Payment');

// Configure socket for payments
const configurePaymentSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Payment socket connected:', socket.id);
    
    // Join payment room for real-time updates
    socket.on('joinPayment', (transactionId) => {
      console.log(`Socket ${socket.id} joining payment room:`, transactionId);
      socket.join(`payment_${transactionId}`);
    });
    
    // Join restaurant payment room for staff
    socket.on('joinRestaurantPayments', (restaurantId) => {
      console.log(`Socket ${socket.id} joining restaurant payment room:`, restaurantId);
      socket.join(`restaurant_payments_${restaurantId}`);
    });
  });
};

// Function to broadcast payment updates
const updatePaymentSocket = (io, payment) => {
  if (!payment || !io) {
    console.error('updatePaymentSocket: Missing io or payment object');
    return;
  }

  try {
    console.log(`Broadcasting payment update for ${payment.transactionId}, status: ${payment.status}`);
    
    // Emit to customer following this payment
    io.to(`payment_${payment.transactionId}`).emit('paymentUpdate', {
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      failureReason: payment.failureReason
    });
    
    // Emit to restaurant staff
    io.to(`restaurant_payments_${payment.restaurant}`).emit('restaurantPaymentUpdate', {
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      customer: payment.customer,
      createdAt: payment.createdAt
    });
    
    // Send specific notifications for payment events
    if (payment.status === 'completed') {
      io.to(`payment_${payment.transactionId}`).emit('paymentSuccess', {
        transactionId: payment.transactionId,
        message: 'Payment completed successfully!'
      });
      
      io.to(`restaurant_payments_${payment.restaurant}`).emit('paymentReceived', {
        transactionId: payment.transactionId,
        amount: payment.amount,
        customer: payment.customer.name
      });
    } else if (payment.status === 'failed') {
      io.to(`payment_${payment.transactionId}`).emit('paymentFailed', {
        transactionId: payment.transactionId,
        message: 'Payment failed. Please try again.',
        reason: payment.failureReason
      });
    }
  } catch (error) {
    console.error('Error in updatePaymentSocket:', error);
  }
};

module.exports = {
  configurePaymentSocket,
  updatePaymentSocket
};