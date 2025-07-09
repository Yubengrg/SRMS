// controllers/restaurantController.js
const Restaurant = require('../models/Restaurant');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer storage for PAN certificate upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/restaurants/certificates';
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'certificate-' + uniqueSuffix + path.extname(file.originalname));
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
}).single('panCertificate');

// Create a new restaurant (verification request)
const createRestaurant = async (req, res) => {
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
        return res.status(400).json({ message: 'PAN certificate image is required' });
      }
      
      const { name, ownerFullName } = req.body;
      const userId = req.user.id; // From auth middleware
      
      // Check for required fields
      if (!name || !ownerFullName) {
        // Remove uploaded file if validation fails
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Restaurant name and owner full name are required' });
      }
      
      // Check if user already has a restaurant in process
      const existingRestaurant = await Restaurant.findOne({ owner: userId });
      if (existingRestaurant) {
        // Remove uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          message: 'You already have a restaurant registration in process',
          restaurant: existingRestaurant
        });
      }
      
      // Create certificate path
      const certificatePath = `/uploads/restaurants/certificates/${req.file.filename}`;
      
      // Create new restaurant
      const newRestaurant = new Restaurant({
        name,
        ownerFullName,
        owner: userId,
        panCertificate: certificatePath,
        verificationStatus: 'pending',
        // Additional fields if provided
        email: req.body.email || null,
        contactNumber: req.body.contactNumber || null,
        address: {
          street: req.body.street || null,
          city: req.body.city || null,
          state: req.body.state || null,
          zipCode: req.body.zipCode || null,
          country: req.body.country || null
        }
      });
      
      await newRestaurant.save();
      
      res.status(201).json({
        message: 'Restaurant verification request submitted successfully',
        restaurant: {
          id: newRestaurant._id,
          name: newRestaurant.name,
          ownerFullName: newRestaurant.ownerFullName,
          verificationStatus: newRestaurant.verificationStatus
        }
      });
    });
  } catch (error) {
    console.error('Restaurant creation error:', error);
    res.status(500).json({ message: 'Server error during restaurant creation' });
  }
};

// Get user's restaurant details
const getUserRestaurant = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const restaurant = await Restaurant.findOne({ owner: userId });
    
    if (!restaurant) {
      return res.status(404).json({ message: 'No restaurant found for this user' });
    }
    
    res.status(200).json({ restaurant });
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({ message: 'Server error while fetching restaurant details' });
  }
};

// Update restaurant details (only after verification)
const updateRestaurant = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, contactNumber, email, cuisine,
      street, city, state, zipCode, country,
      openingHours
    } = req.body;
    
    // Find restaurant
    const restaurant = await Restaurant.findOne({ owner: userId });
    
    if (!restaurant) {
      return res.status(404).json({ message: 'No restaurant found for this user' });
    }
    
    // Only allow updates if restaurant is verified
    if (restaurant.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        message: 'Cannot update restaurant details until verification is complete',
        status: restaurant.verificationStatus
      });
    }
    
    // Update fields if provided
    if (name) restaurant.name = name;
    if (contactNumber) restaurant.contactNumber = contactNumber;
    if (email) restaurant.email = email;
    if (cuisine) restaurant.cuisine = cuisine;
    
    // Update address if provided
    if (street || city || state || zipCode || country) {
      restaurant.address = {
        ...restaurant.address,
        street: street || restaurant.address.street,
        city: city || restaurant.address.city,
        state: state || restaurant.address.state,
        zipCode: zipCode || restaurant.address.zipCode,
        country: country || restaurant.address.country
      };
    }
    
    // Update opening hours if provided
    if (openingHours) {
      restaurant.openingHours = {
        ...restaurant.openingHours,
        ...openingHours
      };
    }
    
    await restaurant.save();
    
    res.status(200).json({
      message: 'Restaurant details updated successfully',
      restaurant
    });
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({ message: 'Server error while updating restaurant details' });
  }
};

// Check verification status
const checkVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const restaurant = await Restaurant.findOne({ owner: userId }).select('name verificationStatus rejectionReason');
    
    if (!restaurant) {
      return res.status(404).json({ message: 'No restaurant found for this user' });
    }
    
    res.status(200).json({
      verificationStatus: restaurant.verificationStatus,
      rejectionReason: restaurant.rejectionReason,
      name: restaurant.name
    });
  } catch (error) {
    console.error('Check verification status error:', error);
    res.status(500).json({ message: 'Server error while checking verification status' });
  }
};

module.exports = {
  createRestaurant,
  getUserRestaurant,
  updateRestaurant,
  checkVerificationStatus
};