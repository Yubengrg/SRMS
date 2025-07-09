// routes/authRoutes.js
const express = require('express');
const { 
  registerUser, 
  loginUser, 
  verifyOTP, 
  resendOTP,
  forgotPassword,   // Add these missing imports
  resetPassword,    // Add these missing imports
  validateResetToken // Add these missing imports
} = require('../controllers/authController');
const { googleAuth } = require('../controllers/googleAuthController');

const router = express.Router();

// Register route
router.post('/register', registerUser);

// Login route
router.post('/login', loginUser);

// OTP verification route
router.post('/verify-otp', verifyOTP);

// Resend OTP route
router.post('/resend-otp', resendOTP);

// Google authentication route
router.post('/google-auth', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/validate-reset-token/:token', validateResetToken);

module.exports = router;