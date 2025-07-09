// routes/restaurantRoutes.js
const express = require('express');
const { 
  createRestaurant, 
  getUserRestaurant, 
  updateRestaurant,
  checkVerificationStatus
} = require('../controllers/restaurantController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All restaurant routes require authentication
router.use(protect);

// Create restaurant verification request
router.post('/', createRestaurant);

// Get user's restaurant details
router.get('/', getUserRestaurant);

// Update restaurant details (after verification)
router.put('/', updateRestaurant);

// Check verification status
router.get('/verification-status', checkVerificationStatus);

module.exports = router;