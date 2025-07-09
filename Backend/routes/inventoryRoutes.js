// routes/inventoryRoutes.js
const express = require('express');
const {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  updateInventoryQuantity,
  deleteInventoryItem,
  getInventoryTransactions,
  getInventorySummary
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');

const router = express.Router();

// All routes require authentication and restaurant ownership
router.use(protect);
router.use(isRestaurantOwner);

// Get inventory summary for dashboard
router.get('/summary', getInventorySummary);

// Get inventory transactions
router.get('/transactions', getInventoryTransactions);

// Inventory item routes
router.route('/')
  .get(getInventoryItems)
  .post(createInventoryItem);

router.route('/:id')
  .get(getInventoryItem)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

// Update inventory quantity
router.patch('/:id/quantity', updateInventoryQuantity);

module.exports = router;