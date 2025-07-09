// server.js - Updated with Analytics Routes
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { configureTableStatusSocket } = require('./socket/tableStatusSocket');
const { configureOrderSocket } = require('./socket/orderSocket');
const { configurePaymentSocket } = require('./socket/paymentSocket');

// Import routes
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const qrCodeRoutes = require('./routes/qrCodeRoutes');
const userRoutes = require('./routes/userRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const adminRestaurantRoutes = require('./routes/adminRestaurantRoutes');
const rmsRoutes = require('./routes/rmsRoutes');
const tableScanRoutes = require('./routes/tableScanRoutes');
const qrVerificationRoutes = require('./routes/qrVerificationRoutes');
const customerOrderRoutes = require('./routes/customerOrderRoutes');
const rmsOrderRoutes = require('./routes/rmsOrderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

// Payment routes - separated for mobile app vs RMS
const paymentRoutes = require('./routes/paymentRoutes'); // Customer mobile app
const rmsPaymentRoutes = require('./routes/rmsPaymentRoutes'); // RMS web app

// Analytics routes - NEW ADDITION
const rmsAnalyticsRoutes = require('./routes/rmsAnalyticsRoutes');

// Try to import restaurant staff routes if available
let restaurantStaffRoutes;
try {
  restaurantStaffRoutes = require('./routes/restaurantStaffRoutes');
} catch (error) {
  console.warn('restaurantStaffRoutes could not be loaded:', error.message);
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173", "*"], // Add your frontend URLs
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  }
});

// Make io accessible throughout the app
global.io = io;

// Configure socket for table status updates
configureTableStatusSocket(io);

// Configure socket for order updates
configureOrderSocket(io);

// Configure socket for payment updates
configurePaymentSocket(io);

// Socket debugging and room management
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Restaurant staff room (for RMS web app)
  socket.on('joinRestaurant', (restaurantId) => {
    console.log(`Socket ${socket.id} joining restaurant room: ${restaurantId}`);
    socket.join(`restaurant_${restaurantId}`);
  });
  
  // Order tracking room (for customers)
  socket.on('joinOrder', (orderId) => {
    console.log(`Socket ${socket.id} joining order room: ${orderId}`);
    socket.join(`order_${orderId}`);
  });
  
  // Payment tracking room (for customers)
  socket.on('joinPayment', (transactionId) => {
    console.log(`Socket ${socket.id} joining payment room: ${transactionId}`);
    socket.join(`payment_${transactionId}`);
  });
  
  // Restaurant payment room (for RMS staff)
  socket.on('joinRestaurantPayments', (restaurantId) => {
    console.log(`Socket ${socket.id} joining restaurant payment room: ${restaurantId}`);
    socket.join(`restaurant_payments_${restaurantId}`);
  });
  
  // Table room (for table-specific updates)
  socket.on('joinTable', (tableId) => {
    console.log(`Socket ${socket.id} joining table room: ${tableId}`);
    socket.join(`table_${tableId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors()); // Allow requests from frontend
app.use(express.json()); // Parse JSON requests
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health endpoint for connectivity check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((error) => console.log('Error connecting to MongoDB:', error));

// Initialize table index once MongoDB is connected
mongoose.connection.once('open', async () => {
  console.log('MongoDB connected successfully');
  
  try {
    // Get the table model
    const Table = mongoose.model('Table');
    
    // Check existing indexes and try to drop any simple tableNumber index
    const tableCollection = mongoose.connection.db.collection('tables');
    const indexes = await tableCollection.indexes();
    console.log('Current indexes on tables collection:', indexes);
    
    // Drop any index on just tableNumber (if it exists)
    try {
      await tableCollection.dropIndex('tableNumber_1');
      console.log('Dropped simple tableNumber index');
    } catch (err) {
      console.log('No simple tableNumber index to drop (or error):', err.message);
    }
    
    // Recreate the compound index
    await Table.collection.createIndex(
      { restaurant: 1, tableNumber: 1 }, 
      { unique: true }
    );
    console.log('Recreated compound index for restaurant + tableNumber');
  } catch (err) {
    console.error('Error setting up table indexes:', err);
  }
});

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

// ===== AUTHENTICATION & USER MANAGEMENT =====
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// ===== GENERAL ROUTES =====
app.use('/api/menu', menuRoutes);
app.use('/api/qr', qrCodeRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminRestaurantRoutes);

// ===== CUSTOMER MOBILE APP ROUTES =====
// Customer ordering (mobile app)
app.use('/api/customer', customerOrderRoutes); 

// Customer payment processing (mobile app)
app.use('/api/payments', paymentRoutes);

// Table scanning for customers
app.use('/api/scans', tableScanRoutes);
app.use('/api/qr/verify', qrVerificationRoutes);

// ===== RMS WEB APP ROUTES (Restaurant Management System) =====
// Main RMS routes
app.use('/api/rms', rmsRoutes);

// RMS Order management 
app.use('/api/rms/orders', rmsOrderRoutes);

// RMS Payment tracking and management
app.use('/api/rms/payments', rmsPaymentRoutes);

// RMS Analytics - NEW ADDITION
app.use('/api/rms/analytics', rmsAnalyticsRoutes);

// RMS Inventory management
app.use('/api/rms/inventory', inventoryRoutes);

// Staff management routes (if available)
if (restaurantStaffRoutes) {
  app.use('/api/restaurants/staff', restaurantStaffRoutes);
}

// ============================================================================
// PAYMENT GATEWAY WEBHOOKS (Public endpoints)
// ============================================================================

// These endpoints are called by payment gateways and should be publicly accessible
app.post('/webhooks/esewa', (req, res) => {
  console.log('eSewa webhook received:', req.body);
  // Handle eSewa webhook - this could redirect to payment controller
  res.json({ success: true, message: 'eSewa webhook received' });
});

app.post('/webhooks/khalti', (req, res) => {
  console.log('Khalti webhook received:', req.body);
  // Handle Khalti webhook - this could redirect to payment controller
  res.json({ success: true, message: 'Khalti webhook received' });
});

app.post('/webhooks/imepay', (req, res) => {
  console.log('IME Pay webhook received:', req.body);
  // Handle IME Pay webhook - this could redirect to payment controller
  res.json({ success: true, message: 'IME Pay webhook received' });
});

// Generic webhook handler for other payment methods
app.post('/webhooks/:gateway', (req, res) => {
  const { gateway } = req.params;
  console.log(`${gateway} webhook received:`, req.body);
  
  // Log webhook data for debugging
  console.log(`Webhook Headers:`, req.headers);
  console.log(`Webhook Body:`, req.body);
  
  res.json({ 
    success: true, 
    message: `${gateway} webhook received`,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Error handling for file uploads
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.'
    });
  }
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format'
    });
  }
  
  next(err);
});

// Handle 404 - Route not found
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health - Health check',
      'POST /api/auth/* - Authentication',
      'GET /api/customer/* - Customer mobile app',
      'GET /api/payments/* - Customer payments',
      'GET /api/rms/* - Restaurant management',
      'GET /api/rms/analytics/* - Restaurant analytics',
      'POST /webhooks/* - Payment gateway webhooks'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      details: 'A record with this information already exists'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`
  ====================================
  🚀 Server running on http://localhost:${PORT}
  📱 Customer API: /api/payments
  🏪 RMS API: /api/rms/payments
  📊 Analytics API: /api/rms/analytics
  💳 Webhooks: /webhooks/*
  🔍 Health: /health
  ====================================
  `);
});

module.exports = app; // Export for testing