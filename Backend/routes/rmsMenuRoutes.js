// routes/rmsMenuRoutes.js
const express = require('express');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleItemAvailability,
  reorderCategories,
  reorderItems,
  upload
} = require('../controllers/rmsMenuController');

const router = express.Router();

// Category routes
router.get('/categories', getCategories);
router.post('/categories', upload, createCategory);
router.put('/categories/:id', upload, updateCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/categories/reorder', reorderCategories);

// Menu item routes
router.get('/items', getMenuItems);
router.post('/items', upload, createMenuItem);
router.put('/items/:id', upload, updateMenuItem);
router.delete('/items/:id', deleteMenuItem);
router.patch('/items/:id/toggle-availability', toggleItemAvailability);
router.post('/items/reorder', reorderItems);

module.exports = router;