// routes/qrVerificationRoutes.js
const express = require('express');
const {
  verifyQRCode,
  getTableDetails
} = require('../controllers/qrVerificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public route to verify QR code
router.get('/verify/:restaurantId/:tableId', verifyQRCode);

// Get table details with menu (public)
router.get('/menu/:restaurantId/:tableId', getTableDetails);

// Protected route for authenticated scanning
router.post('/authenticate/:restaurantId/:tableId', protect, (req, res) => {
  // Forward to scanTable controller
  req.body.tableId = req.params.tableId;
  require('../controllers/tableScanController').scanTable(req, res);
});

module.exports = router;