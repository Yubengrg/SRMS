// src/App.jsx - Updated with Staff Management
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Signup from './rmsRegistration/Signup';
import Login from './rmsLogin/Login';
import StaffLogin from './rmsStaff/StaffLogin'; // NEW IMPORT
import VerifyOTP from './otpVerifyPage/VerifyOTP';
import Dashboard from './rmsDashboard/Dashboard';
import AdminLogin from './admin/AdminLogin.jsx';
import AdminDashboard from './admin/AdminDashboard';
import RestaurantVerifications from './admin/RestaurantVerifications';
import VerificationDetails from './admin/VerificationDetails';
import RestaurantSelection from './rmsRestaurant/RestaurantSelection';
import StaffManagement from './rmsStaff/StaffManagement';
import TableManagement from './rmsTable/TableManagement';
import MenuManagement from './rmsMenu/MenuManagement';
import OrderDashboard from './rmsOrder/OrderDashboard';
import InventoryManagement from './rmsInventory/InventoryManagement';
import { refreshOrders } from './services/globalOrderState';

const App = () => {
  // Initialize orders system when the app starts
  useEffect(() => {
    const token = localStorage.getItem('token');
    const restaurantJson = localStorage.getItem('restaurant');
    
    // Only initialize if user is logged in and has a restaurant selected
    if (token && restaurantJson) {
      try {
        const restaurant = JSON.parse(restaurantJson);
        if (restaurant.id) {
          console.log('App: Initializing global order state');
          refreshOrders(); // This will initialize the system and fetch initial data
        }
      } catch (e) {
        console.error('Error parsing restaurant data:', e);
      }
    }
  }, []);

  // Simple auth check function for regular users
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null;
  };

  // Check if user is admin
  const isAdmin = () => {
    return localStorage.getItem('adminToken') !== null;
  };

  // Protected route component for regular users
  const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  // Protected route component for admin users
  const AdminRoute = ({ children }) => {
    if (!isAdmin()) {
      return <Navigate to="/admin/login" />;
    }
    return children;
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Regular user routes */}
          <Route path="/" element={<Navigate to="/signup" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/staff-login" element={<StaffLogin />} />
          <Route path="/verify" element={<VerifyOTP />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          {/* Restaurant management routes */}
          <Route path="/select-restaurant" element={
            <ProtectedRoute>
              <RestaurantSelection />
            </ProtectedRoute>
          } />
          
          <Route path="/staff-management" element={
            <ProtectedRoute>
              <StaffManagement />
            </ProtectedRoute>
          } />
          
          {/* Table Management Route */}
          <Route path="/table-management" element={
            <ProtectedRoute>
              <TableManagement />
            </ProtectedRoute>
          } />
          
          {/* Menu Management Route */}
          <Route path="/menu-management" element={
            <ProtectedRoute>
              <MenuManagement />
            </ProtectedRoute>
          } />
          
          {/* Order Management Route */}
          <Route path="/order-management" element={
            <ProtectedRoute>
              <OrderDashboard />
            </ProtectedRoute>
          } />

          {/* Inventory Management Route */}
          <Route path="/inventory-management" element={
            <ProtectedRoute>
              <InventoryManagement />
            </ProtectedRoute>
          } />
          
          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
          <Route path="/admin/verifications" element={
            <AdminRoute>
              <RestaurantVerifications />
            </AdminRoute>
          } />
          <Route path="/admin/verifications/:id" element={
            <AdminRoute>
              <VerificationDetails />
            </AdminRoute>
          } />
          
          {/* Catch-all route - redirect to login */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;