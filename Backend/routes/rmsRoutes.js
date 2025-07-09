// routes/rmsRoutes.js
const express = require('express');
const { rmsLogin, verifyRmsToken, selectRestaurant } = require('../controllers/rmsAuthController');
const { getDashboardOverview } = require('../controllers/rmsDashboardController');
const { protect } = require('../middleware/authMiddleware');
const { isRestaurantOwner } = require('../middleware/rmsMiddleware');
const rmsTableRoutes = require('./rmsTableRoutes');
const rmsMenuRoutes = require('./rmsMenuRoutes');

// Only import rmsOrderRoutes if the file exists and is properly set up
// Comment this line if you're having issues with this import
// const rmsOrderRoutes = require('./rmsOrderRoutes');

const router = express.Router();

// Public authentication routes (no auth required)
router.post('/login', rmsLogin);

// Protected routes that only need authentication
router.get('/verify-token', protect, verifyRmsToken);
router.post('/select-restaurant', protect, selectRestaurant);

// All routes below this point require both authentication and restaurant ownership
router.use(protect);
router.use(isRestaurantOwner);

// RMS Dashboard routes
router.get('/dashboard', getDashboardOverview);

// Include table routes
router.use('/tables', rmsTableRoutes);
router.use('/menu', rmsMenuRoutes);

// Include order routes - Comment this line if you're having issues with rmsOrderRoutes
// router.use('/orders', rmsOrderRoutes);

module.exports = router;