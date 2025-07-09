const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const User = require('../models/User'); // Added User model import
const bcrypt = require('bcrypt'); // Added bcrypt import
const jwt = require('jsonwebtoken'); // Added jwt import

// Create OAuth2 client
const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Create transporter with OAuth2
// Replace your current createTransporter function with this one
const createTransporter = async () => {
  try {
    // Create transporter directly using nodemailer OAuth2 implementation
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN
      },
      debug: true // Enable debug logging
    });
    
    // Verify the transporter connection
    await transporter.verify();
    console.log("Transporter created and verified successfully");
    
    return transporter;
  } catch (error) {
    console.error('Error creating transporter:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

// Generate OTP - improved using crypto for better security
const generateOTP = () => {
  // Generate a 6-digit OTP using crypto for better randomness
  return crypto.randomInt(100000, 999999).toString();
};

// Send verification email with OTP
const sendVerificationEmail = async (email, otp) => {
  // Log OTP to console for testing purposes
  console.log(`====================`);
  console.log(`VERIFICATION OTP for ${email}: ${otp}`);
  console.log(`====================`);

  console.log('Email transport environment variables check:');
  console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
  console.log('GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
  console.log('GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
  console.log('GOOGLE_REFRESH_TOKEN exists:', !!process.env.GOOGLE_REFRESH_TOKEN);

  const mailOptions = {
    from: `Your App <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Account Verification OTP',
    html: `
      <h1>Email Verification</h1>
      <p>Thank you for registering. Please use the following OTP to verify your account:</p>
      <h2>${otp}</h2>
      <p>This OTP will expire in 10 minutes.</p>
    `
  };

  try {
    const transporter = await createTransporter();
    console.log('Transporter created successfully, attempting to send email');
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    return info;
  } catch (error) {
    console.error("Email sending error details:", error.message);
    if (error.response) console.error("SMTP Response:", error.response);
    // Still don't throw error so testing can continue with console OTP
  }
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmpassword } = req.body;

    if (!name || !email || !password || !confirmpassword) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match!" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User with this email already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate OTP for verification
    const otp = generateOTP();
    // OTP expiration time (10 minutes from now)
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Create user with verification status as false
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword,
      isVerified: false,
      otp: otp,
      otpExpiry: otpExpiry
    });

    await newUser.save();
    
    // Send verification email - but don't fail registration if email fails
    await sendVerificationEmail(email, otp);
    
    // For development, include the OTP in the response
    return res.status(201).json({
      message: "User registered successfully! Please check your email for OTP verification.",
      user: {
        id: newUser._id,
        email: newUser.email
      },
      // Remove this line in production
      otp: otp
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Server error during registration" });
  }
};

// Here's the fixed loginUser function in authController.js
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      // Generate new OTP for convenience
      const otp = generateOTP();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);
      
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
      
      // Send verification email with new OTP
      await sendVerificationEmail(email, otp);
      
      return res.status(401).json({ 
        message: "Account not verified. A new verification code has been sent to your email.",
        needsVerification: true,
        userId: user._id,
        // Remove in production
        otp: otp
      });
    }

    // Generate JWT token - Include role in the token payload
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Include role in the response
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role  // Add the role field here
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};
// Verify OTP function
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    // Check if OTP matches and is not expired
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Verify the user
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: "Account verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ message: "Server error during verification" });
  }
};

// Resend OTP function
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    // OTP expiration time (10 minutes from now)
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Update user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send verification email
    await sendVerificationEmail(email, otp);

    return res.status(200).json({
      message: "OTP resent successfully. Please check your email.",
      // Remove in production
      otp: otp
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Server error while resending OTP" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, always return success even if user doesn't exist
      return res.status(200).json({ 
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Set token and expiry (1 hour)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // For testing purposes, log the token
    console.log(`====================`);
    console.log(`RESET TOKEN for ${email}: ${resetToken}`);
    console.log(`====================`);

    // Send reset email
    const mailOptions = {
      from: `Your App <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Please use the following token to reset your password:</p>
        <h2>${resetToken}</h2>
        <p>This token will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    try {
      const transporter = await createTransporter();
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Email sending error:", error.message);
      // Don't expose email errors to client
    }

    return res.status(200).json({ 
      message: "Password reset instructions sent to your email.",
      // Remove in production
      resetToken
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Server error during password reset request" });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Server error during password reset" });
  }
};

// Validate token (check if valid before showing reset form)
const validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ valid: false });
    }

    return res.status(200).json({ valid: true });
  } catch (error) {
    console.error("Token validation error:", error);
    return res.status(500).json({ message: "Server error during token validation" });
  }
};

module.exports = { 
  registerUser, 
  loginUser, 
  verifyOTP, 
  resendOTP, 
  forgotPassword, 
  resetPassword, 
  validateResetToken 
};