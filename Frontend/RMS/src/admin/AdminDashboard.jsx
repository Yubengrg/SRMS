// src/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './AdminStyles.css';

const AdminDashboard = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get user from localStorage
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      setUser(JSON.parse(adminUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>SRMS Admin</h2>
        </div>
        <ul className="admin-menu">
          <li className="admin-menu-item active">
            <span className="admin-menu-icon">🏢</span>
            <span>Restaurant Verifications</span>
          </li>
          <li className="admin-menu-item">
            <span className="admin-menu-icon">👥</span>
            <span>Users</span>
          </li>
          <li className="admin-menu-item">
            <span className="admin-menu-icon">📊</span>
            <span>Statistics</span>
          </li>
          <li className="admin-menu-item">
            <span className="admin-menu-icon">⚙️</span>
            <span>Settings</span>
          </li>
        </ul>
      </aside>
      
      <main className="admin-content">
        <header className="admin-header">
          <h1>Admin Dashboard</h1>
          
          <div className="admin-user-info">
            {user && (
              <>
                <div className="admin-user-avatar">
                  {getInitials(user.name)}
                </div>
                <div className="admin-user-details">
                  <div className="admin-user-name">{user.name}</div>
                  <div className="admin-user-role">Administrator</div>
                </div>
              </>
            )}
            <button className="admin-logout" onClick={handleLogout}>
              Logout <span className="admin-logout-icon">→</span>
            </button>
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
};

export default AdminDashboard;