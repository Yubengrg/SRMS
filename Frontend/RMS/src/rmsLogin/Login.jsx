import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  
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
      console.log("Attempting login...");
      const response = await login(formData);
      
      console.log("Raw login response:", response);
      
      // Clear any existing restaurant data
      localStorage.removeItem('restaurant');
      localStorage.removeItem('restaurants');
      
      // Check if login was successful
      if (response.success) {
        console.log("Login successful, storing token and user data");
        
        // Store token
        localStorage.setItem('token', response.token);
        
        // Store user info
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Check if restaurant selection is needed
        if (response.hasMultipleRestaurants) {
          console.log("User has multiple restaurants, storing list and redirecting to selection");
          
          // Store restaurants for selection screen
          if (response.restaurants && Array.isArray(response.restaurants)) {
            console.log("Storing restaurants:", response.restaurants);
            localStorage.setItem('restaurants', JSON.stringify(response.restaurants));
          } else {
            console.warn("No restaurants array in response despite hasMultipleRestaurants=true");
          }
          
          // Navigate to restaurant selection page
          navigate('/select-restaurant');
        } else {
          console.log("User has single restaurant, storing and redirecting to dashboard");
          
          // If there is a restaurant property in the response
          if (response.restaurant) {
            console.log("Storing single restaurant:", response.restaurant);
            localStorage.setItem('restaurant', JSON.stringify(response.restaurant));
            
            // Also store as restaurants array for consistency
            localStorage.setItem('restaurants', JSON.stringify([response.restaurant]));
            
            // Navigate directly to dashboard
            navigate('/dashboard');
          } else {
            console.warn("No restaurant property in response despite hasMultipleRestaurants=false");
            
            // Redirect to restaurant selection anyway, just to be safe
            navigate('/select-restaurant');
          }
        }
      } else {
        // Should not happen normally as the API would throw an error
        setError(response.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error("Login error:", err);
      let errorMessage = 'Login failed. Please try again.';
      
      console.log("Error response data:", err.response?.data);
      
      // Get more specific error message if available
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      // Special handling for restaurant verification errors
      if (err.response?.data?.pendingRestaurants || err.response?.data?.rejectedRestaurants) {
        const pendingCount = err.response.data.pendingRestaurants?.length || 0;
        const rejectedCount = err.response.data.rejectedRestaurants?.length || 0;
        
        if (pendingCount > 0) {
          errorMessage = 'Your restaurant is pending verification. Please check back later.';
        } else if (rejectedCount > 0) {
          errorMessage = 'Your restaurant verification was rejected. Please check your account for details.';
        }
        
        // Still save the pending/rejected restaurants to localStorage so they can be viewed
        const allRestaurants = [
          ...(err.response.data.pendingRestaurants || []),
          ...(err.response.data.rejectedRestaurants || [])
        ];
        
        if (allRestaurants.length > 0) {
          console.log("Storing pending/rejected restaurants:", allRestaurants);
          localStorage.setItem('restaurants', JSON.stringify(allRestaurants));
          
          // Store token for restaurant selection page
          if (err.response.data.token) {
            localStorage.setItem('token', err.response.data.token);
          }
          
          // Store user data
          if (err.response.data.user) {
            localStorage.setItem('user', JSON.stringify(err.response.data.user));
          }
          
          // Navigate to selection page to show pending/rejected status
          navigate('/select-restaurant');
          return;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left side with welcome message */}
      <div className="login-side">
        <div className="welcome-content">
          <h1 className="welcome-title">WELCOME TO SRMS</h1>
          <p className="welcome-subtitle">Your gateway to excellence</p>
        </div>
        <div className="footer-links">
          <a href="/terms">Terms of use</a>
          <a href="/privacy">Privacy Policy</a>
        </div>
      </div>
      
      {/* Right side with form */}
      <div className="login-card-container">
        <div className="login-card">
          <h2>Sign In</h2>
          
          <form onSubmit={handleSubmit} className="login-form">
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
            
            <button 
              type="submit" 
              className="login-button" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            
            <div className="form-footer">
              <p>Don't have an account? <a href="/signup">Sign up</a></p>
              <p><a href="/forgot-password">Forgot password?</a></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;