// routes/userRoutes.js
const express = require('express');
const { getUserProfile, updateUserProfile, updateProfilePicture, changePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// First define the router
const router = express.Router();

// Then use it
router.use(protect);

// User profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.post('/profile/picture', updateProfilePicture);
router.post('/change-password', changePassword);

module.exports = router;