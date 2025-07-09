// controllers/menuController.js
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');

// Get restaurant menu
const getRestaurantMenu = async (req, res) => {
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
    
    // Get menu items
    const menuItems = await MenuItem.find({ restaurant: restaurantId, isAvailable: true })
      .sort({ category: 1, sortOrder: 1, name: 1 });
    
    res.status(200).json({ menuItems });
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ message: 'Server error while fetching menu' });
  }
};

// Get menu item details
const getMenuItemDetails = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    if (!itemId) {
      return res.status(400).json({ message: 'Menu item ID is required' });
    }
    
    const menuItem = await MenuItem.findById(itemId);
    
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.status(200).json({ menuItem });
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({ message: 'Server error while fetching menu item' });
  }
};

module.exports = {
  getRestaurantMenu,
  getMenuItemDetails
};