// controllers/inventoryController.js
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const MenuItem = require('../models/MenuItem');

// Get all inventory items
const getInventoryItems = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { category, search, lowStock } = req.query;
    
    // Build query
    const query = { restaurant: restaurantId };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    }
    
    const inventoryItems = await Inventory.find(query).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: inventoryItems.length,
      items: inventoryItems
    });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory items'
    });
  }
};

// Get single inventory item
const getInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    const item = await Inventory.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      item
    });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory item'
    });
  }
};

// Create inventory item
const createInventoryItem = async (req, res) => {
  try {
    const {
      name, category, quantity, unit, unitPrice, 
      reorderLevel, supplier, location, expiryDate
    } = req.body;
    
    const restaurantId = req.restaurant._id;
    const userId = req.user.id;
    
    // Validate required fields
    if (!name || !category || quantity === undefined || !unit || unitPrice === undefined || reorderLevel === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, quantity, unit, unit price, and reorder level are required'
      });
    }
    
    // Check if item already exists
    const existingItem = await Inventory.findOne({
      restaurant: restaurantId,
      name: name.trim()
    });
    
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'An inventory item with this name already exists'
      });
    }
    
    // Create new inventory item
    const newItem = new Inventory({
      restaurant: restaurantId,
      name: name.trim(),
      category,
      quantity: parseFloat(quantity),
      unit,
      unitPrice: parseFloat(unitPrice),
      reorderLevel: parseFloat(reorderLevel),
      supplier: supplier || {},
      location,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      updatedBy: userId
    });
    
    await newItem.save();
    
    // Create transaction record for initial stock
    const transaction = new InventoryTransaction({
      restaurant: restaurantId,
      inventoryItem: newItem._id,
      type: 'purchase',
      quantity: parseFloat(quantity),
      unitPrice: parseFloat(unitPrice),
      totalPrice: parseFloat(quantity) * parseFloat(unitPrice),
      notes: 'Initial inventory setup',
      performedBy: userId
    });
    
    await transaction.save();
    
    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      item: newItem
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating inventory item'
    });
  }
};

// Update inventory item
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, category, unit, unitPrice, 
      reorderLevel, supplier, location, expiryDate
    } = req.body;
    
    const restaurantId = req.restaurant._id;
    const userId = req.user.id;
    
    // Find inventory item
    const item = await Inventory.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check if new name conflicts with existing item
    if (name && name.trim() !== item.name) {
      const existingItem = await Inventory.findOne({
        restaurant: restaurantId,
        name: name.trim(),
        _id: { $ne: id }
      });
      
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: 'An inventory item with this name already exists'
        });
      }
    }
    
    // Update fields
    if (name) item.name = name.trim();
    if (category) item.category = category;
    if (unit) item.unit = unit;
    if (unitPrice !== undefined) item.unitPrice = parseFloat(unitPrice);
    if (reorderLevel !== undefined) item.reorderLevel = parseFloat(reorderLevel);
    if (supplier) item.supplier = supplier;
    if (location !== undefined) item.location = location;
    if (expiryDate !== undefined) {
      item.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }
    
    item.updatedBy = userId;
    
    await item.save();
    
    res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      item
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating inventory item'
    });
  }
};

// Update inventory quantity (Stock adjustment)
const updateInventoryQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, notes } = req.body;
    
    const restaurantId = req.restaurant._id;
    const userId = req.user.id;
    
    // Validate
    if (quantity === undefined || !type) {
      return res.status(400).json({
        success: false,
        message: 'Quantity and transaction type are required'
      });
    }
    
    // Find inventory item
    const item = await Inventory.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Calculate new quantity based on transaction type
    let newQuantity = item.quantity;
    const quantityValue = parseFloat(quantity);
    
    switch (type) {
      case 'purchase':
        newQuantity += quantityValue;
        break;
      case 'usage':
      case 'wastage':
      case 'return':
        newQuantity -= quantityValue;
        if (newQuantity < 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot reduce inventory below 0'
          });
        }
        break;
      case 'adjustment':
        newQuantity = quantityValue; // Direct value set
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction type'
        });
    }
    
    // Create transaction record
    const transaction = new InventoryTransaction({
      restaurant: restaurantId,
      inventoryItem: item._id,
      type,
      quantity: type === 'adjustment' ? quantityValue - item.quantity : quantityValue,
      unitPrice: item.unitPrice,
      notes: notes || `${type} transaction`,
      performedBy: userId
    });
    
    // Update item quantity
    item.quantity = newQuantity;
    item.updatedBy = userId;
    
    await Promise.all([item.save(), transaction.save()]);
    
    res.status(200).json({
      success: true,
      message: 'Inventory quantity updated successfully',
      item,
      transaction
    });
  } catch (error) {
    console.error('Update inventory quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating inventory'
    });
  }
};

// Delete inventory item
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    // Find inventory item
    const item = await Inventory.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check if this inventory item is linked to any menu items
    // This would require an ingredients array in MenuItem model
    const linkedMenuItems = await MenuItem.find({
      restaurant: restaurantId,
      'ingredients.id': id
    });
    
    if (linkedMenuItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete item that is linked to ${linkedMenuItems.length} menu items`
      });
    }
    
    // Delete inventory item
    await Inventory.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting inventory item'
    });
  }
};

// Get inventory transactions
const getInventoryTransactions = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { itemId, type, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { restaurant: restaurantId };
    
    if (itemId) {
      query.inventoryItem = itemId;
    }
    
    if (type) {
      query.type = type;
    }
    
    // Date filters
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.date.$lte = endDateTime;
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const total = await InventoryTransaction.countDocuments(query);
    
    // Get transactions with pagination
    const transactions = await InventoryTransaction.find(query)
      .populate('inventoryItem', 'name unit')
      .populate('performedBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get inventory transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory transactions'
    });
  }
};

// Get inventory dashboard summary
const getInventorySummary = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    // Get total inventory value
    const inventoryItems = await Inventory.find({ restaurant: restaurantId });
    
    const totalValue = inventoryItems.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice),
      0
    );
    
    // Get low stock items count
    const lowStockCount = inventoryItems.filter(
      item => item.quantity <= item.reorderLevel
    ).length;
    
    // Get items by category
    const categoryCounts = await Inventory.aggregate([
      { $match: { restaurant: restaurantId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get expiring soon items (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const expiringSoonCount = inventoryItems.filter(
      item => item.expiryDate && item.expiryDate < sevenDaysFromNow && item.expiryDate > new Date()
    ).length;
    
    // Get recent transactions (last 5)
    const recentTransactions = await InventoryTransaction.find({ restaurant: restaurantId })
      .populate('inventoryItem', 'name unit')
      .populate('performedBy', 'name')
      .sort({ date: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      summary: {
        totalItems: inventoryItems.length,
        totalValue,
        lowStockItems: lowStockCount,
        expiringSoonItems: expiringSoonCount,
        categories: categoryCounts,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory summary'
    });
  }
};

module.exports = {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  updateInventoryQuantity,
  deleteInventoryItem,
  getInventoryTransactions,
  getInventorySummary
};