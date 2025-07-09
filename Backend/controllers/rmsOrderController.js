// controllers/rmsOrderController.js
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const mongoose = require('mongoose');
const TableScan = require('../models/TableScan'); // Add this import

// Helper function to deduct inventory after order is served or completed
const deductInventoryForOrder = async (order) => {
  try {
    // Skip if order doesn't have items or is cancelled
    if (!order.items || order.items.length === 0 || order.status === 'cancelled') {
      return;
    }
    
    // Get all menu items in the order
    const menuItemIds = order.items
      .filter(item => item.status !== 'cancelled')
      .map(item => item.menuItem);
    
    // Fetch the menu items with their ingredients
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds }
    }).populate('ingredients.inventoryItem');
    
    // Track inventory updates
    const inventoryUpdates = {};
    
    // Process each order item
    for (const orderItem of order.items) {
      // Skip cancelled items
      if (orderItem.status === 'cancelled') continue;
      
      // Find the corresponding menu item
      const menuItem = menuItems.find(mi => 
        mi._id.toString() === orderItem.menuItem.toString()
      );
      
      // Skip if menu item not found or has no ingredients
      if (!menuItem || !menuItem.ingredients || menuItem.ingredients.length === 0) continue;
      
      // Process each ingredient
      for (const ingredient of menuItem.ingredients) {
        // Skip if no inventory item is linked
        if (!ingredient.inventoryItem) continue;
        
        const inventoryItemId = ingredient.inventoryItem._id.toString();
        const quantityToDeduct = ingredient.quantity * orderItem.quantity;
        
        // Add to inventory updates
        if (inventoryUpdates[inventoryItemId]) {
          inventoryUpdates[inventoryItemId] += quantityToDeduct;
        } else {
          inventoryUpdates[inventoryItemId] = quantityToDeduct;
        }
      }
    }
    
    // Apply inventory deductions
    const updatePromises = Object.entries(inventoryUpdates).map(([itemId, quantity]) => {
      return updateInventoryQuantity(itemId, {
        type: 'usage',
        quantity,
        notes: `Deducted for Order #${order.orderNumber}`
      }, order.restaurant, order.customer?.userId || null);
    });
    
    await Promise.all(updatePromises);
    
    console.log(`Inventory updated for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Error deducting inventory for order:', error);
    // Don't fail the order process if inventory deduction fails
  }
};

// Helper function to update inventory quantity
const updateInventoryQuantity = async (itemId, data, restaurantId, userId) => {
  try {
    // Find the inventory item
    const item = await Inventory.findOne({
      _id: itemId,
      restaurant: restaurantId
    });
    
    if (!item) {
      throw new Error('Inventory item not found');
    }
    
    // Calculate new quantity based on transaction type
    let newQuantity = item.quantity;
    const quantityValue = parseFloat(data.quantity);
    
    switch (data.type) {
      case 'purchase':
        newQuantity += quantityValue;
        break;
      case 'usage':
      case 'wastage':
      case 'return':
        newQuantity -= quantityValue;
        if (newQuantity < 0) {
          // Allow negative inventory for order deductions but log it
          console.warn(`Warning: Inventory item ${item.name} quantity is now negative: ${newQuantity}`);
        }
        break;
      case 'adjustment':
        newQuantity = quantityValue;
        break;
      default:
        throw new Error('Invalid transaction type');
    }
    
    // Create transaction record
    const transaction = new InventoryTransaction({
      restaurant: restaurantId,
      inventoryItem: item._id,
      type: data.type,
      quantity: data.type === 'adjustment' ? quantityValue - item.quantity : quantityValue,
      unitPrice: item.unitPrice,
      notes: data.notes || `${data.type} transaction`,
      performedBy: userId
    });
    
    // Update item quantity
    item.quantity = newQuantity;
    item.updatedBy = userId;
    
    await Promise.all([item.save(), transaction.save()]);
    
    return { success: true, item, transaction };
  } catch (error) {
    console.error('Error updating inventory quantity:', error);
    throw error;
  }
};

// Create new order
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      tableId,
      orderType,
      customerInfo,
      items,
      paymentMethod,
      specialInstructions,
      taxPercentage = 5,
      serviceCharge = 0,
      priority = 'normal'
    } = req.body;
    
    const restaurantId = req.restaurant._id;
    
    // Calculate next order number
    const lastOrder = await Order.findOne({ restaurant: restaurantId })
      .sort({ orderNumber: -1 })
      .select('orderNumber');
    
    const orderNumber = lastOrder ? parseInt(lastOrder.orderNumber.replace(/[^0-9]/g, '')) + 1 : 1;
    const formattedOrderNumber = `ORD${orderNumber.toString().padStart(4, '0')}`;
    
    // Validate table if it's a dine-in order
    let table = null;
    if (tableId) {
      table = await Table.findOne({
        _id: tableId,
        restaurant: restaurantId
      });
      
      if (!table) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }
    }
    
    // Validate and fetch menu items
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Items are required and must be an array'
      });
    }
    
    const menuItemIds = items.map(item => item.menuItemId);
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurant: restaurantId
    });
    
    if (menuItems.length !== menuItemIds.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'One or more menu items are invalid'
      });
    }
    
    // Prepare order items with correct information
    const orderItems = items.map(item => {
      const menuItem = menuItems.find(mi => mi._id.toString() === item.menuItemId);
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.discountedPrice || menuItem.price,
        specialInstructions: item.specialInstructions || '',
        status: 'pending'
      };
    });
    
    // Calculate order totals
    const subTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxAmount = (subTotal * taxPercentage) / 100;
    const totalAmount = subTotal + taxAmount + serviceCharge;
    
    // Create new order
    const newOrder = new Order({
      restaurant: restaurantId,
      orderNumber: formattedOrderNumber,
      orderType: orderType || (tableId ? 'dine-in' : 'takeaway'),
      table: tableId,
      customer: customerInfo || { name: 'Guest' },
      items: orderItems,
      subTotal,
      taxPercentage,
      taxAmount,
      serviceCharge,
      totalAmount,
      specialInstructions,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending',
      priority: priority,
      processingHistory: [{
        status: 'pending',
        timestamp: new Date(),
        user: req.user.name || 'System',
        note: 'Order created'
      }]
    });
    
    await newOrder.save({ session });
    
    // If table exists, update its status to occupied
    if (table) {
      table.status = 'occupied';
      table.currentCustomer = {
        orderId: newOrder._id,
        name: customerInfo?.name || 'Guest',
        checkinTime: new Date(),
        ...customerInfo
      };
      await table.save({ session });
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: newOrder
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
};

// Get all orders with filtering
const getAllOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, tableId, orderType, limit = 50, page = 1 } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Build query
    const query = { restaurant: restaurantId };
    
    // Handle status filtering
    if (status) {
      if (status === 'active') {
        // Active orders are those with statuses pending, in-progress, ready, or served
        query.status = { $in: ['pending', 'in-progress', 'ready', 'served'] };
      } else if (status.includes(',')) {
        // Multiple statuses
        const statusArray = status.split(',');
        query.status = { $in: statusArray };
      } else {
        // Single status
        query.status = status;
      }
    }
    
    // Date filters
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Table filter
    if (tableId) {
      query.table = tableId;
    }
    
    // Order type filter
    if (orderType) {
      query.orderType = orderType;
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query with proper population
    const orders = await Order.find(query)
      .populate('table')
      .populate('customer.userId', 'name email phone')
      .populate({
        path: 'items.menuItem',
        select: 'name price isVegetarian isVegan isGlutenFree spicyLevel'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: orders.length,
      total: totalOrders,
      totalPages: Math.ceil(totalOrders / parseInt(limit)),
      currentPage: parseInt(page),
      orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

// Get active orders (for dashboard)
const getActiveOrders = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    // Active orders are those with statuses pending, in-progress, ready, or served
    const activeOrders = await Order.find({
      restaurant: restaurantId,
      status: { $in: ['pending', 'in-progress', 'ready', 'served'] }
    })
      .populate('table')
      .populate('customer.userId', 'name email phone')
      .populate({
        path: 'items.menuItem',
        select: 'name price isVegetarian isVegan isGlutenFree spicyLevel images'
      })
      .sort({ createdAt: -1 });
    
    // Organize orders by status for frontend
    const organizedOrders = {
      pending: activeOrders.filter(order => order.status === 'pending'),
      inProgress: activeOrders.filter(order => order.status === 'in-progress'),
      ready: activeOrders.filter(order => order.status === 'ready'),
      served: activeOrders.filter(order => order.status === 'served')
    };
    
    res.status(200).json({
      success: true,
      count: activeOrders.length,
      orders: organizedOrders
    });
  } catch (error) {
    console.error('Error fetching active orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active orders'
    });
  }
};

// Get kitchen view (organized for kitchen display)
const getKitchenView = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    // Get orders that kitchen needs to handle
    const kitchenOrders = await Order.find({
      restaurant: restaurantId,
      status: { $in: ['pending', 'in-progress'] }
    })
      .populate({
        path: 'items.menuItem',
        select: 'name preparationTime isVegetarian isVegan isGlutenFree spicyLevel'
      })
      .sort({ priority: -1, createdAt: 1 }); // High priority first, then oldest
    
    // Organize by preparation needs
    const organizedOrders = kitchenOrders.map(order => {
      const pendingItems = order.items.filter(item => 
        item.status === 'pending' || item.status === 'in-progress'
      );
      
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber: order.table?.number,
        priority: order.priority,
        createdAt: order.createdAt,
        specialInstructions: order.specialInstructions,
        pendingItems
      };
    });
    
    res.status(200).json({
      success: true,
      count: kitchenOrders.length,
      orders: organizedOrders
    });
  } catch (error) {
    console.error('Error fetching kitchen view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch kitchen view'
    });
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    const order = await Order.findOne({
      _id: id,
      restaurant: restaurantId
    })
      .populate('table')
      .populate('customer.userId', 'name email phone')
      .populate({
        path: 'items.menuItem',
        select: 'name price isVegetarian isVegan isGlutenFree spicyLevel images'
      });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
};

// Update order status
// controllers/rmsOrderController.js - Enhanced updateOrderStatus function
const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Validate status
    const validStatuses = ['pending', 'in-progress', 'ready', 'served', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    // Find order
    const order = await Order.findOne({
      _id: id,
      restaurant: restaurantId
    }).populate('table');
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Store previous status for logic checks
    const previousStatus = order.status;
    
    // Update order status
    order.status = status;
    
    // Add to processing history
    order.processingHistory.push({
      status,
      timestamp: new Date(),
      user: req.user.name || 'System',
      note: note || `Order status changed to ${status}`
    });
    
    // If status is changing to completed or served, deduct inventory
    if ((status === 'completed' || status === 'served') && 
        previousStatus !== 'completed' && previousStatus !== 'served') {
      // Deduct inventory in the background
      deductInventoryForOrder(order).catch(err => 
        console.error('Background inventory deduction failed:', err)
      );
    }
    
    // Enhanced logic for handling table status when order is completed/cancelled
    if (status === 'completed' || status === 'cancelled') {
      if (order.table) {
        const table = await Table.findById(order.table._id);
        
        if (table) {
          // Always clear the current order reference when order is completed/cancelled
          if (table.currentOrder && 
              table.currentOrder.toString() === order._id.toString()) {
            table.currentOrder = null;
          }
          
          // Check for active scans before making table completely available
          const activeScans = await TableScan.countDocuments({
            table: table._id,
            active: true
          });
          
          if (activeScans === 0) {
            // No active scans, free up table completely
            table.status = 'available';
            table.currentCustomer = null;
          } else {
            // Active scans exist, keep table occupied but clear order reference
            // The customer can now end their session since the order is complete
            console.log(`Order ${order._id} completed, but table ${table._id} still has active scans`);
          }
          
          await table.save({ session });
          
          // Emit socket event for table status update
          if (global.io) {
            global.io.to(`restaurant_${table.restaurant}`).emit('tableStatusUpdate', {
              tableId: table._id,
              status: table.status,
              currentCustomer: table.currentCustomer,
              currentOrder: table.currentOrder
            });
          }
        }
      }
    }
    
    await order.save({ session });
    
    await session.commitTransaction();
    
    // Emit socket event for order update
    if (global.io) {
      updateOrderSocket(global.io, order);
    }
    
    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    
    // Only abort if transaction is still active
    try {
      await session.abortTransaction();
    } catch (abortError) {
      // Transaction was already committed or aborted, ignore this error
      console.log('Transaction was already completed, ignoring abort error');
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  } finally {
    // Always end the session
    session.endSession();
  }
};

// Update order item status
const updateOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Validate status
    const validItemStatuses = ['pending', 'in-progress', 'ready', 'served', 'cancelled'];
    if (!validItemStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item status'
      });
    }
    
    // Find order
    const order = await Order.findOne({
      _id: orderId,
      restaurant: restaurantId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Find the item in the order
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }
    
    // Store previous status
    const previousStatus = item.status;
    
    // Update item status
    item.status = status;
    
    // Check if all items are in the same status, and update order status accordingly
    const allItemsInStatus = (statusToCheck) => 
      order.items.every(item => item.status === statusToCheck);
    
    // Auto-update order status based on item statuses
    if (status === 'in-progress' && order.status === 'pending') {
      order.status = 'in-progress';
      order.processingHistory.push({
        status: 'in-progress',
        timestamp: new Date(),
        user: req.user.name || 'System',
        note: 'Order moved to in-progress automatically'
      });
    } else if (status === 'ready' && allItemsInStatus('ready')) {
      order.status = 'ready';
      order.processingHistory.push({
        status: 'ready',
        timestamp: new Date(),
        user: req.user.name || 'System',
        note: 'All items ready, order marked as ready'
      });
    }
    
    await order.save();
    
    // If item changed to served or completed, deduct from inventory
    if ((status === 'served' || status === 'ready') && 
        previousStatus !== 'served' && previousStatus !== 'ready') {
      // Deduct inventory just for this item
      try {
        await deductInventoryForItemOnly(order, item);
      } catch (invError) {
        console.error('Error deducting inventory for item:', invError);
        // Don't fail the request if inventory deduction fails
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Item status updated to ${status}`,
      order
    });
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item status'
    });
  }
};

// Helper function to deduct inventory for a single order item
const deductInventoryForItemOnly = async (order, orderItem) => {
  // Get menu item
  const menuItem = await MenuItem.findById(orderItem.menuItem)
    .populate('ingredients.inventoryItem');
  
  if (!menuItem || !menuItem.ingredients || menuItem.ingredients.length === 0) {
    return; // No ingredients to deduct
  }
  
  // Process each ingredient
  const updatePromises = [];
  
  for (const ingredient of menuItem.ingredients) {
    if (!ingredient.inventoryItem) continue;
    
    const inventoryItemId = ingredient.inventoryItem._id;
    const quantityToDeduct = ingredient.quantity * orderItem.quantity;
    
    // Create inventory update
    updatePromises.push(
      updateInventoryQuantity(
        inventoryItemId,
        {
          type: 'usage',
          quantity: quantityToDeduct,
          notes: `Deducted for Order #${order.orderNumber} - ${orderItem.name}`
        },
        order.restaurant,
        null
      )
    );
  }
  
  await Promise.all(updatePromises);
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod, tipAmount } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Validate payment status
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }
    
    // Find order
    const order = await Order.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update payment status
    order.paymentStatus = paymentStatus;
    
    // Update payment method if provided
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    
    // Update tip amount if provided
    if (tipAmount !== undefined) {
      order.tipAmount = parseFloat(tipAmount);
      // Recalculate total amount
      order.totalAmount = order.subTotal + order.taxAmount + order.serviceCharge + order.tipAmount;
    }
    
    // Add processing history entry
    order.processingHistory.push({
      status: `payment-${paymentStatus}`,
      timestamp: new Date(),
      user: req.user.name || 'System',
      note: `Payment status updated to ${paymentStatus}`
    });
    
    await order.save();
    
    // If payment is completed and order is served, auto-complete the order
    if (paymentStatus === 'paid' && order.status === 'served') {
      order.status = 'completed';
      order.processingHistory.push({
        status: 'completed',
        timestamp: new Date(),
        user: req.user.name || 'System',
        note: 'Order automatically marked as completed after payment'
      });
      
      // Free up table if it was a dine-in order
      if (order.table) {
        const table = await Table.findById(order.table);
        if (table && table.status === 'occupied' && 
            table.currentCustomer?.orderId?.toString() === order._id.toString()) {
          table.status = 'available';
          table.currentCustomer = null;
          await table.save();
        }
      }
      
      await order.save();
    }
    
    res.status(200).json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      order
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
};

// Add items to an existing order
const addOrderItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { items } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Items are required and must be an array'
      });
    }
    
    // Find order
    const order = await Order.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if order can be modified
    if (order.status === 'completed' || order.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot modify a ${order.status} order`
      });
    }
    
    // Validate and fetch menu items
    const menuItemIds = items.map(item => item.menuItemId);
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurant: restaurantId
    });
    
    if (menuItems.length !== menuItemIds.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'One or more menu items are invalid'
      });
    }
    
    // Prepare new order items
    const newOrderItems = items.map(item => {
      const menuItem = menuItems.find(mi => mi._id.toString() === item.menuItemId);
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.discountedPrice || menuItem.price,
        specialInstructions: item.specialInstructions || '',
        status: 'pending'
      };
    });
    
    // Add items to order
    order.items.push(...newOrderItems);
    
    // Recalculate order totals
    const subTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    order.subTotal = subTotal;
    order.taxAmount = (subTotal * order.taxPercentage) / 100;
    order.totalAmount = order.subTotal + order.taxAmount + order.serviceCharge + (order.tipAmount || 0);
    
    // Add to processing history
    order.processingHistory.push({
      status: 'modified',
      timestamp: new Date(),
      user: req.user.name || 'System',
      note: `Added ${newOrderItems.length} new items to the order`
    });
    
    // If order was already served, set it back to in-progress
    if (order.status === 'served') {
      order.status = 'in-progress';
      order.processingHistory.push({
        status: 'in-progress',
        timestamp: new Date(),
        user: req.user.name || 'System',
        note: 'Order moved back to in-progress due to new items'
      });
    }
    
    await order.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Items added to order successfully',
      order
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error adding items to order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add items to order'
    });
  }
};

// Remove item from order
const removeOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const restaurantId = req.restaurant._id;    
    // Find order
    const order = await Order.findOne({
      _id: orderId,
      restaurant: restaurantId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Find the item in the order
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }
    
    // Check if order can be modified
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot modify a ${order.status} order`
      });
    }
    
    // Check if item has already been served
    if (item.status === 'served') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove a served item'
      });
    }
    
    // Cancel the item instead of removing it completely
    item.status = 'cancelled';
    
    // Add cancellation info
    item.cancellationReason = reason || 'Cancelled by staff';
    
    // Recalculate order totals (exclude cancelled items)
    const activeItems = order.items.filter(i => i.status !== 'cancelled');
    const subTotal = activeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    order.subTotal = subTotal;
    order.taxAmount = (subTotal * order.taxPercentage) / 100;
    order.totalAmount = order.subTotal + order.taxAmount + order.serviceCharge + (order.tipAmount || 0);
    
    // Add to processing history
    order.processingHistory.push({
      status: 'modified',
      timestamp: new Date(),
      user: req.user.name || 'System',
      note: `Item ${item.name} cancelled with reason: ${item.cancellationReason}`
    });
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Item removed from order successfully',
      order
    });
  } catch (error) {
    console.error('Error removing item from order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from order'
    });
  }
};

// Update order priority
const updateOrderPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority'
      });
    }
    
    // Find order
    const order = await Order.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if order is active
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot change priority of a ${order.status} order`
      });
    }
    
    // Update priority
    order.priority = priority;
    
    // Add to processing history
    order.processingHistory.push({
      status: 'modified',
      timestamp: new Date(),
      user: req.user.name || 'System',
      note: `Order priority changed to ${priority}`
    });
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: `Order priority updated to ${priority}`,
      order
    });
  } catch (error) {
    console.error('Error updating order priority:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order priority'
    });
  }
};

// Get order stats for dashboard
const getOrderStats = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Define date range based on period
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }
    
    // Query database
    const orders = await Order.find({
      restaurant: restaurantId,
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Create base stats object
    const stats = {
      total: orders.length,
      totalRevenue: 0,
      averageOrderValue: 0,
      completed: 0,
      cancelled: 0,
      pending: 0,
      inProgress: 0,
      ready: 0,
      served: 0,
      paymentStats: {
        paid: 0,
        pending: 0,
        failed: 0,
        refunded: 0
      },
      orderTypeStats: {
        dineIn: 0,
        takeaway: 0
      }
    };
    
    // Populate stats
    orders.forEach(order => {
      // Status stats
      switch(order.status) {
        case 'pending':
          stats.pending += 1;
          break;
        case 'in-progress':
          stats.inProgress += 1;
          break;
        case 'ready':
          stats.ready += 1;
          break;
        case 'served':
          stats.served += 1;
          break;
        case 'completed':
          stats.completed += 1;
          break;
        case 'cancelled':
          stats.cancelled += 1;
          break;
      }
      
      // Payment stats
      stats.paymentStats[order.paymentStatus] += 1;
      
      // Order type stats
      if (order.orderType === 'dine-in') {
        stats.orderTypeStats.dineIn += 1;
      } else {
        stats.orderTypeStats.takeaway += 1;
      }
      
      // Revenue (only count completed and served orders)
      if (order.status === 'completed' || order.status === 'served') {
        stats.totalRevenue += order.totalAmount;
      }
    });
    
    // Calculate average order value
    const completedOrders = stats.completed + stats.served;
    if (completedOrders > 0) {
      stats.averageOrderValue = stats.totalRevenue / completedOrders;
    }
    
    res.status(200).json({
      success: true,
      period,
      stats
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics'
    });
  }
};
const confirmCashPayment = async (req, res) => {
  try {
    const { id } = req.params; // order ID
    const { amount, receivedBy, notes } = req.body;
    const restaurantId = req.restaurant._id;
    
    // Find the order
    const order = await Order.findOne({
      _id: id,
      restaurant: restaurantId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if order is eligible for payment
    if (!['ready', 'served'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order is not ready for payment'
      });
    }
    
    // Validate amount
    if (!validatePaymentAmount(order.totalAmount, amount)) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match order total'
      });
    }
    
    // Create or update payment record
    let payment = await Payment.findOne({ order: id });
    
    if (!payment) {
      payment = new Payment({
        order: id,
        restaurant: restaurantId,
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email
        },
        amount: order.totalAmount,
        paymentMethod: 'cash',
        status: 'completed',
        gatewayResponse: {
          confirmedBy: req.user.name,
          receivedBy: receivedBy || req.user.name,
          notes: notes || '',
          confirmationTime: new Date()
        }
      });
    } else {
      payment.status = 'completed';
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        confirmedBy: req.user.name,
        receivedBy: receivedBy || req.user.name,
        notes: notes || '',
        confirmationTime: new Date()
      };
    }
    
    await payment.save();
    
    // Update order payment status
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      transactionId: payment.transactionId,
      paymentDate: new Date(),
      receiptNumber: payment.transactionId
    };
    
    // Add to processing history
    order.processingHistory.push({
      status: 'payment-completed',
      timestamp: new Date(),
      note: `Cash payment confirmed by ${req.user.name}`,
      user: req.user.name
    });
    
    // If order is served, mark as completed
    if (order.status === 'served') {
      order.status = 'completed';
      order.completedAt = new Date();
      order.processingHistory.push({
        status: 'completed',
        timestamp: new Date(),
        note: 'Order completed after cash payment confirmation',
        user: req.user.name
      });
    }
    
    await order.save();
    
    // Emit socket events
    if (global.io) {
      updateOrderSocket(global.io, order);
      updatePaymentSocket(global.io, payment);
    }
    
    res.status(200).json({
      success: true,
      message: 'Cash payment confirmed successfully',
      payment: {
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status
      }
    });
    
  } catch (error) {
    console.error('Confirm cash payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm cash payment'
    });
  }
};

// Get payment details for an order
const getOrderPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    
    const payment = await Payment.findOne({ order: id })
      .populate('order', 'orderNumber totalAmount status');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found for this order'
      });
    }
    
    // Verify restaurant ownership
    if (payment.restaurant.toString() !== restaurantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payment'
      });
    }
    
    res.status(200).json({
      success: true,
      payment
    });
    
  } catch (error) {
    console.error('Get order payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment details'
    });
  }
};

// Generate payment report
const generatePaymentReport = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { startDate, endDate, format = 'json' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const query = { restaurant: restaurantId };
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }
    
    // Get payments with order details
    const payments = await Payment.find(query)
      .populate('order', 'orderNumber status totalAmount items')
      .sort({ createdAt: -1 });
    
    // Calculate summary statistics
    const summary = {
      totalTransactions: payments.length,
      totalRevenue: 0,
      successfulPayments: 0,
      failedPayments: 0,
      paymentMethodBreakdown: {},
      dailyBreakdown: {}
    };
    
    payments.forEach(payment => {
      if (payment.status === 'completed') {
        summary.totalRevenue += payment.amount;
        summary.successfulPayments++;
      } else if (payment.status === 'failed') {
        summary.failedPayments++;
      }
      
      // Payment method breakdown
      const method = payment.paymentMethod;
      if (!summary.paymentMethodBreakdown[method]) {
        summary.paymentMethodBreakdown[method] = { count: 0, amount: 0 };
      }
      summary.paymentMethodBreakdown[method].count++;
      if (payment.status === 'completed') {
        summary.paymentMethodBreakdown[method].amount += payment.amount;
      }
      
      // Daily breakdown
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!summary.dailyBreakdown[date]) {
        summary.dailyBreakdown[date] = { count: 0, amount: 0 };
      }
      summary.dailyBreakdown[date].count++;
      if (payment.status === 'completed') {
        summary.dailyBreakdown[date].amount += payment.amount;
      }
    });
    
    const reportData = {
      generatedAt: new Date(),
      restaurant: req.restaurant.name,
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Present'
      },
      summary,
      transactions: payments
    };
    
    if (format === 'csv') {
      // Generate CSV format
      const csvData = payments.map(p => ({
        'Transaction ID': p.transactionId,
        'Order Number': p.order?.orderNumber || 'N/A',
        'Amount': p.amount,
        'Payment Method': p.paymentMethod,
        'Status': p.status,
        'Date': p.createdAt.toISOString(),
        'Customer Name': p.customer.name,
        'Customer Phone': p.customer.phone
      }));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=payment-report.csv');
      
      // Simple CSV conversion (in production, use proper CSV library)
      const csvHeader = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).join(','));
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      return res.send(csvContent);
    }
    
    res.status(200).json({
      success: true,
      report: reportData
    });
    
  } catch (error) {
    console.error('Generate payment report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate payment report'
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getActiveOrders,
  getKitchenView,
  getOrderDetails,
  updateOrderStatus,
  updateOrderItemStatus,
  updatePaymentStatus,
  addOrderItems,
  removeOrderItem,
  updateOrderPriority,
  getOrderStats,
  confirmCashPayment, getOrderPaymentDetails, generatePaymentReport
};