// src/admin/services/adminApi.js
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

// Configure axios with interceptors for authentication
const adminApi = axios.create({
  baseURL: API_URL
});

// Request interceptor to add auth token to all requests
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle authentication errors
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // If unauthorized or forbidden, redirect to login
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Admin authentication
export const adminLogin = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, credentials);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get restaurant verifications
export const getRestaurantVerifications = async (page = 1, status = 'pending', limit = 10) => {
  try {
    const response = await adminApi.get(`/admin/verifications`, {
      params: { page, status, limit }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get restaurant verification details
export const getVerificationDetails = async (id) => {
  try {
    const response = await adminApi.get(`/admin/verifications/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Approve restaurant verification
export const approveVerification = async (id) => {
  try {
    const response = await adminApi.put(`/admin/verifications/${id}/approve`, {});
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Reject restaurant verification
export const rejectVerification = async (id, reason) => {
  try {
    const response = await adminApi.put(`/admin/verifications/${id}/reject`, { reason });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get admin profile
export const getAdminProfile = async () => {
  try {
    const response = await adminApi.get(`/user/profile`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default {
  adminLogin,
  getRestaurantVerifications,
  getVerificationDetails,
  approveVerification,
  rejectVerification,
  getAdminProfile
};