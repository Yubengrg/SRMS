// routes/tableScanRoutes.js
const express = require('express');
const {
  scanTable,
  endScan,
  scanTableGuest,
  getUserActiveScans,
  getUserScanHistory,
  getTableScans
} = require('../controllers/tableScanController');
const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');

const router = express.Router();

// Guest scan route - no authentication required
router.post('/scan/guest/:tableId', scanTableGuest);

// User scan routes - require authentication
router.use(protect);

// Scan a table
router.post('/scan', scanTable);

// End a scan
router.put('/end/:scanId', endScan);

// Get user's active scans
router.get('/active', getUserActiveScans);

// Get user's scan history
router.get('/history', getUserScanHistory);

// Restaurant owner routes - require restaurant ownership
router.get('/table/:tableId', protect, isRestaurantOwner, getTableScans);

module.exports = router;