// src/admin/AdminLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminStyles.css';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For debugging, log values before sending to backend
      console.log('Attempting login with:', { email, password });
      
      const response = await axios.post('http://localhost:5001/api/auth/login', {
        email,
        password,
      });
      
      // For debugging, log the entire response
      console.log('Login response:', response.data);
      
      // Check if user is an admin
      if (response.data.user && response.data.user.role === 'admin') {
        // Store the admin token in localStorage
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.user));
        
        setMessage('Login successful. Redirecting to admin dashboard...');
        
        // Redirect to admin dashboard
        setTimeout(() => {
          navigate('/admin/verifications');
        }, 1500);
      } else {
        // For debugging, log the role if it exists
        console.log('User role:', response.data.user?.role);
        setMessage('Access denied. Admin privileges required.');
      }
    } catch (error) {
      console.error('Login error details:', error);
      
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      
      const errorMessage = error.response?.data?.message || 'Login failed';
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-logo">
          <h1>SRMS Admin</h1>
        </div>
        
        <h2>Admin Login</h2>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="admin-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        {message && (
          <div className={message.includes('successful') ? 'admin-success-message' : 'admin-error-message'}>
            {message}
          </div>
        )}
        
        <div className="back-to-main">
          <a href="/login">Back to Restaurant Login</a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;