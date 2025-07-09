// routes/rmsTableRoutes.js
const express = require('express');
const {
  createTable,
  getAllTables,
  getTable,
  updateTable,
  deleteTable,
  changeTableStatus,
  regenerateQRCode
} = require('../controllers/rmsTableController');

const router = express.Router();

// Table routes
// No need for protect and isRestaurantOwner middleware here
// They're applied at the parent level in rmsRoutes.js

// Get all tables
router.get('/', getAllTables);

// Get single table
router.get('/:id', getTable);

// Create table
router.post('/', createTable);

// Update table
router.put('/:id', updateTable);

// Delete table
router.delete('/:id', deleteTable);

// Change table status
router.patch('/:id/status', changeTableStatus);

// Regenerate QR code
router.post('/:id/qrcode', regenerateQRCode);

module.exports = router;