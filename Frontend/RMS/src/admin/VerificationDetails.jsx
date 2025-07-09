// src/admin/VerificationDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminDashboard from './AdminDashboard';
import './AdminStyles.css';

const VerificationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    fetchRestaurantDetails();
  }, [id]);

  const fetchRestaurantDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await axios.get(`http://localhost:5001/api/admin/verifications/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setRestaurant(response.data.restaurant);
    } catch (err) {
      console.error('Failed to fetch restaurant details:', err);
      setError(err.response?.data?.message || 'Failed to fetch restaurant details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (window.confirm('Are you sure you want to approve this restaurant?')) {
      setActionLoading(true);
      
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await axios.put(
          `http://localhost:5001/api/admin/verifications/${id}/approve`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        setRestaurant(response.data.restaurant);
        setActionSuccess('Restaurant has been approved successfully!');
        
        setTimeout(() => {
          setActionSuccess(null);
        }, 5000);
      } catch (err) {
        console.error('Failed to approve restaurant:', err);
        setError(err.response?.data?.message || 'Failed to approve restaurant');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    setActionLoading(true);
    
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await axios.put(
        `http://localhost:5001/api/admin/verifications/${id}/reject`,
        { reason: rejectionReason },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setRestaurant(response.data.restaurant);
      setShowRejectForm(false);
      setActionSuccess('Restaurant has been rejected successfully!');
      
      setTimeout(() => {
        setActionSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to reject restaurant:', err);
      setError(err.response?.data?.message || 'Failed to reject restaurant');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminDashboard>
      <div className="admin-card">
        <Link to="/admin/verifications" className="go-back-link">
          ← Back to Verification List
        </Link>
        
        <h2>Restaurant Verification Details</h2>
        
        {loading && <p>Loading restaurant details...</p>}
        
        {error && <div className="admin-error-message">{error}</div>}
        
        {actionSuccess && <div className="admin-success-message">{actionSuccess}</div>}
        
        {!loading && !error && restaurant && (
          <div className="verification-details">
            <div className="verification-detail-section">
              <h3>Restaurant Information</h3>
              <div className="detail-row">
                <div className="detail-label">Name:</div>
                <div className="detail-value">{restaurant.name}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Owner:</div>
                <div className="detail-value">{restaurant.ownerFullName}</div>
              </div>
              {restaurant.contactNumber && (
                <div className="detail-row">
                  <div className="detail-label">Contact:</div>
                  <div className="detail-value">{restaurant.contactNumber}</div>
                </div>
              )}
              {restaurant.email && (
                <div className="detail-row">
                  <div className="detail-label">Email:</div>
                  <div className="detail-value">{restaurant.email}</div>
                </div>
              )}
              <div className="detail-row">
                <div className="detail-label">Status:</div>
                <div className="detail-value">
                  <span className={`verification-status status-${restaurant.verificationStatus}`}>
                    {restaurant.verificationStatus}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Submitted:</div>
                <div className="detail-value">{formatDate(restaurant.createdAt)}</div>
              </div>
              
              {restaurant.verificationStatus === 'rejected' && restaurant.rejectionReason && (
                <div className="detail-row">
                  <div className="detail-label">Rejection Reason:</div>
                  <div className="detail-value">{restaurant.rejectionReason}</div>
                </div>
              )}
            </div>
            
            <div className="verification-detail-section">
              <h3>Address Information</h3>
              {restaurant.address && (
                <>
                  {restaurant.address.street && (
                    <div className="detail-row">
                      <div className="detail-label">Street:</div>
                      <div className="detail-value">{restaurant.address.street}</div>
                    </div>
                  )}
                  {restaurant.address.city && (
                    <div className="detail-row">
                      <div className="detail-label">City:</div>
                      <div className="detail-value">{restaurant.address.city}</div>
                    </div>
                  )}
                  {restaurant.address.state && (
                    <div className="detail-row">
                      <div className="detail-label">State:</div>
                      <div className="detail-value">{restaurant.address.state}</div>
                    </div>
                  )}
                  {restaurant.address.zipCode && (
                    <div className="detail-row">
                      <div className="detail-label">Zip Code:</div>
                      <div className="detail-value">{restaurant.address.zipCode}</div>
                    </div>
                  )}
                  {restaurant.address.country && (
                    <div className="detail-row">
                      <div className="detail-label">Country:</div>
                      <div className="detail-value">{restaurant.address.country}</div>
                    </div>
                  )}
                </>
              )}
              {(!restaurant.address || !Object.values(restaurant.address).some(val => val)) && (
                <p>No address information provided</p>
              )}
              
              <h3>PAN Certificate</h3>
              <div className="verification-certificate">
                <img 
                  src={`http://localhost:5001${restaurant.panCertificate}`} 
                  alt="PAN Certificate" 
                  className="certificate-image" 
                />
              </div>
            </div>
          </div>
        )}
        
        {!loading && !error && restaurant && restaurant.verificationStatus === 'pending' && (
          <div className="verification-actions-card">
            <button 
              className="admin-button approve-button" 
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Approve Restaurant'}
            </button>
            
            {!showRejectForm ? (
              <button 
                className="admin-button reject-button" 
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading}
              >
                Reject Restaurant
              </button>
            ) : (
              <form onSubmit={handleReject} className="reject-form">
                <h3>Rejection Reason</h3>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  required
                ></textarea>
                <div className="verification-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowRejectForm(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="admin-button reject-button"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </AdminDashboard>
  );
};

export default VerificationDetails;