// routes/rmsAnalyticsRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');
const {
  getSalesAnalytics,
  getPopularItems,
  getPaymentMethodStats,
  getRevenueAnalytics,
  getAnalyticsDashboard
} = require('../controllers/rmsAnalyticsController');

// All routes require authentication and restaurant ownership
router.use(protect);
router.use(isRestaurantOwner);

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

// Get sales analytics data
// Query params: period ('day', 'week', 'month', 'year')
// Example: GET /api/rms/analytics/sales?period=week
router.get('/sales', getSalesAnalytics);

// Get popular items analytics
// Query params: period, limit
// Example: GET /api/rms/analytics/popular-items?period=month&limit=10
router.get('/popular-items', getPopularItems);

// Get payment method statistics
// Query params: period
// Example: GET /api/rms/analytics/payment-methods?period=month
router.get('/payment-methods', getPaymentMethodStats);

// Get revenue analytics with trends
// Query params: period
// Example: GET /api/rms/analytics/revenue?period=week
router.get('/revenue', getRevenueAnalytics);

// Get comprehensive analytics dashboard
// Query params: period
// Example: GET /api/rms/analytics/dashboard?period=week
router.get('/dashboard', getAnalyticsDashboard);

// ============================================================================
// ADDITIONAL ANALYTICS ENDPOINTS
// ============================================================================

// Get order analytics (can be extended)
router.get('/orders', async (req, res) => {
  try {
    // For now, redirect to sales analytics
    // Can be extended with order-specific metrics
    req.url = '/sales';
    getSalesAnalytics(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving order analytics'
    });
  }
});

// Get customer analytics
router.get('/customers', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // This can be implemented to show customer behavior analytics
    res.status(200).json({
      success: true,
      message: 'Customer analytics endpoint - can be implemented',
      period,
      restaurantId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving customer analytics'
    });
  }
});

// Get inventory analytics
router.get('/inventory', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // This can be implemented to show inventory usage analytics
    res.status(200).json({
      success: true,
      message: 'Inventory analytics endpoint - can be implemented',
      period,
      restaurantId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory analytics'
    });
  }
});

// Get staff performance analytics
router.get('/staff', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // This can be implemented to show staff performance metrics
    res.status(200).json({
      success: true,
      message: 'Staff analytics endpoint - can be implemented',
      period,
      restaurantId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving staff analytics'
    });
  }
});

// Export data endpoints
router.get('/export/sales', async (req, res) => {
  try {
    const { period = 'month', format = 'json' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Implementation for exporting sales data
    res.status(200).json({
      success: true,
      message: 'Sales export endpoint - can be implemented',
      period,
      format,
      restaurantId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting sales data'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Analytics Routes Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in analytics',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;