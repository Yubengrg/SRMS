// controllers/rmsMenuController.js
const MenuCategory = require('../models/MenuCategory');
const MenuItem = require('../models/MenuItem');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer storage for menu item images
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = './uploads/restaurants/menu';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'menu-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
}).single('image');

// Menu Categories Controllers
const getCategories = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    const categories = await MenuCategory.find({ 
      restaurant: restaurantId,
    }).sort({ sortOrder: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories'
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const userId = req.user.id;
    const { name, description, sortOrder, isActive } = req.body;
    
    // Check if category with same name already exists
    const existingCategory = await MenuCategory.findOne({
      restaurant: restaurantId,
      name: name
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }
    
    // Create new category
    const newCategory = new MenuCategory({
      restaurant: restaurantId,
      name,
      description,
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
      createdBy: userId
    });
    
    // If image is uploaded, add it to the category
    if (req.file) {
      newCategory.image = `/uploads/restaurants/menu/${req.file.filename}`;
    }
    
    await newCategory.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: newCategory
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating category'
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    const { name, description, sortOrder, isActive } = req.body;
    
    // Find the category
    const category = await MenuCategory.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await MenuCategory.findOne({
        restaurant: restaurantId,
        name: name,
        _id: { $ne: id }
      });
      
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'A category with this name already exists'
        });
      }
    }
    
    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    if (isActive !== undefined) category.isActive = isActive;
    
    // Update image if uploaded
    if (req.file) {
      // Delete old image if exists
      if (category.image) {
        const oldImagePath = path.join(__dirname, '..', category.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      category.image = `/uploads/restaurants/menu/${req.file.filename}`;
    }
    
    await category.save();
    
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating category'
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find category
    const category = await MenuCategory.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Check if there are menu items in this category
    const itemCount = await MenuItem.countDocuments({
      category: id
    });
    
    if (itemCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${itemCount} menu items. Please delete or move items first.`
      });
    }
    
    // Delete category image if exists
    if (category.image) {
      const imagePath = path.join(__dirname, '..', category.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete category
    await MenuCategory.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting category'
    });
  }
};

// Menu Items Controllers
const getMenuItems = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { categoryId, isAvailable, search } = req.query;
    
    // Build query
    const query = { restaurant: restaurantId };
    
    if (categoryId) {
      query.category = categoryId;
    }
    
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }
    
    let menuItems;
    
    if (search) {
      // Search in name and description
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    menuItems = await MenuItem.find(query)
      .populate('category', 'name')
      .sort({ category: 1, sortOrder: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: menuItems.length,
      menuItems
    });
  } catch (error) {
    console.error('Get menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching menu items'
    });
  }
};

const createMenuItem = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const userId = req.user.id;
    
    const {
      name, description, price, category, discountedPrice,
      isVegetarian, isVegan, isGlutenFree, spicyLevel,
      ingredients, allergens, preparationTime, calories,
      optionGroups, isAvailable, sortOrder, isPopular, isFeatured
    } = req.body;
    
    // Validate required fields
    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and category are required'
      });
    }
    
    // Check if category exists and belongs to restaurant
    const categoryExists = await MenuCategory.findOne({
      _id: category,
      restaurant: restaurantId
    });
    
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }
    
    // Create new menu item
    const newMenuItem = new MenuItem({
      restaurant: restaurantId,
      name,
      description,
      price: parseFloat(price),
      category,
      discountedPrice: discountedPrice ? parseFloat(discountedPrice) : null,
      isVegetarian: isVegetarian === true,
      isVegan: isVegan === true,
      isGlutenFree: isGlutenFree === true,
      spicyLevel: parseInt(spicyLevel) || 0,
      ingredients: ingredients ? JSON.parse(ingredients) : [],
      allergens: allergens ? JSON.parse(allergens) : [],
      preparationTime: preparationTime ? parseInt(preparationTime) : null,
      calories: calories ? parseInt(calories) : null,
      optionGroups: optionGroups ? JSON.parse(optionGroups) : [],
      isAvailable: isAvailable !== false,
      sortOrder: parseInt(sortOrder) || 0,
      isPopular: isPopular === true,
      isFeatured: isFeatured === true,
      createdBy: userId
    });
    
    // Handle image upload
    if (req.file) {
      newMenuItem.images = [`/uploads/restaurants/menu/${req.file.filename}`];
    }
    
    await newMenuItem.save();
    
    // Populate category before sending response
    await newMenuItem.populate('category', 'name');
    
    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      menuItem: newMenuItem
    });
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating menu item'
    });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find the menu item
    const menuItem = await MenuItem.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    const {
      name, description, price, category, discountedPrice,
      isVegetarian, isVegan, isGlutenFree, spicyLevel,
      ingredients, allergens, preparationTime, calories,
      optionGroups, isAvailable, sortOrder, isPopular, isFeatured
    } = req.body;
    
    // If changing category, validate new category
    if (category && category !== menuItem.category.toString()) {
      const categoryExists = await MenuCategory.findOne({
        _id: category,
        restaurant: restaurantId
      });
      
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
      }
      menuItem.category = category;
    }
    
    // Update fields
    if (name) menuItem.name = name;
    if (description !== undefined) menuItem.description = description;
    if (price) menuItem.price = parseFloat(price);
    if (discountedPrice !== undefined) menuItem.discountedPrice = discountedPrice ? parseFloat(discountedPrice) : null;
    if (isVegetarian !== undefined) menuItem.isVegetarian = isVegetarian === true;
    if (isVegan !== undefined) menuItem.isVegan = isVegan === true;
    if (isGlutenFree !== undefined) menuItem.isGlutenFree = isGlutenFree === true;
    if (spicyLevel !== undefined) menuItem.spicyLevel = parseInt(spicyLevel);
    if (ingredients) menuItem.ingredients = JSON.parse(ingredients);
    if (allergens) menuItem.allergens = JSON.parse(allergens);
    if (preparationTime !== undefined) menuItem.preparationTime = parseInt(preparationTime) || null;
    if (calories !== undefined) menuItem.calories = parseInt(calories) || null;
    if (optionGroups) menuItem.optionGroups = JSON.parse(optionGroups);
    if (isAvailable !== undefined) menuItem.isAvailable = isAvailable === true;
    if (sortOrder !== undefined) menuItem.sortOrder = parseInt(sortOrder);
    if (isPopular !== undefined) menuItem.isPopular = isPopular === true;
    if (isFeatured !== undefined) menuItem.isFeatured = isFeatured === true;
    
    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (menuItem.images && menuItem.images.length > 0) {
        const oldImagePath = path.join(__dirname, '..', menuItem.images[0]);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      menuItem.images = [`/uploads/restaurants/menu/${req.file.filename}`];
    }
    
    await menuItem.save();
    await menuItem.populate('category', 'name');
    
    res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
      menuItem
    });
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating menu item'
    });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find menu item
    const menuItem = await MenuItem.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    // Delete menu item images if exist
    if (menuItem.images && menuItem.images.length > 0) {
      menuItem.images.forEach(imagePath => {
        const fullPath = path.join(__dirname, '..', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }
    
    // Delete menu item
    await MenuItem.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting menu item'
    });
  }
};

const toggleItemAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    const menuItem = await MenuItem.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    menuItem.isAvailable = !menuItem.isAvailable;
    await menuItem.save();
    
    res.status(200).json({
      success: true,
      message: `Menu item is now ${menuItem.isAvailable ? 'available' : 'unavailable'}`,
      isAvailable: menuItem.isAvailable
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling availability'
    });
  }
};

const reorderCategories = async (req, res) => {
  try {
    const { categoryOrders } = req.body; // Array of { id, sortOrder }
    const restaurantId = req.restaurant._id;
    
    // Update all categories at once
    const bulkOps = categoryOrders.map(item => ({
      updateOne: {
        filter: { _id: item.id, restaurant: restaurantId },
        update: { sortOrder: item.sortOrder }
      }
    }));
    
    await MenuCategory.bulkWrite(bulkOps);
    
    res.status(200).json({
      success: true,
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reordering categories'
    });
  }
};

const reorderItems = async (req, res) => {
  try {
    const { itemOrders } = req.body; // Array of { id, sortOrder }
    const restaurantId = req.restaurant._id;
    
    // Update all items at once
    const bulkOps = itemOrders.map(item => ({
      updateOne: {
        filter: { _id: item.id, restaurant: restaurantId },
        update: { sortOrder: item.sortOrder }
      }
    }));
    
    await MenuItem.bulkWrite(bulkOps);
    
    res.status(200).json({
      success: true,
      message: 'Items reordered successfully'
    });
  } catch (error) {
    console.error('Reorder items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reordering items'
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleItemAvailability,
  reorderCategories,
  reorderItems,
  upload
};