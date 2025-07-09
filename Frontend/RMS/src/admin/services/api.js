// services/api.js
import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token to all requests
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// API service methods
const api = {
  // Authentication
  login: async (credentials) => {
    try {
      const response = await apiClient.post('/users/login', credentials);
      return response.data;
    } catch (error) {
      console.error('Login error:', error.response?.data || error);
      throw error;
    }
  },

  // RMS Authentication
  rmsLogin: async (credentials) => {
    try {
      const response = await apiClient.post('/rms/login', credentials);
      return response.data;
    } catch (error) {
      console.error('RMS login error:', error.response?.data || error);
      throw error;
    }
  },

  // Get dashboard overview
  getDashboardData: async () => {
    try {
      const response = await apiClient.get('/rms/dashboard');
      return response.data;
    } catch (error) {
      console.error('Dashboard data error:', error.response?.data || error);
      throw error;
    }
  },

  // Tables
  getTables: async () => {
    try {
      const response = await apiClient.get('/rms/tables');
      return response.data;
    } catch (error) {
      console.error('Get tables error:', error.response?.data || error);
      throw error;
    }
  },

  getTable: async (id) => {
    try {
      const response = await apiClient.get(`/rms/tables/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get table error:', error.response?.data || error);
      throw error;
    }
  },

  createTable: async (tableData) => {
    try {
      const response = await apiClient.post('/rms/tables', tableData);
      return response.data;
    } catch (error) {
      console.error('Create table error:', error.response?.data || error);
      throw error;
    }
  },

  updateTable: async (id, tableData) => {
    try {
      const response = await apiClient.put(`/rms/tables/${id}`, tableData);
      return response.data;
    } catch (error) {
      console.error('Update table error:', error.response?.data || error);
      throw error;
    }
  },

  deleteTable: async (id) => {
    try {
      const response = await apiClient.delete(`/rms/tables/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete table error:', error.response?.data || error);
      throw error;
    }
  },

  updateTableStatus: async (id, status) => {
    try {
      const response = await apiClient.patch(`/rms/tables/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Update table status error:', error.response?.data || error);
      throw error;
    }
  },

  // Menu Items
  getMenuItems: async () => {
    try {
      const response = await apiClient.get('/rms/menu-items');
      return response.data;
    } catch (error) {
      console.error('Get menu items error:', error.response?.data || error);
      throw error;
    }
  },

  createMenuItem: async (itemData) => {
    try {
      const response = await apiClient.post('/rms/menu-items', itemData);
      return response.data;
    } catch (error) {
      console.error('Create menu item error:', error.response?.data || error);
      throw error;
    }
  },

  updateMenuItem: async (id, itemData) => {
    try {
      const response = await apiClient.put(`/rms/menu-items/${id}`, itemData);
      return response.data;
    } catch (error) {
      console.error('Update menu item error:', error.response?.data || error);
      throw error;
    }
  },

  deleteMenuItem: async (id) => {
    try {
      const response = await apiClient.delete(`/rms/menu-items/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete menu item error:', error.response?.data || error);
      throw error;
    }
  }
};

export default api;