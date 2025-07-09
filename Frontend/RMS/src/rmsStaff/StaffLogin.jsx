// src/rmsStaff/StaffLogin.jsx - Staff Login Component
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffLogin } from '../services/api';
import './StaffLogin.css';

const StaffLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    restaurantId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
      return;
    }

    // Get available restaurants from localStorage if any
    const restaurantsStr = localStorage.getItem('restaurants');
    if (restaurantsStr) {
      try {
        const restaurantList = JSON.parse(restaurantsStr);
        if (Array.isArray(restaurantList)) {
          setRestaurants(restaurantList);
        }
      } catch (e) {
        console.error('Error parsing restaurants:', e);
      }
    }
  }, [navigate]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      console.log("Attempting staff login...");
      const response = await staffLogin(formData);
      
      console.log("Staff login response:", response);
      
      if (response.success) {
        console.log("Staff login successful");
        
        // Store token and user data
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Store selected restaurant
        if (response.restaurant) {
          localStorage.setItem('restaurant', JSON.stringify(response.restaurant));
        }
        
        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        setError(response.message || 'Staff login failed. Please try again.');
      }
    } catch (err) {
      console.error("Staff login error:", err);
      let errorMessage = 'Staff login failed. Please try again.';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-login-container">
      {/* Left side with welcome message */}
      <div className="staff-login-side">
        <div className="welcome-content">
          <h1 className="welcome-title">STAFF LOGIN</h1>
          <p className="welcome-subtitle">Access your restaurant dashboard</p>
        </div>
        <div className="footer-links">
          <a href="/login">Owner Login</a>
          <a href="/terms">Terms of use</a>
        </div>
      </div>
      
      {/* Right side with form */}
      <div className="staff-login-card-container">
        <div className="staff-login-card">
          <h2>Staff Sign In</h2>
          
          <form onSubmit={handleSubmit} className="staff-login-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            {restaurants.length > 0 && (
              <div className="form-group">
                <label htmlFor="restaurantId">Restaurant</label>
                <select
                  id="restaurantId"
                  name="restaurantId"
                  value={formData.restaurantId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Restaurant</option>
                  {restaurants.map(restaurant => (
                    <option key={restaurant._id || restaurant.id} value={restaurant._id || restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button 
              type="submit" 
              className="staff-login-button" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In as Staff'}
            </button>
            
            <div className="form-footer">
              <p>Not a staff member? <a href="/login">Owner Login</a></p>
              <p><a href="/forgot-password">Forgot password?</a></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;