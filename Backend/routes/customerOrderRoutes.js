// routes/customerOrderRoutes.js - Updated with cancel order route
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { 
  createOrder, 
  getOrderDetails, 
  getCustomerOrders, 
  rateOrder,
  cancelOrder  // Add this import
} = require('../controllers/customerOrderController');

// Create a new order (no auth required for guest ordering)
router.post('/orders', optionalAuth, createOrder);

// Get order details (authenticated or with order UUID)
router.get('/orders/:id', optionalAuth, getOrderDetails);

// Get all orders for current user (authenticated)
router.get('/orders', protect, getCustomerOrders);

// Cancel an order (authenticated or with order UUID)
router.put('/orders/:id/cancel', optionalAuth, cancelOrder);

// Rate an order (authenticated)
router.post('/orders/:id/rate', protect, rateOrder);

module.exports = router;