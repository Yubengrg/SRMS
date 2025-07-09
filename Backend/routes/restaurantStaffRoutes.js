// routes/restaurantStaffRoutes.js
const express = require('express');
const { 
  searchUsers,
  addStaffMember,
  getRestaurantStaff,
  updateStaffMember,
  removeStaffMember,
  staffRmsLogin
} = require('../controllers/restaurantStaffController');

const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');

const router = express.Router();

// Public route for staff RMS login
router.post('/login', staffRmsLogin);

// Owner routes - require authentication and restaurant ownership
router.use(protect);
router.use(isRestaurantOwner);

// Search for users to add as staff
router.get('/search', searchUsers);

// Staff management routes
router.get('/', getRestaurantStaff);
router.post('/', addStaffMember);
router.put('/:id', updateStaffMember);
router.delete('/:id', removeStaffMember);

module.exports = router;