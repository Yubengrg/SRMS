// controllers/categoryController.js
const MenuCategory = require('../models/MenuCategory');
const Restaurant = require('../models/Restaurant');

// Get all categories for a restaurant
const getAllCategories = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }
    
    // Check if restaurant exists and is verified
    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      verificationStatus: 'verified'
    });
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found or not verified' });
    }
    
    // Get categories
    const categories = await MenuCategory.find({ 
      restaurant: restaurantId,
      isActive: true
    }).sort({ sortOrder: 1, name: 1 });
    
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
};

// Get single category with subcategories
const getCategoryDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'Category ID is required' });
    }
    
    const category = await MenuCategory.findById(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.status(200).json({ category });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ message: 'Server error while fetching category' });
  }
};

module.exports = {
  getAllCategories,
  getCategoryDetails
};