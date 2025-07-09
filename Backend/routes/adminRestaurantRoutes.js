// routes/adminRestaurantRoutes.js
const express = require('express');
const { 
  getAllRestaurantVerifications,
  getVerificationDetails,
  approveVerification,
  rejectVerification
} = require('../controllers/adminRestaurantController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware'); // You'll need to create this middleware

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(protect);
router.use(isAdmin);

// Get all restaurant verification requests
router.get('/verifications', getAllRestaurantVerifications);

// Get a single restaurant verification details
router.get('/verifications/:id', getVerificationDetails);

// Approve a restaurant verification
router.put('/verifications/:id/approve', approveVerification);

// Reject a restaurant verification
router.put('/verifications/:id/reject', rejectVerification);

module.exports = router;