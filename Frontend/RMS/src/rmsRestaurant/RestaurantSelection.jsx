import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectRestaurant } from '../services/api';
import axios from 'axios';
import './RestaurantSelection.css';

const RestaurantSelection = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Get restaurants from localStorage
    const storedRestaurants = localStorage.getItem('restaurants');
    console.log("Raw restaurants from localStorage:", storedRestaurants);
    
    if (storedRestaurants) {
      try {
        const parsedRestaurants = JSON.parse(storedRestaurants);
        console.log("Parsed restaurants:", parsedRestaurants);
        setRestaurants(parsedRestaurants);
        setLoading(false);
      } catch (err) {
        console.error('Error parsing stored restaurants:', err);
        setError('Error loading restaurants. Please try logging in again.');
        setLoading(false);
      }
    } else {
      console.warn("No restaurants found in localStorage");
      setError('No restaurants found. Please log in again.');
      setLoading(false);
    }
  }, []);

  const handleSelectRestaurant = async (restaurant) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedRestaurant(restaurant);
      
      console.log(`Selecting restaurant: ${restaurant.name} (${restaurant.id})`);
      
      // First, clear any existing restaurant selection
      localStorage.removeItem('restaurant');
      
      // Call the API to select this restaurant and get a new token with restaurantId
      const response = await selectRestaurant(restaurant.id);
      
      if (response.success) {
        console.log("Restaurant selection successful");
        
        // Make sure we have a token and it's properly stored
        if (!response.token) {
          throw new Error('No token received from restaurant selection');
        }
        
        // Store the token explicitly (redundant but safer)
        localStorage.setItem('token', response.token);
        
        // Make sure restaurant data is stored correctly
        localStorage.setItem('restaurant', JSON.stringify({
          id: restaurant.id,
          name: restaurant.name
        }));
        
        // Clear any redirect flags
        sessionStorage.removeItem('dashboardRedirectAttempted');
        
        // Add a small delay to ensure storage operations complete
        setTimeout(() => {
          console.log("Navigating to dashboard...");
          navigate('/dashboard');
        }, 500);
      } else {
        setError(response.message || 'Failed to select restaurant');
      }
    } catch (err) {
      console.error('Error selecting restaurant:', err);
      setError('Failed to select restaurant. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('restaurants');
    localStorage.removeItem('restaurant');
    navigate('/login');
  };
  
  return (
    <div className="restaurant-selection-container">
      <header className="header">
        <h1>Select Restaurant</h1>
        <button 
          className="logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>
      
      <div className="selection-content">
        <h2>Please select a restaurant to manage:</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {loading ? (
          <div className="loading">Loading restaurants...</div>
        ) : (
          <>
            {restaurants.length > 0 ? (
              <div className="restaurants-grid">
                {restaurants.map(restaurant => (
                  <div 
                    key={restaurant.id} 
                    className={`restaurant-card ${
                      restaurant.verificationStatus !== 'verified' ? 'restaurant-disabled' : ''
                    } ${selectedRestaurant?.id === restaurant.id ? 'restaurant-selected' : ''}`}
                  >
                    <div className="restaurant-header">
                      <h3>{restaurant.name}</h3>
                      <span className={`status-badge status-${restaurant.verificationStatus}`}>
                        {restaurant.verificationStatus}
                      </span>
                    </div>
                    
                    {restaurant.verificationStatus === 'verified' ? (
                      <button 
                        className="select-button"
                        onClick={() => handleSelectRestaurant(restaurant)}
                        disabled={loading || selectedRestaurant?.id === restaurant.id}
                      >
                        {loading && selectedRestaurant?.id === restaurant.id ? 
                          'Selecting...' : 
                          selectedRestaurant?.id === restaurant.id ? 
                            'Selected' : 'Select Restaurant'}
                      </button>
                    ) : (
                      <div className="verification-message">
                        {restaurant.verificationStatus === 'pending' ? 
                          'This restaurant is pending verification.' : 
                          `This restaurant was rejected: ${restaurant.rejectionReason || 'No reason provided'}`
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-restaurants">
                <p>No restaurants found. Please register and verify a restaurant.</p>
                <button 
                  className="register-button"
                  onClick={() => navigate('/register-restaurant')}
                >
                  Register Restaurant
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="debug-section">
        <details>
          <summary>Debug Information</summary>
          <div className="debug-content">
            <p>If you're experiencing issues:</p>
            <button 
              className="debug-button"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button 
              className="debug-button"
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                navigate('/login');
              }}
            >
              Clear Data & Logout
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};

export default RestaurantSelection;