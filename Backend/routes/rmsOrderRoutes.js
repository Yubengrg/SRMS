// routes/rmsOrderRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');
const { validatePaymentRequest } = require('../middleware/paymentMiddleware');
const {
  createOrder,
  getAllOrders,
  getActiveOrders,
  getKitchenView,
  getOrderDetails,
  updateOrderStatus,
  updateOrderItemStatus,
  updatePaymentStatus,
  addOrderItems,
  removeOrderItem,
  updateOrderPriority,
  getOrderStats,
  // Payment-related functions
  confirmCashPayment,
  getOrderPaymentDetails,
  generatePaymentReport
} = require('../controllers/rmsOrderController');

// All routes require authentication and restaurant ownership
router.use(protect);
router.use(isRestaurantOwner);

// ============================================================================
// CORE ORDER MANAGEMENT ROUTES
// ============================================================================

// Create a new order
router.post('/', createOrder);

// Get all orders with filtering
// Query params: status, startDate, endDate, tableId, orderType, limit, page
// Example: GET /api/rms/orders?status=pending&limit=20&page=1
router.get('/', getAllOrders);

// Get active orders (for dashboard)
// Returns orders grouped by status: pending, inProgress, ready, served
router.get('/active', getActiveOrders);

// Get kitchen view (orders for kitchen staff)
// Returns orders organized for kitchen display with preparation details
router.get('/kitchen', getKitchenView);

// Get order statistics for dashboard
// Query params: period (today, yesterday, week, month, year)
// Example: GET /api/rms/orders/stats/dashboard?period=today
router.get('/stats/dashboard', getOrderStats);

// Get specific order details
router.get('/:id', getOrderDetails);

// ============================================================================
// ORDER STATUS MANAGEMENT
// ============================================================================

// Update main order status
// Body: { status: 'pending'|'in-progress'|'ready'|'served'|'completed'|'cancelled', note?: string }
router.put('/:id/status', updateOrderStatus);

// Update individual order item status
// Body: { status: 'pending'|'in-progress'|'ready'|'served'|'cancelled' }
router.put('/:orderId/items/:itemId/status', updateOrderItemStatus);

// Update order priority
// Body: { priority: 'low'|'normal'|'high'|'urgent' }
router.put('/:id/priority', updateOrderPriority);

// ============================================================================
// ORDER MODIFICATION ROUTES
// ============================================================================

// Add items to an existing order
// Body: { items: [{ menuItemId, quantity, specialInstructions?, customizations? }] }
router.post('/:id/items', addOrderItems);

// Remove/cancel item from order
// Body: { reason?: string }
router.put('/:orderId/items/:itemId/remove', removeOrderItem);

// ============================================================================
// PAYMENT MANAGEMENT ROUTES
// ============================================================================

// Update payment status (legacy support)
// Body: { paymentStatus: 'pending'|'paid'|'failed'|'refunded', paymentMethod?, tipAmount? }
router.put('/:id/payment', updatePaymentStatus);

// Confirm cash payment (staff confirms cash received)
// Body: { amount: number, receivedBy?: string, notes?: string }
router.post('/:id/payment/cash/confirm', validatePaymentRequest, confirmCashPayment);

// Get payment details for a specific order
router.get('/:id/payment', getOrderPaymentDetails);

// ============================================================================
// REPORTING AND ANALYTICS ROUTES
// ============================================================================

// Generate payment report
// Query params: startDate, endDate, format ('json'|'csv')
// Example: GET /api/rms/orders/payments/report?startDate=2024-01-01&endDate=2024-01-31&format=csv
router.get('/payments/report', generatePaymentReport);

// Get order analytics by date range
// Query params: startDate, endDate, groupBy ('day'|'week'|'month')
router.get('/analytics/orders', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Implementation for order analytics
    // This would aggregate orders by date, status, revenue, etc.
    res.json({
      success: true,
      message: 'Order analytics endpoint - implement as needed',
      params: { startDate, endDate, groupBy, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get order analytics'
    });
  }
});

// Get top-selling items
// Query params: startDate, endDate, limit
router.get('/analytics/top-items', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Implementation for top-selling items analytics
    res.json({
      success: true,
      message: 'Top items analytics endpoint - implement as needed',
      params: { startDate, endDate, limit, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get top items analytics'
    });
  }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

// Bulk update order statuses
// Body: { orderIds: [string], status: string, note?: string }
router.put('/bulk/status', async (req, res) => {
  try {
    const { orderIds, status, note } = req.body;
    const restaurantId = req.restaurant._id;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order IDs array is required'
      });
    }
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Implementation for bulk status update
    res.json({
      success: true,
      message: 'Bulk status update endpoint - implement as needed',
      params: { orderIds, status, note, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update order statuses'
    });
  }
});

// Export orders data
// Query params: startDate, endDate, format ('json'|'csv'|'excel')
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Implementation for data export
    res.json({
      success: true,
      message: 'Export orders endpoint - implement as needed',
      params: { startDate, endDate, format, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to export orders data'
    });
  }
});

// ============================================================================
// REAL-TIME ORDER UPDATES
// ============================================================================

// Get real-time order updates (WebSocket alternative for polling)
router.get('/realtime/updates', async (req, res) => {
  try {
    const { lastUpdate } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Implementation for polling-based real-time updates
    // Returns orders that have been updated since lastUpdate timestamp
    res.json({
      success: true,
      message: 'Real-time updates endpoint - implement as needed',
      params: { lastUpdate, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get real-time updates'
    });
  }
});

// ============================================================================
// ORDER NOTIFICATIONS AND ALERTS
// ============================================================================

// Get order alerts (overdue orders, high priority orders, etc.)
router.get('/alerts', async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    // Implementation for order alerts
    // Returns orders that need attention (overdue, high priority, etc.)
    res.json({
      success: true,
      message: 'Order alerts endpoint - implement as needed',
      params: { restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get order alerts'
    });
  }
});

// Mark order notification as read
// Body: { notificationId: string }
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Implementation for marking notifications as read
    res.json({
      success: true,
      message: 'Mark notification as read endpoint - implement as needed',
      params: { notificationId: id, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// ============================================================================
// ORDER TIMELINE AND HISTORY
// ============================================================================

// Get order processing timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Implementation to get detailed order processing timeline
    res.json({
      success: true,
      message: 'Order timeline endpoint - implement as needed',
      params: { orderId: id, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get order timeline'
    });
  }
});

// Add note to order processing history
// Body: { note: string, isPrivate?: boolean }
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { note, isPrivate = false } = req.body;
    const restaurantId = req.restaurant._id;
    
    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note is required'
      });
    }
    
    // Implementation to add note to order history
    res.json({
      success: true,
      message: 'Add order note endpoint - implement as needed',
      params: { orderId: id, note, isPrivate, restaurantId, user: req.user.name }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add order note'
    });
  }
});

// ============================================================================
// ORDER PRINTING AND RECEIPTS
// ============================================================================

// Generate kitchen receipt/ticket
router.get('/:id/kitchen-receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Implementation to generate kitchen receipt
    res.json({
      success: true,
      message: 'Kitchen receipt endpoint - implement as needed',
      params: { orderId: id, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate kitchen receipt'
    });
  }
});

// Generate customer receipt
router.get('/:id/customer-receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Implementation to generate customer receipt
    res.json({
      success: true,
      message: 'Customer receipt endpoint - implement as needed',
      params: { orderId: id, restaurantId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate customer receipt'
    });
  }
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Handle any unmatched routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler for this router
router.use((error, req, res, next) => {
  console.error('RMS Order Routes Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in order management',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;