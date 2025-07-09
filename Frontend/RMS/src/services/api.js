// src/services/api.js
import axios from 'axios';

// Use the correct API URL for local development
export const API_URL = 'http://localhost:5001/api';

// Create axios instance with token
const getAuthInstance = () => {
  const token = localStorage.getItem('token');
  
  // Debug token information
  if (token) {
    try {
      // Log the first part of the token for debugging
      console.log('Using token (first 10 chars):', token.substring(0, 10) + '...');
      
      // Decode JWT to check payload (this is just for debugging)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      console.log('Token payload:', payload);
      
      if (!payload.restaurantId) {
        console.warn('WARNING: Token does not contain restaurantId!');
      }
    } catch (e) {
      console.warn('Error decoding token for debug purposes:', e);
    }
  } else {
    console.warn('No token found in localStorage');
  }
  
  // Create axios instance with proper headers
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
};

// Helper function to create form data instance
const createMultipartInstance = () => {
  const token = localStorage.getItem('token');
  
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
};

// Add restaurantId to requests that need it
const addRestaurantIdToRequest = (config) => {
  const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
  
  if (restaurant.id) {
    // Add restaurantId as query parameter
    config.params = {
      ...config.params,
      restaurantId: restaurant.id
    };
  }
  
  return config;
};

// ===== Auth API =====
export const login = async (credentials) => {
  try {
    console.log('Attempting login with credentials:', {
      email: credentials.email,
      password: '********' // Don't log actual password
    });
    
    const response = await axios.post(`${API_URL}/rms/login`, credentials);
    
    console.log('Login response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
};

export const verifyToken = async () => {
  try {
    const api = getAuthInstance();
    const response = await api.get('/rms/verify-token');
    
    console.log('Token verification response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Token verification error:', error.response?.data || error.message);
    throw error;
  }
};

export const selectRestaurant = async (restaurantId) => {
  try {
    const api = getAuthInstance();
    console.log(`Selecting restaurant explicitly with ID: ${restaurantId}`);
    
    // Make the API call to select a restaurant and get a new token
    const response = await api.post('/rms/select-restaurant', { restaurantId });
    
    if (response.data && response.data.success) {
      console.log("Restaurant selection success response:", response.data);
      
      // Store new token with restaurant context
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log("New token with restaurant context stored");
        
        try {
          // For debugging - decode and log token payload
          const base64Url = response.data.token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          console.log('New token payload:', payload);
          
          // Verify restaurant ID is in token
          if (!payload.restaurantId) {
            console.warn("WARNING: New token doesn't contain restaurantId claim!");
          } else {
            console.log(`Token contains restaurantId: ${payload.restaurantId}`);
          }
        } catch (e) {
          console.warn("Error decoding token (non-critical):", e);
        }
      } else {
        console.error("No token received in restaurant selection response");
      }
      
      // Store restaurant info
      if (response.data.restaurant) {
        const restaurant = {
          id: response.data.restaurant.id,
          name: response.data.restaurant.name
        };
        localStorage.setItem('restaurant', JSON.stringify(restaurant));
        console.log("Restaurant info stored:", restaurant);
      } else {
        // If response doesn't contain restaurant, use the ID we already have
        const restaurant = {
          id: restaurantId,
          name: "Selected Restaurant" // This is a fallback name
        };
        localStorage.setItem('restaurant', JSON.stringify(restaurant));
        console.log("Restaurant info stored from ID:", restaurant);
      }
      
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to select restaurant');
    }
  } catch (error) {
    console.error('Restaurant selection error:', error);
    throw error;
  }
};

// ===== Staff Authentication =====
export const staffLogin = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/restaurants/staff/login`, credentials);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getRestaurantStaff = async () => {
  try {
    const api = getAuthInstance();
    const response = await api.get('/restaurants/staff');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const searchUsers = async (searchTerm) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/restaurants/staff/search?searchTerm=${searchTerm}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addStaffMember = async (userData) => {
  try {
    const api = getAuthInstance();
    const response = await api.post('/restaurants/staff', userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateStaffMember = async (staffId, data) => {
  try {
    const api = getAuthInstance();
    const response = await api.put(`/restaurants/staff/${staffId}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const removeStaffMember = async (staffId) => {
  try {
    const api = getAuthInstance();
    const response = await api.delete(`/restaurants/staff/${staffId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ===== Dashboard API =====
export const getDashboardData = async () => {
  try {
    const api = getAuthInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    console.log(`Fetching dashboard data for restaurant: ${restaurant.id || 'unknown'}`);
    
    // Add restaurantId as query parameter as a fallback
    const url = restaurant.id ? 
      `/rms/dashboard?restaurantId=${restaurant.id}` : 
      '/rms/dashboard';
      
    const response = await api.get(url);
    
    console.log('Dashboard data response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Dashboard data error:', error.response?.data || error.message);
    throw error;
  }
};

// ===== Tables API =====
export const getTables = async () => {
  try {
    const api = getAuthInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    console.log(`Fetching tables for restaurant: ${restaurant.id || 'unknown'}`);
    
    // Use the correct endpoint path
    const response = await api.get('/rms/tables');
    console.log("Tables response:", response.data);
    return response.data;
  } catch (error) {
    console.error('Get tables error:', error.response?.data || error.message);
    throw error;
  }
};

export const getTable = async (tableId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/tables/${tableId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createTable = async (tableData) => {
  try {
    const api = getAuthInstance();
    
    // Include the essential fields for table creation
    const tableRequest = {
      tableNumber: tableData.tableNumber,
      capacity: tableData.capacity || 4,
      section: tableData.section || 'Main',
      floor: tableData.floor || 'Ground',
      status: 'available',
      isActive: tableData.isActive
      // No need to explicitly include restaurant ID as it's handled by the middleware
    };
    
    console.log("Creating table with data:", tableRequest);
    
    const response = await api.post('/rms/tables', tableRequest);
    console.log("Table creation response:", response.data);
    return response.data;
  } catch (error) {
    console.error('Table creation error details:', error.response?.data);
    throw error;
  }
};

export const updateTable = async (tableId, tableData) => {
  try {
    const api = getAuthInstance();
    console.log(`Updating table ${tableId} with data:`, tableData);
    const response = await api.put(`/rms/tables/${tableId}`, tableData);
    console.log("Update table response:", response.data);
    return response.data;
  } catch (error) {
    console.error('Update table error:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteTable = async (tableId) => {
  try {
    const api = getAuthInstance();
    const response = await api.delete(`/rms/tables/${tableId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const changeTableStatus = async (tableId, status) => {
  try {
    const api = getAuthInstance();
    const response = await api.patch(`/rms/tables/${tableId}/status`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const regenerateQRCode = async (tableId) => {
  try {
    const api = getAuthInstance();
    console.log(`Regenerating QR code for table: ${tableId}`);
    const response = await api.post(`/rms/tables/${tableId}/qrcode`);
    console.log("QR code response:", response.data);
    return response.data;
  } catch (error) {
    console.error('Regenerate QR error:', error.response?.data || error.message);
    throw error;
  }
};

// ===== Menu Management API =====
export const getMenuCategories = async () => {
  try {
    const api = getAuthInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    // Add restaurantId as query parameter
    const url = `/rms/menu/categories${restaurant.id ? `?restaurantId=${restaurant.id}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Get menu categories error:', error.response?.data || error.message);
    throw error;
  }
};

export const createMenuCategory = async (formData) => {
  try {
    const api = createMultipartInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    // Add restaurantId to formData
    if (restaurant.id) {
      formData.append('restaurantId', restaurant.id);
    }
    
    const response = await api.post('/rms/menu/categories', formData);
    return response.data;
  } catch (error) {
    console.error('Create menu category error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateMenuCategory = async (categoryId, formData) => {
  try {
    const api = createMultipartInstance();
    const response = await api.put(`/rms/menu/categories/${categoryId}`, formData);
    return response.data;
  } catch (error) {
    console.error('Update menu category error:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteMenuCategory = async (categoryId) => {
  try {
    const api = getAuthInstance();
    const response = await api.delete(`/rms/menu/categories/${categoryId}`);
    return response.data;
  } catch (error) {
    console.error('Delete menu category error:', error.response?.data || error.message);
    throw error;
  }
};

export const reorderCategories = async (categoryOrders) => {
  try {
    const api = getAuthInstance();
    const response = await api.post('/rms/menu/categories/reorder', { categoryOrders });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getMenuItems = async (categoryId = '') => {
  try {
    const api = getAuthInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    let url = '/rms/menu/items';
    const params = new URLSearchParams();
    
    if (categoryId) {
      params.append('categoryId', categoryId);
    }
    
    if (restaurant.id) {
      params.append('restaurantId', restaurant.id);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Get menu items error:', error.response?.data || error.message);
    throw error;
  }
};

export const createMenuItem = async (formData) => {
  try {
    const api = createMultipartInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    // Add restaurantId to formData
    if (restaurant.id) {
      formData.append('restaurantId', restaurant.id);
    }
    
    console.log('Creating menu item with image...');
    
    // Log form data contents (for debugging)
    for (let pair of formData.entries()) {
      if (pair[0] === 'image') {
        console.log('Form contains image file:', pair[1].name, 'Size:', pair[1].size);
      } else {
        console.log('Form data entry:', pair[0], pair[1]);
      }
    }
    
    const response = await api.post('/rms/menu/items', formData);
    console.log('Create menu item response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Create menu item error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateMenuItem = async (itemId, formData) => {
  try {
    const api = createMultipartInstance();
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    // Add restaurantId to formData if necessary
    if (restaurant.id && !formData.has('restaurantId')) {
      formData.append('restaurantId', restaurant.id);
    }
    
    console.log(`Updating menu item ${itemId} with${formData.has('image') ? '' : 'out'} image...`);
    
    // Log form data for debugging
    for (let pair of formData.entries()) {
      if (pair[0] === 'image') {
        console.log('Form contains image file:', pair[1].name, 'Size:', pair[1].size);
      } else {
        console.log('Form data entry:', pair[0], pair[1]);
      }
    }
    
    const response = await api.put(`/rms/menu/items/${itemId}`, formData);
    console.log('Update menu item response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Update menu item error:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteMenuItem = async (itemId) => {
  try {
    const api = getAuthInstance();
    const response = await api.delete(`/rms/menu/items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Delete menu item error:', error.response?.data || error.message);
    throw error;
  }
};

export const toggleItemAvailability = async (itemId) => {
  try {
    const api = getAuthInstance();
    const response = await api.patch(`/rms/menu/items/${itemId}/toggle-availability`);
    return response.data;
  } catch (error) {
    console.error('Toggle availability error:', error.response?.data || error.message);
    throw error;
  }
};

export const reorderItems = async (itemOrders) => {
  try {
    const api = getAuthInstance();
    const response = await api.post('/rms/menu/items/reorder', { itemOrders });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ===== Orders API =====
export const getOrders = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    
    // Handle 'active' status filter specially
    if (filters.status === 'active') {
      // Convert 'active' to the specific statuses you want
      delete filters.status;
      filters.status = ['pending', 'in-progress', 'ready', 'served'].join(',');
    }
    // Handle 'cancelled' status filter
    else if (filters.status === 'cancelled') {
      // Keep cancelled as is, but ensure we're only getting cancelled orders
      filters.status = 'cancelled';
    }
    
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/rms/orders?${queryParams}`);
    
    console.log('Orders response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Get orders error:', error.response?.data || error.message);
    throw error;
  }
};

export const getActiveOrders = async () => {
  try {
    const api = getAuthInstance();
    // Explicitly exclude cancelled and completed orders
    return await getOrders({ 
      status: ['pending', 'in-progress', 'ready', 'served'].join(',')
    });
  } catch (error) {
    console.error('Get active orders error:', error.response?.data || error.message);
    throw error;
  }
};

export const getOrder = async (orderId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Get order details error:', error.response?.data || error.message);
    throw error;
  }
};

export const createOrder = async (orderData) => {
  try {
    const api = getAuthInstance();
    const response = await api.post('/rms/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('Create order error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, status, note) => {
  try {
    console.log(`API: Updating order ${orderId} status to ${status}`);
    
    // Add special handling for cancellation
    if (status === 'cancelled') {
      console.log('🚫 Processing order cancellation...');
    }
    
    // Make API call to update status on the backend
    const api = getAuthInstance();
    const response = await api.put(`/rms/orders/${orderId}/status`, { 
      status, 
      note: note || (status === 'cancelled' ? 'Order cancelled by staff' : '')
    });
    
    if (response.data && response.data.success) {
      console.log('Order status updated successfully on backend');
      
      // For cancelled orders, trigger additional cleanup if needed
      if (status === 'cancelled') {
        console.log('✅ Order cancellation completed successfully');
      }
      
      // Trigger socket update if available
      try {
        const socketService = await import('./socketService').then(module => module.default);
        socketService.emitOrderUpdate(orderId, status);
        socketService.triggerKitchenUpdate();
      } catch (socketError) {
        console.warn('Socket service not available for real-time update:', socketError);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Update order status error:', error.response?.data || error.message);
    
    // Provide more specific error messages for cancellation failures
    if (error.response?.status === 400 && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    
    throw error;
  }
};

export const updateOrderItemStatus = async (orderId, itemId, status) => {
  try {
    console.log(`API: Updating item ${itemId} in order ${orderId} to status ${status}`);
    
    // Make API call to update item status on the backend
    const api = getAuthInstance();
    const response = await api.put(`/rms/orders/${orderId}/items/${itemId}/status`, { status });
    
    if (response.data && response.data.success) {
      console.log('Order item status updated successfully on backend');
      
      // Trigger socket updates if available
      try {
        // Import dynamically to avoid circular dependency
        const socketService = await import('./socketService').then(module => module.default);
        socketService.triggerKitchenUpdate();
      } catch (socketError) {
        console.warn('Socket service not available for real-time update:', socketError);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Update item status error:', error.response?.data || error.message);
    throw error;
  }
};

export const cancelOrder = async (orderId, reason = 'Order cancelled by staff') => {
  try {
    console.log(`🚫 Cancelling order ${orderId} with reason: ${reason}`);
    
    const api = getAuthInstance();
    const response = await api.put(`/rms/orders/${orderId}/status`, { 
      status: 'cancelled',
      note: reason
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Order cancelled successfully');
      
      // Trigger socket updates
      try {
        const socketService = await import('./socketService').then(module => module.default);
        socketService.emitOrderUpdate(orderId, 'cancelled');
        socketService.triggerKitchenUpdate();
      } catch (socketError) {
        console.warn('Socket service not available for real-time update:', socketError);
      }
      
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to cancel order');
    }
  } catch (error) {
    console.error('Cancel order error:', error.response?.data || error.message);
    throw error;
  }
};

export const getCancelledOrders = async (limit = 50, page = 1) => {
  try {
    const response = await getOrders({ 
      status: 'cancelled', 
      limit, 
      page,
      sort: 'createdAt',
      order: 'desc' // Most recent first
    });
    
    return response;
  } catch (error) {
    console.error('Get cancelled orders error:', error);
    throw error;
  }
};

export const restoreOrder = async (orderId, newStatus = 'pending') => {
  try {
    console.log(`🔄 Restoring cancelled order ${orderId} to status ${newStatus}`);
    
    const api = getAuthInstance();
    const response = await api.put(`/rms/orders/${orderId}/status`, { 
      status: newStatus,
      note: `Order restored from cancelled status to ${newStatus}`
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Order restored successfully');
      
      // Trigger socket updates
      try {
        const socketService = await import('./socketService').then(module => module.default);
        socketService.emitOrderUpdate(orderId, newStatus);
        socketService.triggerKitchenUpdate();
      } catch (socketError) {
        console.warn('Socket service not available for real-time update:', socketError);
      }
      
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to restore order');
    }
  } catch (error) {
    console.error('Restore order error:', error.response?.data || error.message);
    throw error;
  }
};

export const permanentlyDeleteOrder = async (orderId) => {
  try {
    console.log(`🗑️ Permanently deleting order ${orderId}`);
    
    const api = getAuthInstance();
    const response = await api.delete(`/rms/orders/${orderId}`);
    
    if (response.data && response.data.success) {
      console.log('✅ Order permanently deleted');
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to delete order');
    }
  } catch (error) {
    console.error('Delete order error:', error.response?.data || error.message);
    throw error;
  }
};

export const bulkCancelOrders = async (orderIds, reason = 'Bulk cancellation by staff') => {
  try {
    console.log(`🚫 Bulk cancelling ${orderIds.length} orders`);
    
    const api = getAuthInstance();
    const response = await api.put('/rms/orders/bulk/cancel', {
      orderIds,
      reason
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Orders bulk cancelled successfully');
      
      // Trigger socket updates for each order
      try {
        const socketService = await import('./socketService').then(module => module.default);
        orderIds.forEach(orderId => {
          socketService.emitOrderUpdate(orderId, 'cancelled');
        });
        socketService.triggerKitchenUpdate();
      } catch (socketError) {
        console.warn('Socket service not available for real-time update:', socketError);
      }
      
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to bulk cancel orders');
    }
  } catch (error) {
    console.error('Bulk cancel orders error:', error.response?.data || error.message);
    throw error;
  }
};

export const getOrderCancellationReasons = async (startDate, endDate) => {
  try {
    const api = getAuthInstance();
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/rms/orders/analytics/cancellation-reasons?${params.toString()}`);
    
    return response.data;
  } catch (error) {
    console.error('Get cancellation reasons error:', error.response?.data || error.message);
    throw error;
  }
};

export const exportCancelledOrdersReport = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams({ 
      ...filters, 
      status: 'cancelled',
      format: 'csv' 
    }).toString();
    
    const response = await api.get(`/rms/orders/export?${queryParams}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cancelled-orders-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'Cancelled orders report exported successfully' };
  } catch (error) {
    console.error('Export cancelled orders error:', error.response?.data || error.message);
    throw error;
  }
};

export const canOrderBeCancelled = async (orderId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/orders/${orderId}/can-cancel`);
    
    return response.data;
  } catch (error) {
    console.error('Check if order can be cancelled error:', error.response?.data || error.message);
    throw error;
  }
};

export const getOrderRefundInfo = async (orderId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/orders/${orderId}/refund-info`);
    
    return response.data;
  } catch (error) {
    console.error('Get order refund info error:', error.response?.data || error.message);
    throw error;
  }
};

// KEEP YOUR ORIGINAL FUNCTION NAME - This is what was working in your OrderDetailsModal
export const updatePaymentStatus = async (orderId, paymentData) => {
  try {
    const api = getAuthInstance();
    console.log(`Updating order ${orderId} payment status:`, paymentData);
    const response = await api.put(`/rms/orders/${orderId}/payment`, paymentData);
    return response.data;
  } catch (error) {
    console.error('Update payment status error:', error.response?.data || error.message);
    throw error;
  }
};

export const getOrderStats = async (period) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/orders/stats?period=${period || 'today'}`);
    return response.data;
  } catch (error) {
    console.error('Get order stats error:', error.response?.data || error.message);
    throw error;
  }
};

export const getOrderCancellationStats = async (period = 'month') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/orders/stats/cancellations?period=${period}`);
    
    return response.data;
  } catch (error) {
    console.error('Get cancellation stats error:', error.response?.data || error.message);
    throw error;
  }
};

// ===== Reservations API =====
export const getReservations = async (date) => {
  try {
    const api = getAuthInstance();
    const query = date ? `?date=${date}` : '';
    const response = await api.get(`/rms/tables/reservations${query}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addReservation = async (tableId, reservationData) => {
  try {
    const api = getAuthInstance();
    const response = await api.post(`/rms/tables/${tableId}/reservations`, reservationData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateReservation = async (tableId, reservationId, reservationData) => {
  try {
    const api = getAuthInstance();
    const response = await api.put(`/rms/tables/${tableId}/reservations/${reservationId}`, reservationData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const cancelReservation = async (tableId, reservationId) => {
  try {
    const api = getAuthInstance();
    const response = await api.delete(`/rms/tables/${tableId}/reservations/${reservationId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ===== Inventory API =====
export const getInventoryItems = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/rms/inventory?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Get inventory items error:', error.response?.data || error.message);
    throw error;
  }
};

export const getInventoryItem = async (itemId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/inventory/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Get inventory item error:', error.response?.data || error.message);
    throw error;
  }
};

export const createInventoryItem = async (itemData) => {
  try {
    const api = getAuthInstance();
    const response = await api.post('/rms/inventory', itemData);
    return response.data;
  } catch (error) {
    console.error('Create inventory item error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateInventoryItem = async (itemId, itemData) => {
  try {
    const api = getAuthInstance();
    const response = await api.put(`/rms/inventory/${itemId}`, itemData);
    return response.data;
  } catch (error) {
    console.error('Update inventory item error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateInventoryQuantity = async (itemId, quantityData) => {
  try {
    const api = getAuthInstance();
    const response = await api.patch(`/rms/inventory/${itemId}/quantity`, quantityData);
    return response.data;
  } catch (error) {
    console.error('Update inventory quantity error:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteInventoryItem = async (itemId) => {
  try {
    const api = getAuthInstance();
    const response = await api.delete(`/rms/inventory/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Delete inventory item error:', error.response?.data || error.message);
    throw error;
  }
};

export const getInventoryTransactions = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/rms/inventory/transactions?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Get inventory transactions error:', error.response?.data || error.message);
    throw error;
  }
};

export const getInventorySummary = async () => {
  try {
    const api = getAuthInstance();
    const response = await api.get('/rms/inventory/summary');
    return response.data;
  } catch (error) {
    console.error('Get inventory summary error:', error.response?.data || error.message);
    throw error;
  }
};

// ===== ADDITIONAL PAYMENT MANAGEMENT FUNCTIONS =====
// These are additional functions for comprehensive payment management

// Get restaurant payments with filters (for payment management dashboard)
export const getRestaurantPayments = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/rms/payments?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Get restaurant payments error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment analytics for dashboard
export const getPaymentAnalytics = async (params = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/rms/payments/analytics?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Get payment analytics error:', error.response?.data || error.message);
    throw error;
  }
};

// Confirm cash payment (when customer pays at counter)
export const confirmCashPayment = async (orderId, paymentData) => {
  try {
    const api = getAuthInstance();
    console.log(`Confirming cash payment for order ${orderId}:`, paymentData);
    const response = await api.post(`/rms/payments/${orderId}/cash/confirm`, paymentData);
    return response.data;
  } catch (error) {
    console.error('Confirm cash payment error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment details for a specific order
export const getOrderPaymentDetails = async (orderId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/payments/order/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Get order payment details error:', error.response?.data || error.message);
    throw error;
  }
};

// Generate payment report for export
export const generatePaymentReport = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/rms/payments/reports/export?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Generate payment report error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment summary for dashboard
export const getPaymentSummary = async () => {
  try {
    const api = getAuthInstance();
    const response = await api.get('/rms/payments/summary/daily');
    return response.data;
  } catch (error) {
    console.error('Get payment summary error:', error.response?.data || error.message);
    throw error;
  }
};

// Search payments by transaction ID or order number
export const searchPayments = async (searchTerm) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/payments/search?q=${encodeURIComponent(searchTerm)}`);
    return response.data;
  } catch (error) {
    console.error('Search payments error:', error.response?.data || error.message);
    throw error;
  }
};

// Get daily payment summary
export const getDailyPaymentSummary = async (date = null) => {
  try {
    const api = getAuthInstance();
    const dateParam = date ? `?date=${date}` : '';
    const response = await api.get(`/rms/payments/summary/daily${dateParam}`);
    return response.data;
  } catch (error) {
    console.error('Get daily payment summary error:', error.response?.data || error.message);
    throw error;
  }
};

// Mark payment as verified (for staff verification)
export const verifyPayment = async (paymentId, verificationData) => {
  try {
    const api = getAuthInstance();
    const response = await api.post(`/rms/payments/${paymentId}/verify`, verificationData);
    return response.data;
  } catch (error) {
    console.error('Verify payment error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment details by payment ID
export const getPaymentDetails = async (paymentId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    console.error('Get payment details error:', error.response?.data || error.message);
    throw error;
  }
};

// Export payment data as CSV
export const exportPaymentData = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams({ ...filters, format: 'csv' }).toString();
    const response = await api.get(`/rms/payments/reports/export?${queryParams}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payments-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'Payment data exported successfully' };
  } catch (error) {
    console.error('Export payment data error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment method statistics
export const getPaymentMethodStats = async (period = 'month') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/payments/analytics?period=${period}`);
    return response.data.paymentMethodStats || [];
  } catch (error) {
    console.error('Get payment method stats error:', error.response?.data || error.message);
    throw error;
  }
};

// Process refund for a payment
export const processRefund = async (paymentId, refundData) => {
  try {
    const api = getAuthInstance();
    console.log(`Processing refund for payment ${paymentId}:`, refundData);
    const response = await api.post(`/rms/payments/${paymentId}/refund`, refundData);
    return response.data;
  } catch (error) {
    console.error('Process refund error:', error.response?.data || error.message);
    throw error;
  }
};

// Get refund history
export const getRefundHistory = async (filters = {}) => {
  try {
    const api = getAuthInstance();
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/rms/payments/refunds?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Get refund history error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment trends for charts
export const getPaymentTrends = async (period = 'week') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/payments/analytics?period=${period}`);
    return response.data.dailyRevenue || [];
  } catch (error) {
    console.error('Get payment trends error:', error.response?.data || error.message);
    throw error;
  }
};

// Reconcile payments with gateway
export const reconcilePayments = async (date, gateway) => {
  try {
    const api = getAuthInstance();
    const response = await api.post('/rms/payments/reconcile', { date, gateway });
    return response.data;
  } catch (error) {
    console.error('Reconcile payments error:', error.response?.data || error.message);
    throw error;
  }
};

// Get payment notifications/alerts
export const getPaymentAlerts = async () => {
  try {
    const api = getAuthInstance();
    const response = await api.get('/rms/payments/alerts');
    return response.data;
  } catch (error) {
    console.error('Get payment alerts error:', error.response?.data || error.message);
    throw error;
  }
};

// Mark payment alert as read
export const markPaymentAlertAsRead = async (alertId) => {
  try {
    const api = getAuthInstance();
    const response = await api.put(`/rms/payments/alerts/${alertId}/read`);
    return response.data;
  } catch (error) {
    console.error('Mark payment alert as read error:', error.response?.data || error.message);
    throw error;
  }
};

// Bulk update payment statuses
export const bulkUpdatePaymentStatus = async (paymentIds, status, notes) => {
  try {
    const api = getAuthInstance();
    const response = await api.put('/rms/payments/bulk-update', {
      paymentIds,
      status,
      notes
    });
    return response.data;
  } catch (error) {
    console.error('Bulk update payment status error:', error.response?.data || error.message);
    throw error;
  }
};

// Generate payment invoice
export const generatePaymentInvoice = async (paymentId) => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/payments/${paymentId}/invoice`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-${paymentId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'Invoice generated successfully' };
  } catch (error) {
    console.error('Generate payment invoice error:', error.response?.data || error.message);
    throw error;
  }
};

// Resend payment receipt to customer
export const resendPaymentReceipt = async (paymentId, email) => {
  try {
    const api = getAuthInstance();
    const response = await api.post(`/rms/payments/${paymentId}/resend-receipt`, { email });
    return response.data;
  } catch (error) {
    console.error('Resend payment receipt error:', error.response?.data || error.message);
    throw error;
  }
};

// Update actual Payment record status (different from order payment status)
export const updatePaymentRecordStatus = async (paymentId, statusData) => {
  try {
    const api = getAuthInstance();
    console.log(`Updating payment record ${paymentId} status:`, statusData);
    const response = await api.put(`/rms/payments/${paymentId}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error('Update payment record status error:', error.response?.data || error.message);
    throw error;
  }
};
export const getSalesAnalytics = async (period = 'week') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/analytics/sales?period=${period}`);
    return response.data;
  } catch (error) {
    console.error('Get sales analytics error:', error.response?.data || error.message);
    throw error;
  }
};

export const getOrderAnalytics = async (period = 'week') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/analytics/orders?period=${period}`);
    return response.data;
  } catch (error) {
    console.error('Get order analytics error:', error.response?.data || error.message);
    throw error;
  }
};

export const getPopularItems = async (period = 'month') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/analytics/popular-items?period=${period}`);
    return response.data;
  } catch (error) {
    console.error('Get popular items error:', error.response?.data || error.message);
    throw error;
  }
};

export const getRevenueAnalytics = async (period = 'week') => {
  try {
    const api = getAuthInstance();
    const response = await api.get(`/rms/analytics/revenue?period=${period}`);
    return response.data;
  } catch (error) {
    console.error('Get revenue analytics error:', error.response?.data || error.message);
    throw error;
  }
};

