// Dashboard.jsx - Updated with Analytics Integration and Staff Management
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardData } from '../services/api';
import TableManagement from '../rmsTable/TableManagement'; 
import MenuManagement from '../rmsMenu/MenuManagement'; 
import OrderDashboard from '../rmsOrder/OrderDashboard';
import InventoryManagement from '../rmsInventory/InventoryManagement';
import PaymentDashboard from '../rmsPayment/Paymentdashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import StaffManagement from '../rmsStaff/StaffManagement'; // NEW IMPORT
import RecentOrders from './RecentOrders';
import { refreshOrders } from '../services/globalOrderState';
import './Dashboard.css';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  
  // Get user and restaurant info from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
  
  // Check if user is a staff member
  const isStaff = user.role !== undefined;
  const staffRole = isStaff ? user.role : null;
  const permissions = isStaff ? (user.permissions || []) : ['all'];

  useEffect(() => {
    // Add a flag to prevent redirect loops
    const redirectAttempted = sessionStorage.getItem('dashboardRedirectAttempted');
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      console.log("No token found, redirecting to login");
      navigate('/login');
      return;
    }
    
    // Get and validate restaurant data
    const restaurantStr = localStorage.getItem('restaurant');
    let restaurant = null;
    
    if (restaurantStr) {
      try {
        restaurant = JSON.parse(restaurantStr);
        console.log("Found restaurant in localStorage:", restaurant);
      } catch (e) {
        console.error("Error parsing restaurant data:", e);
      }
    }
    
    // Check if restaurant is selected and has required properties
    if (!restaurant || !restaurant.id || !restaurant.name) {
      console.warn("No valid restaurant found in localStorage");
      
      // Only redirect if we haven't already tried to redirect
      // This prevents redirect loops
      if (!redirectAttempted) {
        console.log("Setting redirect attempt flag and navigating to selection");
        sessionStorage.setItem('dashboardRedirectAttempted', 'true');
        navigate('/select-restaurant');
        return;
      } else {
        console.warn("Redirect already attempted, staying on dashboard despite missing restaurant");
        // Clear the flag since we're staying on the dashboard
        sessionStorage.removeItem('dashboardRedirectAttempted');
        setError('Restaurant data is missing. Please try selecting a restaurant again.');
      }
    } else {
      // Clear the redirect attempt flag on successful load
      sessionStorage.removeItem('dashboardRedirectAttempted');
    }
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log("Fetching dashboard data with token:", token.substring(0, 10) + "...");
        console.log("Using restaurant:", restaurant);
        
        const response = await getDashboardData();
        
        if (response.success) {
          setDashboardData(response.data);
        } else {
          setError(response.message || 'Failed to load dashboard data');
        }
      } catch (err) {
        console.error('Dashboard error:', err);
        
        // Handle token expiration or authentication issues
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('restaurant');
          navigate('/login');
        } else if (err.response?.status === 403) {
          const errorMessage = err.response?.data?.message || '';
          console.error('Authorization error:', errorMessage);
          
          if (errorMessage.includes('No restaurant selected')) {
            // Don't redirect if we've already tried once
            if (!redirectAttempted) {
              localStorage.removeItem('restaurant');
              sessionStorage.setItem('dashboardRedirectAttempted', 'true');
              navigate('/select-restaurant');
              return;
            } else {
              setError('Unable to select restaurant. Please logout and try again.');
            }
          } else {
            setError('Error loading dashboard data: ' + errorMessage);
          }
        } else {
          setError('Error loading dashboard data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [navigate]);

  // Effect for tab changes
  useEffect(() => {
    if (activeTab === 'orders') {
      console.log('Dashboard: Orders tab activated, refreshing orders');
      refreshOrders();
    }
  }, [activeTab]);
  
  // Helper function to check if user has permission
  const hasPermission = (permission) => {
    if (!isStaff || permissions.includes('all') || permissions.includes(permission)) {
      return true;
    }
    // Special case: owners always have analytics access
    if (permission === 'view_analytics' && !isStaff) {
      return true;
    }
    return false;
  };
  
  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('restaurant');
    localStorage.removeItem('restaurants');
    navigate('/login');
  };
  
  // Get current date string
  const getCurrentDate = () => {
    const date = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Handle view all orders click
  const handleViewAllOrders = () => {
    setActiveTab('orders');
  };
  
  // Overview tab content
  const renderOverviewTab = () => {
    if (!dashboardData) return null;
    
    return (
      <div className="overview-container">
        {/* Stats cards row */}
        <div className="stats-grid">
          {/* Revenue Card */}
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon revenue-icon">
                <i className="fas fa-rupee-sign"></i>
              </div>
              <div className="stat-trend stat-trend-up">
                <span>+12.5%</span>
              </div>
            </div>
            <div className="stat-card-content">
              <p className="stat-label">Today's Revenue</p>
              <h3 className="stat-value" style={{ color: '#1A1F36' }}>{formatCurrency(dashboardData.revenue?.today || 0)}</h3>
              <p className="stat-trend-info">
                <i className="fas fa-arrow-up"></i> Increased from yesterday
              </p>
            </div>
          </div>
          
          {/* Orders Card */}
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon orders-icon">
                <i className="fas fa-shopping-bag"></i>
              </div>
              <div className="stat-trend stat-trend-up">
                <span>+8.2%</span>
              </div>
            </div>
            <div className="stat-card-content">
              <p className="stat-label">Today's Orders</p>
              <h3 className="stat-value" style={{ color: '#1A1F36' }}>{dashboardData.orders?.today || 0}</h3>
              <p className="stat-trend-info">
                <i className="fas fa-arrow-up"></i> Increased from yesterday
              </p>
            </div>
          </div>
          
          {/* Tables Card */}
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon tables-icon">
                <i className="fas fa-chair"></i>
              </div>
              <div className="stat-percentage">
                {Math.round((dashboardData.tables?.active / dashboardData.tables?.total) * 100)}%
              </div>
            </div>
            <div className="stat-card-content">
              <p className="stat-label">Active Tables</p>
              <h3 className="stat-value" style={{ color: '#1A1F36' }}>{dashboardData.tables?.active || 0} / {dashboardData.tables?.total || 0}</h3>
              <div className="table-progress">
                <div 
                  className="table-progress-bar" 
                  style={{ width: `${(dashboardData.tables?.active / dashboardData.tables?.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Inventory Card */}
          {dashboardData.inventory && (
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-icon inventory-icon">
                  <i className="fas fa-box"></i>
                </div>
                <button className="view-all-btn">
                  View All <i className="fas fa-chevron-right"></i>
                </button>
              </div>
              <div className="stat-card-content">
                <p className="stat-label">Inventory Alerts</p>
                <h3 className="stat-value" style={{ color: '#1A1F36' }}>{dashboardData.inventory.lowStockItems || 0} Items</h3>
                <p className="stat-alert-info">Low stock items requiring attention</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Dynamic Recent Orders Component */}
        <RecentOrders onViewAllClick={handleViewAllOrders} />
        
        {/* Two column layout for Popular Items and Sales Overview */}
        <div className="two-column-grid">
          {/* Popular Items */}
          <div className="popular-items-card">
            <div className="card-header">
              <h3 style={{ color: '#1A1F36' }}>Popular Items</h3>
              <button className="view-all-btn" onClick={() => setActiveTab('menu')}>
                View Menu <i className="fas fa-chevron-right"></i>
              </button>
            </div>
            
            <div className="popular-items-list">
              <div className="popular-item">
                <div className="popular-item-icon">
                  <i className="fas fa-utensils"></i>
                </div>
                <div className="popular-item-info">
                  <h4 style={{ color: '#1A1F36' }}>Butter Chicken</h4>
                  <p>152 orders this month</p>
                </div>
                <span className="popular-item-trend">+14%</span>
              </div>
              
              <div className="popular-item">
                <div className="popular-item-icon">
                  <i className="fas fa-utensils"></i>
                </div>
                <div className="popular-item-info">
                  <h4 style={{ color: '#1A1F36' }}>Paneer Tikka</h4>
                  <p>118 orders this month</p>
                </div>
                <span className="popular-item-trend">+8%</span>
              </div>
              
              <div className="popular-item">
                <div className="popular-item-icon">
                  <i className="fas fa-utensils"></i>
                </div>
                <div className="popular-item-info">
                  <h4 style={{ color: '#1A1F36' }}>Veg Biryani</h4>
                  <p>97 orders this month</p>
                </div>
                <span className="popular-item-trend">+12%</span>
              </div>
              
              <div className="popular-item">
                <div className="popular-item-icon">
                  <i className="fas fa-utensils"></i>
                </div>
                <div className="popular-item-info">
                  <h4 style={{ color: '#1A1F36' }}>Garlic Naan</h4>
                  <p>85 orders this month</p>
                </div>
                <span className="popular-item-trend">+5%</span>
              </div>
            </div>
          </div>
          
          {/* Sales Chart */}
          <div className="sales-chart-card">
            <div className="card-header">
              <h3 style={{ color: '#1A1F36' }}>Sales Overview</h3>
              <div className="chart-filter">
                <button className="chart-filter-btn chart-filter-active">Week</button>
                <button className="chart-filter-btn">Month</button>
                <button className="chart-filter-btn">Year</button>
              </div>
            </div>
            
            <div className="chart-container">
              <div className="placeholder-chart">
                <i className="fas fa-chart-bar"></i>
                <span>Sales chart will appear here</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="quick-actions">
          {hasPermission('take_orders') && (
            <button className="quick-action-btn primary-action" onClick={() => setActiveTab('orders')}>
              <i className="fas fa-plus-circle"></i>
              <span>New Order</span>
            </button>
          )}
          
          {hasPermission('manage_tables') && (
            <button className="quick-action-btn" onClick={() => setActiveTab('tables')}>
              <i className="fas fa-chair"></i>
              <span>Manage Tables</span>
            </button>
          )}
          
          {hasPermission('manage_menu') && (
            <button className="quick-action-btn" onClick={() => setActiveTab('menu')}>
              <i className="fas fa-utensils"></i>
              <span>Manage Menu</span>
            </button>
          )}
          
          {hasPermission('manage_payments') && (
            <button className="quick-action-btn" onClick={() => setActiveTab('payments')}>
              <i className="fas fa-credit-card"></i>
              <span>Manage Payments</span>
            </button>
          )}
          
          {hasPermission('manage_inventory') && (
            <button className="quick-action-btn" onClick={() => setActiveTab('inventory')}>
              <i className="fas fa-box"></i>
              <span>Manage Inventory</span>
            </button>
          )}
          
          {/* NEW ANALYTICS QUICK ACTION */}
          {hasPermission('view_analytics') && (
            <button className="quick-action-btn" onClick={() => setActiveTab('analytics')}>
              <i className="fas fa-chart-line"></i>
              <span>View Analytics</span>
            </button>
          )}
        </div>
      </div>
    );
  };
  
  // Get tab name for header display
  const getTabDisplayName = () => {
    switch(activeTab) {
      case 'overview': return 'Dashboard Overview';
      case 'orders': return 'Order Management';
      case 'tables': return 'Table Management';
      case 'menu': return 'Menu Management';
      case 'inventory': return 'Inventory Management';
      case 'payments': return 'Payment Management';
      case 'analytics': return 'Sales Analytics'; // NEW TAB DISPLAY NAME
      case 'staff': return 'Staff Management';
      default: return activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar - New vertical design */}
      <div className="sidebar">
        {/* Logo area with brand styling */}
        <div className="logo-container">
          <div className="app-logo">
            <i className="fas fa-fire"></i>
          </div>
          <div className="brand-name">
            <h1>Smart-RMS</h1>
          </div>
        </div>
        
        {/* Navigation menu with improved categories */}
        <nav className="nav-menu">
          <div className="nav-group">
            <div className="nav-group-label">OPERATIONS</div>
            
            <button 
              className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <i className="fas fa-th-large"></i>
              <span>Overview</span>
              {activeTab === 'overview' && <span className="active-indicator"></span>}
            </button>
            
            {hasPermission('view_orders') && (
              <button 
                className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                <i className="fas fa-shopping-cart"></i>
                <span>Orders</span>
                {activeTab === 'orders' && <span className="active-indicator"></span>}
              </button>
            )}
            
            {hasPermission('manage_tables') && (
              <button 
                className={`nav-item ${activeTab === 'tables' ? 'active' : ''}`}
                onClick={() => setActiveTab('tables')}
              >
                <i className="fas fa-users"></i>
                <span>Tables</span>
                {activeTab === 'tables' && <span className="active-indicator"></span>}
              </button>
            )}
            
            {hasPermission('manage_menu') && (
              <button 
                className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`}
                onClick={() => setActiveTab('menu')}
              >
                <i className="fas fa-utensils"></i>
                <span>Menu</span>
                {activeTab === 'menu' && <span className="active-indicator"></span>}
              </button>
            )}
          </div>
          
          <div className="nav-group">
            <div className="nav-group-label">MANAGEMENT</div>
            
            {hasPermission('manage_inventory') && (
              <button 
                className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setActiveTab('inventory')}
              >
                <i className="fas fa-box"></i>
                <span>Inventory</span>
                {activeTab === 'inventory' && <span className="active-indicator"></span>}
              </button>
            )}
            
            {hasPermission('manage_payments') && (
              <button 
                className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`}
                onClick={() => setActiveTab('payments')}
              >
                <i className="fas fa-credit-card"></i>
                <span>Payments</span>
                {activeTab === 'payments' && <span className="active-indicator"></span>}
              </button>
            )}
            
            {!isStaff && (
              <button 
                className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}
                onClick={() => setActiveTab('staff')}
              >
                <i className="fas fa-users"></i>
                <span>Staff</span>
                {activeTab === 'staff' && <span className="active-indicator"></span>}
              </button>
            )}
          </div>
          
          {/* NEW ANALYTICS SECTION */}
          <div className="nav-group">
            <div className="nav-group-label">INSIGHTS</div>
            
            {hasPermission('view_analytics') && (
              <button 
                className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <i className="fas fa-chart-line"></i>
                <span>Analytics</span>
                {activeTab === 'analytics' && <span className="active-indicator"></span>}
              </button>
            )}
          </div>
        </nav>
        
        {/* New Order Quick Action */}
        <div className="sidebar-action">
          {hasPermission('take_orders') && (
            <button 
              className="new-order-btn"
              onClick={() => setActiveTab('orders')}
            >
              <i className="fas fa-plus"></i>
              <span>New Order</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Main Content Wrapper */}
      <div className="main-wrapper">
        {/* Enhanced Header - Now with same background as main content */}
        <header className="dashboard-header" style={{ backgroundColor: 'var(--background-color)' }}>
          <div className="header-left">
            <h1 className="page-title" style={{ color: '#1A1F36' }}>{getTabDisplayName()}</h1>
            <div className="current-date">
              <i className="fas fa-clock"></i>
              <span>{getCurrentDate()}</span>
            </div>
          </div>
          
          <div className="header-right">
            <div className="search-bar">
              <i className="fas fa-search"></i>
              <input type="text" placeholder="Search..." />
            </div>
            
            <div className="notifications">
              <i className="fas fa-bell"></i>
              <span className="badge">3</span>
            </div>
            
            <div className="user-profile">
              <img 
                src={user.profilePicture || 'https://via.placeholder.com/40'} 
                alt="User Avatar" 
                className="avatar" 
              />
              <div className="user-details">
                <span className="user-name" style={{ color: '#1A1F36' }}>{user.name}</span>
                {isStaff && <span className="user-role">{staffRole}</span>}
              </div>
              <button className="logout-button" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="main-content">
          {/* Overview Tab */}
          <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
            {loading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading dashboard data...</p>
              </div>
            ) : error ? (
              <div className="error-message">
                <p><i className="fas fa-exclamation-circle"></i> {error}</p>
                <div className="error-actions">
                  <button className="retry-button" onClick={() => window.location.reload()}>
                    <i className="fas fa-redo"></i> Retry
                  </button>
                  <button className="select-restaurant-button" onClick={() => navigate('/select-restaurant')}>
                    <i className="fas fa-store"></i> Select Restaurant
                  </button>
                </div>
              </div>
            ) : (
              renderOverviewTab()
            )}
          </div>

          {/* Orders Tab - ALWAYS KEEP MOUNTED - NO CONDITIONAL RENDERING */}
          <div id="orders-tab-container" style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
            <OrderDashboard inDashboard={true} isActive={activeTab === 'orders'} />
          </div>
          
          {/* Menu Tab */}
          <div style={{ display: activeTab === 'menu' ? 'block' : 'none' }}>
            {hasPermission('manage_menu') && (
              <MenuManagement inDashboard={true} />
            )}
          </div>
          
          {/* Tables Tab */}
          <div style={{ display: activeTab === 'tables' ? 'block' : 'none' }}>
            {hasPermission('manage_tables') && (
              <TableManagement inDashboard={true} />
            )}
          </div>

          {/* Inventory Tab */}
          <div style={{ display: activeTab === 'inventory' ? 'block' : 'none' }}>
            {hasPermission('manage_inventory') && (
              <InventoryManagement inDashboard={true} />
            )}
          </div>
          
          {/* Payments Tab */}
          <div id="payments-tab-container" style={{ display: activeTab === 'payments' ? 'block' : 'none' }}>
            {hasPermission('manage_payments') && (
              <PaymentDashboard inDashboard={true} isActive={activeTab === 'payments'} />
            )}
          </div>
          
          {/* NEW ANALYTICS TAB */}
          <div id="analytics-tab-container" style={{ display: activeTab === 'analytics' ? 'block' : 'none' }}>
            {hasPermission('view_analytics') && (
              <AnalyticsDashboard inDashboard={true} />
            )}
          </div>
          
          {/* Staff Tab */}
          <div id="staff-tab-container" style={{ display: activeTab === 'staff' ? 'block' : 'none' }}>
            {!isStaff && <StaffManagement inDashboard={true} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;