// src/rmsDashboard/RecentOrders.jsx
import React, { useState, useEffect } from 'react';
import { getOrders } from '../services/api';
import moment from 'moment';

const RecentOrders = ({ onViewAllClick }) => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const fetchRecentOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch recent orders (limit to 5 for dashboard)
      const response = await getOrders({ 
        limit: 5, 
        page: 1,
        // Get orders from today and yesterday
        startDate: moment().subtract(1, 'day').startOf('day').toISOString(),
        endDate: moment().endOf('day').toISOString()
      });

      if (response && response.success) {
        setRecentOrders(response.orders || []);
      } else {
        setError('Failed to load recent orders');
      }
    } catch (err) {
      console.error('Error fetching recent orders:', err);
      setError('Error loading recent orders');
    } finally {
      setLoading(false);
    }
  };

  // Get status display with proper styling
  const getStatusDisplay = (status) => {
    const statusMap = {
      'pending': { class: 'order-status-new', text: 'New' },
      'in-progress': { class: 'order-status-in-progress', text: 'In Progress' },
      'ready': { class: 'order-status-completed', text: 'Ready' },
      'served': { class: 'order-status-payment', text: 'Served' },
      'completed': { class: 'order-status-completed', text: 'Completed' },
      'cancelled': { class: 'order-status-cancelled', text: 'Cancelled' }
    };

    const statusInfo = statusMap[status] || { class: 'order-status-new', text: status };
    return (
      <span className={`order-status ${statusInfo.class}`}>
        {statusInfo.text}
      </span>
    );
  };

  // Format time display
  const formatTime = (dateString) => {
    return moment(dateString).format('h:mm A');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Get table display
  const getTableDisplay = (order) => {
    if (order.table && order.table.tableNumber) {
      return `Table ${order.table.tableNumber}`;
    } else if (order.tableName) {
      return order.tableName;
    } else {
      return 'Takeaway';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="orders-table-card">
        <div className="card-header">
          <h3 style={{ color: '#1A1F36' }}>Recent Orders</h3>
          <button className="view-all-btn" onClick={onViewAllClick}>
            View All <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-color-light)' }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
          Loading recent orders...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="orders-table-card">
        <div className="card-header">
          <h3 style={{ color: '#1A1F36' }}>Recent Orders</h3>
          <button className="view-all-btn" onClick={onViewAllClick}>
            View All <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }}></i>
            {error}
          </p>
          <button 
            onClick={fetchRecentOrders}
            style={{
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <i className="fas fa-redo" style={{ marginRight: '0.5rem' }}></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-table-card">
      <div className="card-header">
        <h3 style={{ color: '#1A1F36' }}>Recent Orders</h3>
        <button className="view-all-btn" onClick={onViewAllClick}>
          View All <i className="fas fa-chevron-right"></i>
        </button>
      </div>
      
      <div className="orders-table-container">
        {recentOrders.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            color: 'var(--text-color-light)' 
          }}>
            <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block' }}></i>
            <p>No recent orders found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Orders from today and yesterday will appear here
            </p>
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>ORDER</th>
                <th>TABLE</th>
                <th>ITEMS</th>
                <th>TIME</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order._id}>
                  <td className="order-id" style={{ color: '#1A1F36' }}>
                    {order.orderNumber}
                  </td>
                  <td>
                    {getTableDisplay(order)}
                  </td>
                  <td>
                    {(order.items?.length || 0)} items
                  </td>
                  <td className="order-time">
                    {formatTime(order.createdAt)}
                  </td>
                  <td className="order-amount" style={{ color: '#1A1F36' }}>
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td>
                    {getStatusDisplay(order.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {recentOrders.length > 0 && (
        <div style={{ 
          padding: '1rem', 
          textAlign: 'center', 
          borderTop: '1px solid rgba(255, 255, 255, 0.05)' 
        }}>
          <button 
            className="view-all-btn"
            onClick={onViewAllClick}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--primary-color)', 
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            View All Orders <i className="fas fa-arrow-right" style={{ marginLeft: '0.5rem' }}></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentOrders;