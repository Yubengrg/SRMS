// controllers/googleAuthController.js
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Create a new OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google authentication handler
const googleAuth = async (req, res) => {
  try {
    // Get token from request
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'No token provided' });
    }

    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    // Get user data from the token
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user if they don't exist
      // Generate a random password for the user (they'll use Google to sign in)
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await require('bcrypt').hash(randomPassword, 10);
      
      user = new User({
        name,
        email,
        password: hashedPassword,
        isVerified: true, // Google users are pre-verified
        googleId,
        profilePicture: picture
      });
      
      await user.save();
    } else if (!user.googleId) {
      // If user exists but doesn't have Google ID, update it
      user.googleId = googleId;
      user.isVerified = true; // Ensure the user is verified
      if (picture && !user.profilePicture) {
        user.profilePicture = picture;
      }
      await user.save();
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Google authentication successful',
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture || null
      }
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    return res.status(500).json({ message: 'Google authentication failed' });
  }
};

module.exports = { googleAuth };