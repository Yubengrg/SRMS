// controllers/customerOrderController.js
const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const { updateOrderSocket } = require('../socket/orderSocket');


// Create a new order from a customer
const createOrder = async (req, res) => {
  try {
    const { 
      restaurantId, tableId, items, specialInstructions, 
      customerName, customerPhone, customerEmail,
      orderType, paymentMethod
    } = req.body;
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }
    
    // If order type is dine-in, table is required
    if (orderType === 'dine-in' || !orderType) {
      if (!tableId) {
        return res.status(400).json({
          success: false,
          message: 'Table ID is required for dine-in orders'
        });
      }
      
      // Verify table exists and is available
      const table = await Table.findOne({
        _id: tableId,
        restaurant: restaurantId
      });
      
      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }
      
      if (table.status === 'maintenance') {
        return res.status(400).json({
          success: false,
          message: 'Table is under maintenance'
        });
      }
    }
    
    // Get menu items and validate they exist
    const itemIds = items.map(item => item.menuItemId);
    const menuItems = await MenuItem.find({
      _id: { $in: itemIds },
      restaurant: restaurantId
    });
    
    if (menuItems.length !== itemIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more menu items not found'
      });
    }
    
    // Create order items with valid data
    const orderItems = items.map(orderItem => {
      const menuItem = menuItems.find(item => item._id.toString() === orderItem.menuItemId);
      
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.discountedPrice || menuItem.price,
        quantity: orderItem.quantity || 1,
        specialInstructions: orderItem.specialInstructions || '',
        customizations: orderItem.customizations || [],
        status: 'pending'
      };
    });
    
    // Get restaurant's tax rate
    const restaurant = await Restaurant.findById(restaurantId).select('taxRate');
    const taxRate = restaurant?.taxRate || 5; // Default to 5% if not set
    
    // Calculate totals
    const subTotal = orderItems.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    const taxAmount = (subTotal * taxRate) / 100;
    
    // Create customer object
    let customer = {
      name: customerName || '',
      phone: customerPhone || '',
      email: customerEmail || ''
    };
    
    // If the request has a logged-in user, add to customer
    if (req.user && req.user.id) {
      customer.userId = req.user.id;
    }
    
    // Create order
    const newOrder = new Order({
      restaurant: restaurantId,
      table: tableId || null,
      orderType: orderType || 'dine-in',
      items: orderItems,
      subTotal,
      taxPercentage: taxRate,
      taxAmount,
      totalAmount: subTotal + taxAmount,
      specialInstructions: specialInstructions || '',
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'pending',
      customer,
      orderSource: req.user ? 'app' : 'in-person',
      processingHistory: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Order created',
        user: customer.name || 'Guest'
      }]
    });
    
    // Generate order number manually
    const today = new Date();
    const dateString = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');
    
    // Find the latest order for this restaurant today
    const latestOrder = await Order.findOne(
      { 
        restaurant: restaurantId,
        orderNumber: { $regex: `^${dateString}` }
      },
      { orderNumber: 1 },
      { sort: { orderNumber: -1 } }
    );
    
    let nextOrderNumber = 1;
    
    if (latestOrder) {
      // Extract the number part from the latest order number
      const latestNumber = parseInt(latestOrder.orderNumber.substring(8));
      nextOrderNumber = latestNumber + 1;
    }
    
    // Format: YYYYMMDD0001
    newOrder.orderNumber = `${dateString}${nextOrderNumber.toString().padStart(4, '0')}`;
    
    // Set estimated ready time (15 minutes from now as default)
    const estimatedReady = new Date();
    estimatedReady.setMinutes(estimatedReady.getMinutes() + 15);
    newOrder.estimatedReadyTime = estimatedReady;
    
    // Save order
    await newOrder.save();
    
    // If dine-in order, update table status and current order
    if ((orderType === 'dine-in' || !orderType) && tableId) {
      await Table.findByIdAndUpdate(tableId, {
        status: 'occupied',
        currentOrder: newOrder._id
      });
    }
    
    // Emit socket event for new order
    if (global.io) {
      updateOrderSocket(global.io, newOrder);
    }
    
    // Return response
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: newOrder._id,
        orderNumber: newOrder.orderNumber,
        items: newOrder.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: newOrder.totalAmount,
        status: newOrder.status,
        estimatedReadyTime: newOrder.estimatedReadyTime
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order'
    });
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .populate('restaurant', 'name')
      .populate('table', 'tableNumber section');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization - either the user owns the order or has the order UUID
    const isAuthorized = 
      (req.user && order.customer.userId && order.customer.userId.toString() === req.user.id) ||
      (req.headers['order-uuid'] && req.headers['order-uuid'] === order.orderUUID);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order details'
    });
  }
};

// Get all orders for the current customer
const getCustomerOrders = async (req, res) => {
  try {
    // Find all orders for the current user
    const orders = await Order.find({
      'customer.userId': req.user.id
    })
    .sort({ createdAt: -1 })
    .populate('restaurant', 'name')
    .populate('table', 'tableNumber section');
    
    // Format orders for response
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      restaurantName: order.restaurant ? order.restaurant.name : 'Restaurant',
      tableNumber: order.table ? order.table.tableNumber : null,
      itemCount: order.items.length
    }));
    
    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

// Rate and provide feedback for an order
const rateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { food, service, overall, feedback } = req.body;
    
    if (!food || !service || !overall) {
      return res.status(400).json({
        success: false,
        message: 'Food, service, and overall ratings are required'
      });
    }
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization - user owns the order
    if (!order.customer.userId || order.customer.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to rate this order'
      });
    }
    
    // Add ratings
    order.ratings = {
      food: parseInt(food),
      service: parseInt(service),
      overall: parseInt(overall),
      feedback: feedback || ''
    };
    
    // Add to processing history
    order.processingHistory.push({
      status: 'rated',
      timestamp: new Date(),
      note: `Order rated: ${overall}/5 stars`,
      user: req.user.name
    });
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order rated successfully',
      ratings: order.ratings
    });
  } catch (error) {
    console.error('Rate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rating order'
    });
  }
};
const getOrderPaymentOptions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .populate('restaurant', 'name paymentMethods');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization
    const isAuthorized = 
      (req.user && order.customer.userId && order.customer.userId.toString() === req.user.id) ||
      (req.headers['order-uuid'] && req.headers['order-uuid'] === order.orderUUID);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }
    
    // Check if order is eligible for payment
    if (!['ready', 'served'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order is not ready for payment'
      });
    }
    
    // Check if payment already exists
    const existingPayment = await Payment.findOne({ 
      order: id, 
      status: { $in: ['pending', 'processing', 'completed'] }
    });
    
    // Available payment methods in Nepal
    const availablePaymentMethods = [
      {
        id: 'esewa',
        name: 'eSewa',
        description: 'Pay with eSewa digital wallet',
        icon: '/icons/esewa.png',
        isEnabled: true
      },
      {
        id: 'khalti',
        name: 'Khalti',
        description: 'Pay with Khalti digital wallet',
        icon: '/icons/khalti.png',
        isEnabled: true
      },
      {
        id: 'imepay',
        name: 'IME Pay',
        description: 'Pay with IME Pay',
        icon: '/icons/imepay.png',
        isEnabled: true
      },
      {
        id: 'connectips',
        name: 'ConnectIPS',
        description: 'Internet banking via ConnectIPS',
        icon: '/icons/connectips.png',
        isEnabled: false // Requires additional setup
      },
      {
        id: 'cash',
        name: 'Cash Payment',
        description: 'Pay with cash at counter',
        icon: '/icons/cash.png',
        isEnabled: true
      }
    ];
    
    res.status(200).json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        restaurant: order.restaurant
      },
      paymentMethods: availablePaymentMethods,
      existingPayment: existingPayment ? {
        transactionId: existingPayment.transactionId,
        status: existingPayment.status,
        paymentMethod: existingPayment.paymentMethod
      } : null
    });
    
  } catch (error) {
    console.error('Get payment options error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment options'
    });
  }
};
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const order = await Order.findById(id)
      .populate('restaurant', 'name')
      .populate('table', 'tableNumber section');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization - either the user owns the order or has the order UUID
    const isAuthorized = 
      (req.user && order.customer.userId && order.customer.userId.toString() === req.user.id) ||
      (req.headers['order-uuid'] && req.headers['order-uuid'] === order.orderUUID);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }
    
    // Check if order can be cancelled (only pending orders)
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}. Only pending orders can be cancelled.`
      });
    }
    
    // Update order status to cancelled
    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by customer';
    order.cancelledAt = new Date();
    
    // Add to processing history
    order.processingHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: `Order cancelled by customer. Reason: ${order.cancellationReason}`,
      user: order.customer.name || 'Customer'
    });
    
    await order.save();
    
    // If order has a table, free it up
    if (order.table) {
      await Table.findByIdAndUpdate(order.table._id, {
        status: 'available',
        currentOrder: null,
        currentCustomer: null
      });
    }
    
    // Emit socket event for order cancellation
    if (global.io) {
      updateOrderSocket(global.io, order);
      
      // Notify restaurant staff about cancellation
      global.io.to(`restaurant_${order.restaurant._id}`).emit('orderCancelled', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        reason: order.cancellationReason,
        customerName: order.customer.name || 'Guest'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        cancellationReason: order.cancellationReason,
        cancelledAt: order.cancelledAt
      }
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order'
    });
  }
};

// Export the new function (add to existing exports)
module.exports = {
  createOrder,
  getOrderDetails,
  getCustomerOrders,
  rateOrder,
  getOrderPaymentOptions,
  cancelOrder // Add this line
};