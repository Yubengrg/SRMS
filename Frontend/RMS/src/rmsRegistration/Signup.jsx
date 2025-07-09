// src/Signup.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

const Signup = () => {
  // State variables to store form data and messages
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmpassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Initialize Google Sign-In
  useEffect(() => {
    // Load the Google API script
    const loadGoogleScript = () => {
      // Check if script already exists
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]'))
        return;
        
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      
      script.onload = initializeGoogleSignIn;
    };

    // Initialize Google Sign-In button
    const initializeGoogleSignIn = () => {
      if (!window.google) return;
      
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '578308630486-drj0mtm99qhbu050mf1d5iedrbnletfn.apps.googleusercontent.com',
        callback: handleGoogleSignIn,
        auto_select: false,
      });
      
      // Use different theme parameters for better visibility
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { 
          type: 'standard',       // Use standard button type
          theme: 'outline',       // Use outline theme for better visibility
          size: 'large',          // Large size button
          text: 'signup_with',    // "Sign up with Google" text
          shape: 'rectangular',   // Rectangular shape
          width: document.getElementById('google-signin-button').offsetWidth || 300,
          logo_alignment: 'left'  // Logo on the left
        }
      );
    };

    loadGoogleScript();
    
    // Cleanup
    return () => {
      // Cleanup Google sign-in if needed
      if (window.google && window.google.accounts) {
        window.google.accounts.id.cancel();
      }
    };
  }, []);

  // Handle Google Sign-In response
  const handleGoogleSignIn = async (response) => {
    try {
      setIsLoading(true);
      
      // Send the ID token to your backend
      const backendResponse = await axios.post(
        'http://localhost:5001/api/auth/google-auth',
        { token: response.credential }
      );
      
      setMessage(backendResponse.data.message);
      
      // Store the JWT token
      if (backendResponse.data.token) {
        localStorage.setItem('token', backendResponse.data.token);
        
        // Google-authenticated users are already verified
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Google authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle regular form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Make a POST request to the backend
      const response = await axios.post('http://localhost:5001/api/auth/register', {
        name,
        email,
        password,
        confirmpassword,
      });

      // If registration is successful, show the response message
      setMessage(response.data.message);
      
      // Redirect to verification page with email
      setTimeout(() => {
        navigate('/verify', { state: { email } });
      }, 1500);
    } catch (error) {
      // If an error occurs, show the error message
      setMessage(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      {/* Left side with welcome message */}
      <div className="welcome-side">
        <div className="welcome-content">
          <h1 className="welcome-title">Welcome to SRMS</h1>
          <p className="welcome-subtitle">Your gateway to excellence</p>
        </div>
        <div className="footer-links">
          <a href="/terms">Terms of use</a>
          <a href="/privacy">Privacy Policy</a>
        </div>
        {/* X Button has been removed */}
      </div>
      
      {/* Right side with form */}
      <div className="form-side">
        <div className="signup-card">
          <div className="card-header">
            <h2>Sign Up</h2>
          </div>
          
          {/* Google Sign-In button */}
          <div className="google-signin-wrapper">
            <div id="google-signin-button"></div>
          </div>
          
          <div className="divider">
            <div className="divider-line"></div>
            <span>OR</span>
            <div className="divider-line"></div>
          </div>
          
          {/* Form for user registration */}
          <form onSubmit={handleSubmit} className="signup-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmpassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="signup-button" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </form>

          {/* Display success or error message */}
          {message && <p className={message.includes('failed') ? 'error-message' : 'success-message'}>{message}</p>}
          
          <div className="login-link">
            Already have an account? <a href="/login">Login</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;