// src/rmsStaff/StaffManagement.jsx - Complete Staff Management Component
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getRestaurantStaff, 
  searchUsers, 
  addStaffMember, 
  updateStaffMember, 
  removeStaffMember 
} from '../services/api';
import './StaffManagement.css';

const StaffManagement = ({ inDashboard = false }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Search and add states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form data for adding/editing staff
  const [formData, setFormData] = useState({
    role: 'waiter',
    permissions: []
  });
  
  const navigate = useNavigate();
  
  // Role definitions with default permissions
  const roleDefinitions = {
    manager: {
      label: 'Manager',
      description: 'Senior staff with broad permissions',
      defaultPermissions: ['manage_menu', 'manage_tables', 'take_orders', 'view_orders', 'view_reports'],
      color: '#805AD5'
    },
    waiter: {
      label: 'Waiter',
      description: 'Customer service and order taking',
      defaultPermissions: ['take_orders', 'view_orders', 'manage_tables'],
      color: '#4299E1'
    },
    chef: {
      label: 'Chef',
      description: 'Kitchen operations and menu management',
      defaultPermissions: ['view_orders', 'manage_menu', 'manage_inventory'],
      color: '#ED8936'
    },
    cashier: {
      label: 'Cashier',
      description: 'Payment processing and order completion',
      defaultPermissions: ['view_orders', 'manage_payments'],
      color: '#38A169'
    }
  };
  
  // All available permissions
  const allPermissions = [
    { id: 'manage_menu', label: 'Manage Menu', description: 'Add, edit, and delete menu items' },
    { id: 'manage_tables', label: 'Manage Tables', description: 'Control table status and reservations' },
    { id: 'take_orders', label: 'Take Orders', description: 'Create and manage customer orders' },
    { id: 'view_orders', label: 'View Orders', description: 'View order status and details' },
    { id: 'manage_payments', label: 'Manage Payments', description: 'Process payments and refunds' },
    { id: 'view_reports', label: 'View Reports', description: 'Access analytics and reports' },
    { id: 'manage_inventory', label: 'Manage Inventory', description: 'Control inventory and stock levels' }
  ];

  useEffect(() => {
    fetchStaff();
  }, []);

  // Control body overflow when modal is open
  useEffect(() => {
    const isModalOpen = showAddModal || showEditModal;
    
    if (isModalOpen) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showAddModal, showEditModal]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getRestaurantStaff();
      
      if (response && response.success) {
        setStaff(response.staff || []);
      } else {
        setError(response?.message || 'Failed to fetch staff');
      }
    } catch (err) {
      console.error('Fetch staff error:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError('Error loading staff. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (term) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearching(true);
      const response = await searchUsers(term);
      
      if (response && response.success) {
        // Filter out users who are already staff
        const existingStaffIds = staff.map(s => s.user._id);
        const filteredResults = (response.users || []).filter(user => 
          !existingStaffIds.includes(user._id)
        );
        setSearchResults(filteredResults);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, staff]);

  const handleRoleChange = (role) => {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: roleDefinitions[role].defaultPermissions
    }));
    // Clear error when role is selected
    setError(null);
  };

  const handlePermissionToggle = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    
    console.log('Form submission - Selected User:', selectedUser);
    console.log('Form submission - Form Data:', formData);
    
    if (!selectedUser) {
      setError('Please search for and select a user to add as staff');
      return;
    }
    
    if (!formData.role) {
      setError('Please select a role for the staff member');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const staffData = {
        userId: selectedUser._id,
        role: formData.role,
        permissions: formData.permissions
      };
      
      console.log('Sending staff data to API:', staffData);
      
      const response = await addStaffMember(staffData);
      
      console.log('API Response:', response);
      
      if (response && response.success) {
        await fetchStaff(); // Refresh staff list
        setShowAddModal(false);
        resetForm();
      } else {
        setError(response?.message || 'Failed to add staff member');
      }
    } catch (err) {
      console.error('Add staff error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Error adding staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = async (e) => {
    e.preventDefault();
    
    if (!selectedStaff) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const updateData = {
        role: formData.role,
        permissions: formData.permissions
      };
      
      const response = await updateStaffMember(selectedStaff._id, updateData);
      
      if (response && response.success) {
        await fetchStaff(); // Refresh staff list
        setShowEditModal(false);
        setSelectedStaff(null);
        resetForm();
      } else {
        setError(response?.message || 'Failed to update staff member');
      }
    } catch (err) {
      console.error('Update staff error:', err);
      setError(err.response?.data?.message || 'Error updating staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStaff = async (staffId, staffName) => {
    if (!window.confirm(`Are you sure you want to remove ${staffName} from your staff?`)) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await removeStaffMember(staffId);
      
      if (response && response.success) {
        await fetchStaff(); // Refresh staff list
      } else {
        setError(response?.message || 'Failed to remove staff member');
      }
    } catch (err) {
      console.error('Remove staff error:', err);
      setError(err.response?.data?.message || 'Error removing staff member');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setFormData({
      role: staffMember.role,
      permissions: staffMember.permissions || []
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      role: 'waiter',
      permissions: roleDefinitions.waiter.defaultPermissions
    });
    setSelectedUser(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const getStaffStatusBadge = (staffMember) => {
    return (
      <span 
        className={`staff-status-badge ${staffMember.isActive ? 'active' : 'inactive'}`}
        style={{ backgroundColor: staffMember.isActive ? '#38A169' : '#E53E3E' }}
      >
        {staffMember.isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const roleInfo = roleDefinitions[role];
    return (
      <span 
        className="role-badge" 
        style={{ backgroundColor: `${roleInfo.color}20`, color: roleInfo.color }}
      >
        {roleInfo.label}
      </span>
    );
  };

  return (
    <div className={`staff-management-container ${inDashboard ? 'in-dashboard' : ''}`}>
      {!inDashboard && (
        <header className="staff-header">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </button>
            <h1>Staff Management</h1>
          </div>
          <button className="add-staff-button" onClick={openAddModal}>
            + Add Staff Member
          </button>
        </header>
      )}

      <div className={inDashboard ? "dashboard-staff-content" : "staff-content"}>
        {inDashboard && (
          <div className="dashboard-staff-header">
            <button className="add-staff-button" onClick={openAddModal}>
              + Add Staff Member
            </button>
          </div>
        )}

        {error && !showAddModal && !showEditModal && (
          <div className="error-message">{error}</div>
        )}

        {loading && !showAddModal && !showEditModal ? (
          <div className="loading">Loading staff...</div>
        ) : (
          <>
            {staff.length > 0 ? (
              <div className="staff-grid">
                {staff.map(staffMember => (
                  <div key={staffMember._id} className="staff-card">
                    <div className="staff-card-header">
                      <div className="staff-avatar">
                        <img 
                          src={staffMember.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(staffMember.user.name)}&background=random`} 
                          alt={staffMember.user.name}
                        />
                      </div>
                      <div className="staff-info">
                        <h3>{staffMember.user.name}</h3>
                        <p>{staffMember.user.email}</p>
                        {staffMember.user.phoneNumber && (
                          <p className="phone">{staffMember.user.phoneNumber}</p>
                        )}
                      </div>
                      {getStaffStatusBadge(staffMember)}
                    </div>

                    <div className="staff-card-body">
                      <div className="role-section">
                        {getRoleBadge(staffMember.role)}
                        <p className="role-description">
                          {roleDefinitions[staffMember.role]?.description}
                        </p>
                      </div>

                      <div className="permissions-section">
                        <h4>Permissions</h4>
                        <div className="permissions-list">
                          {(staffMember.permissions || []).map(permission => {
                            const permInfo = allPermissions.find(p => p.id === permission);
                            return permInfo ? (
                              <span key={permission} className="permission-tag">
                                {permInfo.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>

                      <div className="staff-meta">
                        <p>Added: {new Date(staffMember.createdAt).toLocaleDateString()}</p>
                        <p>Last Updated: {new Date(staffMember.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="staff-card-actions">
                      <button 
                        className="edit-staff-button"
                        onClick={() => openEditModal(staffMember)}
                      >
                        <i className="fas fa-edit"></i> Edit
                      </button>
                      <button 
                        className="remove-staff-button"
                        onClick={() => handleRemoveStaff(staffMember._id, staffMember.user.name)}
                      >
                        <i className="fas fa-trash"></i> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No Staff Members</h3>
                <p>You haven't added any staff members yet.</p>
                <button className="add-first-button" onClick={openAddModal}>
                  Add Your First Staff Member
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>Add Staff Member</h2>
              <button 
                className="close-button" 
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddStaff}>
              <div className="modal-body">
                {/* User Search Section - Always Visible */}
                <div className="form-section">
                  <h3>Search User</h3>
                  <div className="search-container">
                    <div className="search-input-group">
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                      />
                      {searching && <div className="search-loading">Searching...</div>}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="search-results">
                        {searchResults.map(user => (
                          <div 
                            key={user._id} 
                            className={`search-result-item ${selectedUser?._id === user._id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedUser(user);
                              setError(null); // Clear error when user is selected
                            }}
                          >
                            <img 
                              src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                              alt={user.name}
                              className="result-avatar"
                            />
                            <div className="result-info">
                              <strong>{user.name}</strong>
                              <p>{user.email}</p>
                              {user.phoneNumber && <p className="phone">{user.phoneNumber}</p>}
                            </div>
                            {selectedUser?._id === user._id && (
                              <i className="fas fa-check-circle selected-icon"></i>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {searchTerm && !searching && searchResults.length === 0 && (
                      <div className="no-results">
                        No users found matching "{searchTerm}"
                      </div>
                    )}
                    
                    {!searchTerm && (
                      <div className="search-hint">
                        <p style={{ color: 'var(--text-color-light)', fontSize: '14px', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                          Start typing to search for users by name or email
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedUser && (
                  <>
                    {/* Selected User Preview */}
                    <div className="form-section">
                      <h3>Selected User</h3>
                      <div className="selected-user-preview">
                        <img 
                          src={selectedUser.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=random`} 
                          alt={selectedUser.name}
                        />
                        <div>
                          <strong>{selectedUser.name}</strong>
                          <p>{selectedUser.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Role Selection */}
                    <div className="form-section">
                      <h3>Select Role</h3>
                      <div className="role-selection">
                        {Object.entries(roleDefinitions).map(([roleId, roleInfo]) => (
                          <div 
                            key={roleId}
                            className={`role-option ${formData.role === roleId ? 'selected' : ''}`}
                            onClick={() => handleRoleChange(roleId)}
                          >
                            <div className="role-header">
                              <span 
                                className="role-color" 
                                style={{ backgroundColor: roleInfo.color }}
                              ></span>
                              <strong>{roleInfo.label}</strong>
                            </div>
                            <p>{roleInfo.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="form-section">
                      <h3>Permissions</h3>
                      <div className="permissions-grid">
                        {allPermissions.map(permission => (
                          <label key={permission.id} className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
                              onChange={() => handlePermissionToggle(permission.id)}
                            />
                            <div className="permission-info">
                              <strong>{permission.label}</strong>
                              <p>{permission.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button" 
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="save-button" 
                  disabled={!selectedUser || loading}
                >
                  {loading ? 'Adding...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Staff Member</h2>
              <button 
                className="close-button" 
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStaff(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditStaff}>
              <div className="modal-body">
                {/* Staff Info */}
                <div className="form-section">
                  <h3>Staff Member</h3>
                  <div className="selected-user-preview">
                    <img 
                      src={selectedStaff.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.user.name)}&background=random`} 
                      alt={selectedStaff.user.name}
                    />
                    <div>
                      <strong>{selectedStaff.user.name}</strong>
                      <p>{selectedStaff.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="form-section">
                  <h3>Role</h3>
                  <div className="role-selection">
                    {Object.entries(roleDefinitions).map(([roleId, roleInfo]) => (
                      <div 
                        key={roleId}
                        className={`role-option ${formData.role === roleId ? 'selected' : ''}`}
                        onClick={() => handleRoleChange(roleId)}
                      >
                        <div className="role-header">
                          <span 
                            className="role-color" 
                            style={{ backgroundColor: roleInfo.color }}
                          ></span>
                          <strong>{roleInfo.label}</strong>
                        </div>
                        <p>{roleInfo.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permissions */}
                <div className="form-section">
                  <h3>Permissions</h3>
                  <div className="permissions-grid">
                    {allPermissions.map(permission => (
                      <label key={permission.id} className="permission-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission.id)}
                          onChange={() => handlePermissionToggle(permission.id)}
                        />
                        <div className="permission-info">
                          <strong>{permission.label}</strong>
                          <p>{permission.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="save-button" 
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;