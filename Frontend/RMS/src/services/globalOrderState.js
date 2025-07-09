// Updated globalOrderState.js to include cancelled orders
import { io } from 'socket.io-client';
import { API_URL, getOrders } from './api';

// ============= GLOBAL STATE AND VARIABLES =============
// This state exists outside React's component lifecycle
let globalOrderState = {
  pending: [],
  inProgress: [],
  ready: [],
  served: [],
  cancelled: [], // Add cancelled orders
  lastUpdated: null
};

// Global socket connection
let socket = null;
let isInitialized = false;
let isSocketConnected = false;

// List of components that are subscribed to order updates
const subscribers = new Set();

// ============= INITIALIZATION =============
// Initialize once at application startup
const initialize = () => {
  if (isInitialized) return;
  
  console.log('GlobalOrderState: Initializing global order state');
  isInitialized = true;
  
  // Create socket connection
  setupSocket();
  
  // Initial data fetch
  fetchOrdersData();
  
  // Set up periodic refresh
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchOrdersData();
    }
  }, 60000); // Refresh every minute when visible
};

// Setup socket connection
const setupSocket = () => {
  try {
    console.log('GlobalOrderState: Setting up socket connection');
    socket = io(API_URL.replace('/api', ''));
    
    socket.on('connect', () => {
      console.log('GlobalOrderState: Socket connected:', socket.id);
      isSocketConnected = true;
      
      // Join restaurant room
      const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
      if (restaurant.id) {
        console.log(`GlobalOrderState: Joining restaurant room:`, restaurant.id);
        socket.emit('joinRestaurant', restaurant.id);
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log('GlobalOrderState: Socket disconnected:', reason);
      isSocketConnected = false;
    });
    
    socket.on('connect_error', (error) => {
      console.error('GlobalOrderState: Socket connection error:', error);
      isSocketConnected = false;
    });
    
    // Set up event handlers
    socket.on('orderUpdate', handleOrderUpdate);
    socket.on('kitchenUpdate', () => {
      console.log('GlobalOrderState: Kitchen update received');
      fetchOrdersData();
    });
  } catch (error) {
    console.error('GlobalOrderState: Error setting up socket:', error);
  }
};

// Handle order updates from socket - ENHANCED to include cancelled orders
const handleOrderUpdate = (updatedOrder) => {
  console.log('GlobalOrderState: Order update received:', updatedOrder);
  
  if (!updatedOrder || !updatedOrder._id) {
    console.warn('GlobalOrderState: Invalid order update received');
    return;
  }
  
  try {
    // Create a new state to avoid mutation
    const newState = {
      pending: [...globalOrderState.pending],
      inProgress: [...globalOrderState.inProgress],
      ready: [...globalOrderState.ready],
      served: [...globalOrderState.served],
      cancelled: [...globalOrderState.cancelled], // Include cancelled
    };
    
    // Remove the order from all status lists
    Object.keys(newState).forEach(status => {
      newState[status] = newState[status].filter(order => 
        order._id !== updatedOrder._id
      );
    });
    
    // Add the order to the appropriate status list
    switch (updatedOrder.status) {
      case 'pending':
        newState.pending.push(updatedOrder);
        break;
      case 'in-progress':
        newState.inProgress.push(updatedOrder);
        break;
      case 'ready':
        newState.ready.push(updatedOrder);
        break;
      case 'served':
        newState.served.push(updatedOrder);
        break;
      case 'cancelled':
        newState.cancelled.push(updatedOrder);
        break;
      default:
        // Order is completed - just remove it from active lists
        console.log(`GlobalOrderState: Order ${updatedOrder._id} moved to ${updatedOrder.status} status - removed from active orders`);
        break;
    }
    
    // Update global state
    globalOrderState = {
      ...newState,
      lastUpdated: new Date()
    };
    
    // Notify all subscribers
    notifySubscribers();
  } catch (error) {
    console.error('GlobalOrderState: Error handling order update:', error);
  }
};

// Fetch orders from API - ENHANCED to include cancelled orders
const fetchOrdersData = async () => {
  try {
    console.log('GlobalOrderState: Fetching orders data from API');
    
    // Get both active orders and cancelled orders
    const [activeResponse, cancelledResponse] = await Promise.all([
      getOrders({ status: 'active' }),
      getOrders({ status: 'cancelled', limit: 50 }) // Limit cancelled orders to recent 50
    ]);
    
    if (activeResponse && activeResponse.success) {
      console.log('GlobalOrderState: Active orders fetched successfully');
      
      // Process active orders based on their status
      let pendingOrders = [];
      let inProgressOrders = [];
      let readyOrders = [];
      let servedOrders = [];
      
      // If response.orders is an array, organize by status
      if (Array.isArray(activeResponse.orders)) {
        pendingOrders = activeResponse.orders.filter(order => order.status === 'pending');
        inProgressOrders = activeResponse.orders.filter(order => order.status === 'in-progress');
        readyOrders = activeResponse.orders.filter(order => order.status === 'ready');
        servedOrders = activeResponse.orders.filter(order => order.status === 'served');
      } 
      // If response.orders is an object with status keys
      else if (activeResponse.orders && typeof activeResponse.orders === 'object') {
        pendingOrders = activeResponse.orders.pending || [];
        inProgressOrders = activeResponse.orders.inProgress || [];
        readyOrders = activeResponse.orders.ready || [];
        servedOrders = activeResponse.orders.served || [];
      }
      
      // Process cancelled orders
      let cancelledOrders = [];
      if (cancelledResponse && cancelledResponse.success) {
        console.log('GlobalOrderState: Cancelled orders fetched successfully');
        
        if (Array.isArray(cancelledResponse.orders)) {
          cancelledOrders = cancelledResponse.orders.filter(order => order.status === 'cancelled');
        } else if (cancelledResponse.orders && typeof cancelledResponse.orders === 'object') {
          cancelledOrders = cancelledResponse.orders.cancelled || [];
        }
      } else {
        console.warn('GlobalOrderState: Failed to fetch cancelled orders:', cancelledResponse?.message);
      }
      
      // Update global state
      globalOrderState = {
        pending: pendingOrders,
        inProgress: inProgressOrders,
        ready: readyOrders,
        served: servedOrders,
        cancelled: cancelledOrders,
        lastUpdated: new Date()
      };
      
      console.log('GlobalOrderState: Orders organized:', {
        pending: pendingOrders.length,
        inProgress: inProgressOrders.length,
        ready: readyOrders.length,
        served: servedOrders.length,
        cancelled: cancelledOrders.length
      });
      
      // Notify subscribers
      notifySubscribers();
    } else {
      console.error('GlobalOrderState: Error fetching orders:', activeResponse?.message);
    }
  } catch (error) {
    console.error('GlobalOrderState: Error fetching orders data:', error);
  }
};

// Notify all subscribers with the current state
const notifySubscribers = () => {
  console.log(`GlobalOrderState: Notifying ${subscribers.size} subscribers`);
  subscribers.forEach(callback => {
    try {
      callback(globalOrderState);
    } catch (error) {
      console.error('GlobalOrderState: Error notifying subscriber:', error);
    }
  });
};

// ============= PUBLIC API =============
// Subscribe to order updates
export const subscribeToOrders = (callback) => {
  // Initialize if not already done
  if (!isInitialized) {
    initialize();
  }
  
  console.log('GlobalOrderState: New subscriber added');
  subscribers.add(callback);
  
  // Immediately notify with current state
  callback(globalOrderState);
  
  // Return unsubscribe function
  return () => {
    console.log('GlobalOrderState: Subscriber removed');
    subscribers.delete(callback);
  };
};

// Manually refresh orders data
export const refreshOrders = () => {
  console.log('GlobalOrderState: Manual refresh requested');
  
  // Initialize if not already done
  if (!isInitialized) {
    initialize();
  } else {
    fetchOrdersData();
  }
};

// Function to directly update an order in the global state - ENHANCED for cancelled orders
export const updateOrderInGlobalState = (orderId, updatedFields) => {
  try {
    console.log(`GlobalOrderState: Directly updating order ${orderId} with fields:`, updatedFields);
    
    if (!orderId || !updatedFields) {
      console.warn('Cannot update order without ID or updated fields');
      return false;
    }
    
    // Create a shallow copy of the current state
    const newState = {
      pending: [...globalOrderState.pending],
      inProgress: [...globalOrderState.inProgress],
      ready: [...globalOrderState.ready],
      served: [...globalOrderState.served],
      cancelled: [...globalOrderState.cancelled], // Include cancelled
      lastUpdated: new Date()
    };
    
    // Find the order in all status lists
    let orderFound = false;
    let currentStatus = null;
    let orderToUpdate = null;
    let orderIndex = -1;
    
    // Helper to check a status list
    const checkStatusList = (statusList, status) => {
      const index = statusList.findIndex(order => order._id === orderId);
      if (index !== -1) {
        orderFound = true;
        currentStatus = status;
        orderToUpdate = { ...statusList[index], ...updatedFields };
        orderIndex = index;
        return true;
      }
      return false;
    };
    
    // Check all status lists including cancelled
    if (checkStatusList(newState.pending, 'pending')) {
      newState.pending.splice(orderIndex, 1);
    } else if (checkStatusList(newState.inProgress, 'in-progress')) {
      newState.inProgress.splice(orderIndex, 1);
    } else if (checkStatusList(newState.ready, 'ready')) {
      newState.ready.splice(orderIndex, 1);
    } else if (checkStatusList(newState.served, 'served')) {
      newState.served.splice(orderIndex, 1);
    } else if (checkStatusList(newState.cancelled, 'cancelled')) {
      newState.cancelled.splice(orderIndex, 1);
    }
    
    if (!orderFound) {
      console.warn(`Order ${orderId} not found in global state`);
      return false;
    }
    
    // Add the updated order to the appropriate list based on its new status
    if (orderToUpdate.status === 'pending') {
      newState.pending.push(orderToUpdate);
    } else if (orderToUpdate.status === 'in-progress') {
      newState.inProgress.push(orderToUpdate);
    } else if (orderToUpdate.status === 'ready') {
      newState.ready.push(orderToUpdate);
    } else if (orderToUpdate.status === 'served') {
      newState.served.push(orderToUpdate);
    } else if (orderToUpdate.status === 'cancelled') {
      newState.cancelled.push(orderToUpdate);
    }
    
    // Update global state
    globalOrderState = newState;
    
    // Notify subscribers of the update
    notifySubscribers();
    
    return true;
  } catch (error) {
    console.error('Error updating order in global state:', error);
    return false;
  }
};

// Function to update individual order items - ENHANCED for cancelled orders
export const updateOrderItemInGlobalState = (orderId, itemId, updatedFields) => {
  try {
    console.log(`GlobalOrderState: Updating item ${itemId} in order ${orderId}`);
    
    if (!orderId || !itemId || !updatedFields) {
      console.warn('Cannot update order item without IDs or updated fields');
      return false;
    }
    
    // Create a shallow copy of the current state
    const newState = {
      pending: [...globalOrderState.pending],
      inProgress: [...globalOrderState.inProgress],
      ready: [...globalOrderState.ready],
      served: [...globalOrderState.served],
      cancelled: [...globalOrderState.cancelled], // Include cancelled
      lastUpdated: new Date()
    };
    
    // Find the order in all status lists including cancelled
    let orderFound = false;
    
    // Helper to update an item in a status list
    const updateItemInStatusList = (statusList) => {
      for (let i = 0; i < statusList.length; i++) {
        if (statusList[i]._id === orderId) {
          orderFound = true;
          
          // Make a deep copy of the order
          const updatedOrder = { ...statusList[i] };
          
          // Find and update the specific item
          if (updatedOrder.items && Array.isArray(updatedOrder.items)) {
            const itemIndex = updatedOrder.items.findIndex(item => item._id === itemId);
            
            if (itemIndex !== -1) {
              // Update the item with new fields
              updatedOrder.items[itemIndex] = {
                ...updatedOrder.items[itemIndex],
                ...updatedFields
              };
              
              // Replace the order in the list
              statusList[i] = updatedOrder;
              return true;
            }
          }
        }
      }
      return false;
    };
    
    // Try updating the item in all status lists including cancelled
    updateItemInStatusList(newState.pending) ||
    updateItemInStatusList(newState.inProgress) ||
    updateItemInStatusList(newState.ready) ||
    updateItemInStatusList(newState.served) ||
    updateItemInStatusList(newState.cancelled);
    
    if (!orderFound) {
      console.warn(`Order ${orderId} not found in global state`);
      return false;
    }
    
    // Update global state
    globalOrderState = newState;
    
    // Notify subscribers of the update
    notifySubscribers();
    
    return true;
  } catch (error) {
    console.error('Error updating order item in global state:', error);
    return false;
  }
};

// Initialize on import
initialize();

// Export the API
export default {
  subscribeToOrders,
  refreshOrders,
  updateOrderInGlobalState,
  updateOrderItemInGlobalState
};