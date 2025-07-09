// socket/orderSocket.js
const Order = require('../models/Order');

// Configure socket for orders
const configureOrderSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join restaurant room for staff
    socket.on('joinRestaurant', (restaurantId) => {
      console.log(`Socket ${socket.id} joining restaurant room:`, restaurantId);
      socket.join(`restaurant_${restaurantId}`);
    });
    
    // Join order room for customer
    socket.on('joinOrder', (orderId) => {
      console.log(`Socket ${socket.id} joining order room:`, orderId);
      socket.join(`order_${orderId}`);
    });
    
    // Join table room
    socket.on('joinTable', (tableId) => {
      console.log(`Socket ${socket.id} joining table room:`, tableId);
      socket.join(`table_${tableId}`);
    });
    
    // Leave rooms when disconnecting
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

// Function to broadcast order updates
const updateOrderSocket = (io, order) => {
  if (!order || !io) {
    console.error('updateOrderSocket: Missing io or order object');
    return;
  }

  try {
    console.log(`Broadcasting update for order ${order._id}, status: ${order.status}`);
    
    // Format order data for restaurant staff
    const restaurantOrderData = {
      _id: order._id,
      orderNumber: order.orderNumber,
      tableName: order.table ? `Table ${order.table.tableNumber}` : 'Takeaway',
      status: order.status,
      updatedAt: order.updatedAt,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      priority: order.priority,
      estimatedReadyTime: order.estimatedReadyTime,
      customerName: order.customer?.name || 'Guest',
      items: order.items // Include items for kitchen view
    };
    
    // Format order data for customer
    const customerOrderData = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      estimatedReadyTime: order.estimatedReadyTime,
      paymentStatus: order.paymentStatus,
      itemsStatus: order.items.map(item => ({
        _id: item._id,
        name: item.name,
        status: item.status
      }))
    };
    
    // Emit to restaurant staff
    io.to(`restaurant_${order.restaurant}`).emit('orderUpdate', restaurantOrderData);
    console.log(`Emitted to restaurant_${order.restaurant}`);
    
    // Emit to customer following this specific order
    io.to(`order_${order._id}`).emit('orderUpdate', customerOrderData);
    
    // If order has a table, emit to table room as well
    if (order.table) {
      io.to(`table_${order.table}`).emit('tableOrderUpdate', customerOrderData);
    }
    
    // Send notifications for specific status changes
    if (order.status === 'ready') {
      io.to(`order_${order._id}`).emit('orderReady', {
        orderNumber: order.orderNumber,
        message: 'Your order is ready!'
      });
    }
  } catch (error) {
    console.error('Error in updateOrderSocket:', error);
  }
};

// Function to send kitchen updates
const updateKitchenSocket = (io, restaurantId) => {
  // This is called whenever we need to refresh kitchen view for all staff
  try {
    console.log(`Sending kitchen update to restaurant ${restaurantId}`);
    io.to(`restaurant_${restaurantId}`).emit('kitchenUpdate', {
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error in updateKitchenSocket:', error);
  }
};

module.exports = {
  configureOrderSocket,
  updateOrderSocket,
  updateKitchenSocket
};