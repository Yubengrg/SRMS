import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import './VerifyOTP.css';

const VerifyOTP = () => {
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
    
    // Initialize references for OTP input boxes
    inputRefs.current = Array(6).fill().map((_, i) => inputRefs.current[i] || React.createRef());
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5001/api/auth/verify-otp', {
        email,
        otp
      });

      setMessage(response.data.message);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5001/api/auth/resend-otp', {
        email
      });
      
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    
    // Update the main OTP state
    const newOtp = otp.split('');
    newOtp[parseInt(e.target.dataset.index)] = value;
    setOtp(newOtp.join(''));
    
    // Move to next input if value is entered
    if (value && e.target.dataset.index < 5) {
      inputRefs.current[parseInt(e.target.dataset.index) + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    
    if (pastedData) {
      const otpArray = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
      setOtp(otpArray.join(''));
      
      // Focus appropriate input after paste
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex].focus();
    }
  };

  return (
    <div className="verify-container">
      <h2>Verify Your Account</h2>
      <p>Please enter the verification code sent to your email address.</p>
      
      <form onSubmit={handleSubmit}>
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
          <label>Verification Code</label>
          <div className="otp-input-container">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                className="otp-input-box"
                type="text"
                maxLength="1"
                value={otp[index] || ''}
                onChange={handleOtpChange}
                onKeyDown={(e) => handleKeyDown(e, index)}
                data-index={index}
                onPaste={index === 0 ? handlePaste : null}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            ))}
          </div>
        </div>
        
        <button type="submit" disabled={isLoading || otp.length !== 6} className="verify-btn">
          {isLoading ? 'Verifying...' : 'Verify Account'}
        </button>
      </form>

      <button 
        onClick={handleResendOTP} 
        disabled={isLoading} 
        className="resend-link"
      >
        Resend verification code
      </button>

      {message && (
        <div className={`message-container ${message.includes('success') ? 'success-message' : 'error-message'}`}>
          {message}
        </div>
      )}
      
      <a href="/login" className="back-link">Back to Login</a>
    </div>
  );
};

export default VerifyOTP;