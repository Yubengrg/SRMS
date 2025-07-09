// src/admin/RestaurantVerifications.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminDashboard from './AdminDashboard';
import './AdminStyles.css';

const RestaurantVerifications = () => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  useEffect(() => {
    fetchVerifications(1, activeFilter);
  }, [activeFilter]);

  const fetchVerifications = async (page, status) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await axios.get(`http://localhost:5001/api/admin/verifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          page,
          limit: 10,
          status
        }
      });

      setVerifications(response.data.restaurants || []);
      setPagination(response.data.pagination || {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
    } catch (err) {
      console.error('Failed to fetch verifications:', err);
      setError(err.response?.data?.message || 'Failed to fetch restaurant verification requests');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    fetchVerifications(newPage, activeFilter);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <AdminDashboard>
      <div className="admin-card">
        <div className="verification-list-header">
          <h2>Restaurant Verification Requests</h2>
          <div className="verification-filters">
            <button 
              className={`verification-filter ${activeFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveFilter('pending')}
            >
              Pending
            </button>
            <button 
              className={`verification-filter ${activeFilter === 'verified' ? 'active' : ''}`}
              onClick={() => setActiveFilter('verified')}
            >
              Verified
            </button>
            <button 
              className={`verification-filter ${activeFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveFilter('rejected')}
            >
              Rejected
            </button>
            <button 
              className={`verification-filter ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
          </div>
        </div>

        {loading && <p>Loading verification requests...</p>}
        
        {error && <div className="admin-error-message">{error}</div>}
        
        {!loading && !error && verifications.length === 0 && (
          <div className="empty-list">
            <p>No {activeFilter !== 'all' ? activeFilter : ''} verification requests found.</p>
          </div>
        )}
        
        {!loading && !error && verifications.length > 0 && (
          <>
            <table className="verification-table">
              <thead>
                <tr>
                  <th>Restaurant Name</th>
                  <th>Owner Name</th>
                  <th>Submitted Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {verifications.map(restaurant => (
                  <tr key={restaurant._id}>
                    <td>{restaurant.name}</td>
                    <td>{restaurant.ownerFullName}</td>
                    <td>{formatDate(restaurant.createdAt)}</td>
                    <td>
                      <span className={`verification-status status-${restaurant.verificationStatus}`}>
                        {restaurant.verificationStatus}
                      </span>
                    </td>
                    <td>
                      <div className="verification-actions">
                        <Link to={`/admin/verifications/${restaurant._id}`} className="view-button">
                          View Details
                        </Link>
                        
                        {restaurant.verificationStatus === 'pending' && (
                          <>
                            <Link to={`/admin/verifications/${restaurant._id}`} className="approve-button">
                              Approve
                            </Link>
                            <Link to={`/admin/verifications/${restaurant._id}`} className="reject-button">
                              Reject
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="pagination">
              <button
                className="pagination-button"
                disabled={!pagination.hasPrevPage}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
              >
                Previous
              </button>
              
              <span className="pagination-info">
                Page {pagination.currentPage} of {pagination.totalPages}
                {pagination.total > 0 && ` (${pagination.total} total)`}
              </span>
              
              <button
                className="pagination-button"
                disabled={!pagination.hasNextPage}
                onClick={() => handlePageChange(pagination.currentPage + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </AdminDashboard>
  );
};

export default RestaurantVerifications;