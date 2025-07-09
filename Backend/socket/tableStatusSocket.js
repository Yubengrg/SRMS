// socket/tableStatusSocket.js
module.exports = {
  configureTableStatusSocket: (io) => {
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Join restaurant room when staff connects
      socket.on('joinRestaurant', (restaurantId) => {
        socket.join(`restaurant_${restaurantId}`);
        console.log(`Socket ${socket.id} joined restaurant ${restaurantId}`);
      });
      
      // Leave restaurant room when staff disconnects
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  },
  
  // Function to broadcast table status updates
  updateTableStatusSocket: (io, table) => {
    io.to(`restaurant_${table.restaurant}`).emit('tableStatusUpdate', {
      tableId: table._id,
      status: table.status,
      currentCustomer: table.currentCustomer,
      currentOrder: table.currentOrder
    });
  }
};