// controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer storage for profile pictures
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/profile';
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Setup the upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max size
  },
  fileFilter: fileFilter
}).single('profilePicture');

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming middleware sets req.user
    
    const user = await User.findById(userId).select('-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming middleware sets req.user
    const { name, email, phoneNumber, description } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update fields if provided
    if (name) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (description !== undefined) user.description = description;
    
    // Email update requires extra checks
    if (email && email !== user.email) {
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
      user.email = email;
    }
    
    await user.save();
    
    // Return updated user without sensitive fields
    const updatedUser = await User.findById(userId).select('-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpires');
    
    return res.status(200).json({ 
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// Update profile picture
const updateProfilePicture = async (req, res) => {
  try {
    // Handle file upload
    upload(req, res, async function(err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred during upload
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      } else if (err) {
        // An unknown error occurred
        return res.status(500).json({ message: `Server error: ${err.message}` });
      }
      
      // If no file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const userId = req.user.id;
      
      // Find user
      const user = await User.findById(userId);
      if (!user) {
        // Remove uploaded file if user not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Delete old profile picture if it exists and is not a URL (local file)
      if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
        const oldPicturePath = path.join(__dirname, '..', user.profilePicture);
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }
      
      // Update profile picture path
      const profilePicturePath = `/uploads/profile/${req.file.filename}`;
      user.profilePicture = profilePicturePath;
      await user.save();
      
      return res.status(200).json({
        message: 'Profile picture updated successfully',
        profilePicture: profilePicturePath
      });
    });
  } catch (error) {
    console.error('Profile picture update error:', error);
    return res.status(500).json({ message: 'Server error while updating profile picture' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error while changing password' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  changePassword
};