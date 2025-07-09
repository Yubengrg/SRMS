// src/services/socketService.js - Enhanced for real-time table status
import { io } from 'socket.io-client';
import { API_URL } from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.restaurantId = null;
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.isSocketConnected = this.isSocketConnected.bind(this);
    this.emitOrderUpdate = this.emitOrderUpdate.bind(this);
    this.triggerKitchenUpdate = this.triggerKitchenUpdate.bind(this);
  }
  
  connect() {
    if (this.socket) {
      console.log('Socket already connected, reusing existing connection');
      return this.socket;
    }
    
    try {
      // Get restaurant ID from localStorage
      const restaurantJson = localStorage.getItem('restaurant');
      if (restaurantJson) {
        const restaurant = JSON.parse(restaurantJson);
        this.restaurantId = restaurant.id;
      }
      
      // Create socket connection
      const socketURL = API_URL.replace('/api', '');
      console.log('Connecting to socket server:', socketURL);
      
      this.socket = io(socketURL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });
      
      // Set up connection event handlers
      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
        this.isConnected = true;
        
        // Join restaurant room if we have an ID
        if (this.restaurantId) {
          console.log('Joining restaurant room:', this.restaurantId);
          this.socket.emit('joinRestaurant', this.restaurantId);
        }
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.isConnected = false;
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.isConnected = false;
      });
      
      // Add handler for updateTableStatus (for custom table status events)
      this.socket.on('updateTableStatus', (data) => {
        console.log('Received updateTableStatus via socket:', data);
        if (data && data.tableId) {
          // Format data to match tableStatusUpdate expected format
          const formattedData = {
            tableId: data.tableId,
            status: data.status,
            currentCustomer: data.currentCustomer
          };
          
          // Distribute this to any tableStatusUpdate listeners
          const callbacks = this.listeners.get('tableStatusUpdate');
          if (callbacks) {
            callbacks.forEach(cb => {
              try {
                cb(formattedData);
              } catch (e) {
                console.error('Error in socket event handler for tableStatusUpdate:', e);
              }
            });
          }
        }
      });
      
      return this.socket;
    } catch (error) {
      console.error('Error establishing socket connection:', error);
      return null;
    }
  }
  
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
  
  // Register an event listener
  on(event, callback) {
    if (!this.socket) {
      this.connect();
    }
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      
      // Add the socket.io event listener that will distribute to our callbacks
      this.socket.on(event, (...args) => {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          callbacks.forEach(cb => {
            try {
              cb(...args);
            } catch (e) {
              console.error(`Error in socket event handler for ${event}:`, e);
            }
          });
        }
      });
    }
    
    // Add the callback to our set
    this.listeners.get(event).add(callback);
    
    // Return a function to remove this specific listener
    return () => {
      this.off(event, callback);
    };
  }
  
  // Remove an event listener
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      
      // If no more callbacks for this event, remove the socket.io listener
      if (callbacks.size === 0) {
        this.listeners.delete(event);
        if (this.socket) {
          this.socket.off(event);
        }
      }
    }
  }
  
  // Emit an event
  emit(event, ...args) {
    if (!this.socket) {
      console.warn('Attempted to emit an event without an active socket connection');
      return false;
    }
    
    console.log(`Emitting ${event} event:`, ...args);
    this.socket.emit(event, ...args);
    return true;
  }
  
  // Check if the socket is connected
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
  
  // New function to emit order updates
  emitOrderUpdate(orderId, status) {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot emit order update');
      return false;
    }
    
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    if (!restaurant.id) {
      console.warn('No restaurant ID found, cannot emit order update');
      return false;
    }
    
    console.log(`Emitting orderUpdate event via socket for order ${orderId}`);
    
    this.socket.emit('orderUpdateRequest', {
      orderId,
      status,
      restaurantId: restaurant.id
    });
    
    return true;
  }
  
  // New function to trigger kitchen updates
  triggerKitchenUpdate() {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot trigger kitchen update');
      return false;
    }
    
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    if (!restaurant.id) {
      console.warn('No restaurant ID found, cannot trigger kitchen update');
      return false;
    }
    
    console.log(`Manually triggering kitchenUpdate event via socket`);
    
    this.socket.emit('triggerKitchenUpdate', {
      restaurantId: restaurant.id,
      timestamp: new Date().toISOString()
    });
    
    return true;
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService;