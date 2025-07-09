// src/services/orderStore.js
import { io } from 'socket.io-client';
import { getOrders } from './api';
import { API_URL } from './api';

// Global order state
let orderState = {
  pending: [],
  inProgress: [],
  ready: [],
  served: [],
  lastFetched: null
};

// List of callbacks to notify when orders change
const subscribers = [];

// Socket instance
let socket = null;
let socketConnected = false;
let socketInitialized = false;

// Initialize socket connection
const initSocket = () => {
  if (socketInitialized) return;
  socketInitialized = true;
  
  try {
    console.log('OrderStore: Setting up socket connection...');
    socket = io(API_URL.replace('/api', ''));
    
    socket.on('connect', () => {
      console.log('OrderStore: Socket connected successfully:', socket.id);
      socketConnected = true;
      
      const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
      if (restaurant.id) {
        console.log(`OrderStore: Joining restaurant room: ${restaurant.id}`);
        socket.emit('joinRestaurant', restaurant.id);
      } else {
        console.warn('OrderStore: No restaurant ID found for socket room');
      }
      
      // Initial fetch after connection
      fetchOrdersNow();
    });
    
    socket.on('connect_error', (error) => {
      console.error('OrderStore: Socket connection error:', error);
      socketConnected = false;
    });
    
    socket.on('disconnect', (reason) => {
      console.log('OrderStore: Socket disconnected:', reason);
      socketConnected = false;
    });
    
    socket.on('orderUpdate', handleOrderUpdate);
    socket.on('kitchenUpdate', () => {
      console.log('OrderStore: Received kitchenUpdate event, refreshing orders');
      fetchOrdersNow();
    });
    
    // Set up interval to refresh orders every minute when visible
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('OrderStore: Auto-refreshing orders...');
        fetchOrdersNow();
      }
    }, 60000);
    
    // Initial fetch
    fetchOrdersNow();
  } catch (error) {
    console.error('OrderStore: Socket setup error:', error);
  }
};

// Handle order updates from socket
const handleOrderUpdate = (updatedOrder) => {
  console.log('OrderStore: Order update received:', updatedOrder);
  
  if (!updatedOrder || !updatedOrder._id) {
    console.warn('OrderStore: Invalid order update received');
    return;
  }
  
  try {
    // Update orders based on the new status
    const newOrders = { ...orderState };
    
    // Remove the order from all status lists
    Object.keys(newOrders).forEach(status => {
      if (status !== 'lastFetched') {
        newOrders[status] = newOrders[status].filter(order => 
          order._id !== updatedOrder._id
        );
      }
    });
    
    // Add the order to the appropriate status list based on the updated status
    switch (updatedOrder.status) {
      case 'pending':
        newOrders.pending.push(updatedOrder);
        break;
      case 'in-progress':
        newOrders.inProgress.push(updatedOrder);
        break;
      case 'ready':
        newOrders.ready.push(updatedOrder);
        break;
      case 'served':
        newOrders.served.push(updatedOrder);
        break;
      case 'completed':
      case 'cancelled':
        console.log(`OrderStore: Order ${updatedOrder._id} moved to ${updatedOrder.status} status - removed from active orders`);
        break;
      default:
        console.log(`OrderStore: Order ${updatedOrder._id} has unknown status "${updatedOrder.status}"`);
        break;
    }
    
    // Update state
    orderState = newOrders;
    
    // Cache orders in localStorage
    try {
      localStorage.setItem('cachedOrders', JSON.stringify({
        ...orderState,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('OrderStore: Error caching orders:', e);
    }
    
    // Notify subscribers
    notifySubscribers();
  } catch (error) {
    console.error('OrderStore: Error handling order update:', error);
  }
};

// Fetch orders from the server
const fetchOrdersNow = async () => {
  try {
    console.log('OrderStore: Fetching orders...');
    
    // Get active orders (pending, in-progress, ready, served)
    const response = await getOrders({ status: 'active' });
    
    console.log('OrderStore: Orders API response:', response);
    
    if (response.success) {
      // Process orders based on their status
      let pendingOrders = [];
      let inProgressOrders = [];
      let readyOrders = [];
      let servedOrders = [];
      
      // Debug logging
      console.log('OrderStore raw orders data type:', typeof response.orders);
      if (Array.isArray(response.orders)) {
        console.log('OrderStore array length:', response.orders.length);
      } else if (response.orders && typeof response.orders === 'object') {
        console.log('OrderStore object keys:', Object.keys(response.orders));
      }
      
      // Organize by status
      if (Array.isArray(response.orders)) {
        console.log('OrderStore: Processing flat orders array');
        pendingOrders = response.orders.filter(order => order.status === 'pending');
        inProgressOrders = response.orders.filter(order => order.status === 'in-progress');
        readyOrders = response.orders.filter(order => order.status === 'ready');
        servedOrders = response.orders.filter(order => order.status === 'served');
      } 
      // If the orders come pre-organized by status
      else if (response.orders && typeof response.orders === 'object') {
        console.log('OrderStore: Processing pre-organized orders object');
        pendingOrders = response.orders.pending || [];
        inProgressOrders = response.orders.inProgress || [];
        readyOrders = response.orders.ready || [];
        servedOrders = response.orders.served || [];
      }
      
      console.log('OrderStore: Processed orders:', {
        pending: pendingOrders.length,
        inProgress: inProgressOrders.length,
        ready: readyOrders.length,
        served: servedOrders.length
      });
      
      // Update orderState
      orderState = {
        pending: pendingOrders,
        inProgress: inProgressOrders,
        ready: readyOrders,
        served: servedOrders,
        lastFetched: new Date()
      };
      
      // Cache orders in localStorage
      try {
        localStorage.setItem('cachedOrders', JSON.stringify({
          ...orderState,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('OrderStore: Error caching orders:', e);
      }
      
      // Notify all subscribers
      notifySubscribers();
    } else {
      console.error('OrderStore: Error fetching orders:', response.message);
      tryLoadFromCache();
    }
  } catch (err) {
    console.error('OrderStore: Error fetching orders:', err);
    tryLoadFromCache();
  }
};

// Load orders from localStorage cache
const tryLoadFromCache = () => {
  try {
    const cachedOrdersJSON = localStorage.getItem('cachedOrders');
    if (cachedOrdersJSON) {
      const cachedOrders = JSON.parse(cachedOrdersJSON);
      const timestamp = cachedOrders.timestamp;
      
      // Only use cached data if it's less than 10 minutes old
      if (timestamp && (Date.now() - timestamp < 10 * 60 * 1000)) {
        console.log('OrderStore: Loading orders from cache');
        
        // Extract order data (excluding timestamp)
        const { timestamp: _, ...orderData } = cachedOrders;
        
        // Update state with cached data
        orderState = {
          ...orderData,
          lastFetched: new Date(timestamp)
        };
        
        // Notify subscribers
        notifySubscribers();
      } else {
        console.log('OrderStore: Cached orders are too old, not using');
      }
    }
  } catch (e) {
    console.error('OrderStore: Error loading cached orders:', e);
  }
};

// Notify all subscribers of state change
const notifySubscribers = () => {
  console.log(`OrderStore: Notifying ${subscribers.length} subscribers about order update`);
  subscribers.forEach(callback => {
    try {
      callback(orderState);
    } catch (error) {
      console.error('OrderStore: Error notifying subscriber:', error);
    }
  });
};

// Subscribe to order changes
export const subscribeToOrders = (callback) => {
  if (typeof callback !== 'function') {
    console.error('OrderStore: Subscriber must be a function');
    return () => {};
  }
  
  console.log('OrderStore: Adding new subscriber');
  
  // Initialize socket if not already done
  if (!socketInitialized) {
    initSocket();
  }
  
  // Add to subscribers if not already there
  if (!subscribers.includes(callback)) {
    subscribers.push(callback);
  }
  
  // Immediately notify with current state
  console.log('OrderStore: Immediately notifying new subscriber with current state');
  callback(orderState);
  
  // Return unsubscribe function
  return () => {
    console.log('OrderStore: Unsubscribing a listener');
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
};

// Force refresh orders
export const refreshOrders = () => {
  console.log('OrderStore: Manual refresh requested');
  
  // Initialize socket if needed
  if (!socketInitialized) {
    initSocket();
  } else {
    fetchOrdersNow();
  }
};

// Get current order state
export const getOrderState = () => {
  return orderState;
};

// Disconnect socket (for cleanup)
export const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketConnected = false;
    socketInitialized = false;
  }
};