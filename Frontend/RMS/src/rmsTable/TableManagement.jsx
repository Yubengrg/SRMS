import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getTables, 
  createTable, 
  updateTable,
  deleteTable, 
  changeTableStatus,
  regenerateQRCode
} from '../services/api';
import socketService from '../services/socketService';
import './TableManagement.css';
import { API_URL } from '../services/api';

const TableManagement = ({ inDashboard = false }) => {
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [statusChanging, setStatusChanging] = useState({});
  const [filters, setFilters] = useState({
    section: '',
    floor: '',
    status: '',
    isActive: ''
  });
  
  // Form state for add/edit table
  const [formData, setFormData] = useState({
    tableNumber: '',
    capacity: 4,
    section: 'Main',
    floor: 'Ground',
    isActive: true
  });
  
  const navigate = useNavigate();
  
  // Setup Socket.IO connection using the socket service
  useEffect(() => {
    // Connect socket if not already connected
    socketService.connect();
    
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    if (restaurant.id) {
      // Join restaurant room
      socketService.emit('joinRestaurant', restaurant.id);
      
      // Listen for table status updates
      const unsubscribe = socketService.on('tableStatusUpdate', (data) => {
        console.log('TableManagement: Table status update received via socket:', data);
        
        setTables(prevTables => 
          prevTables.map(table => 
            (table._id === data.tableId || table.id === data.tableId) 
              ? { ...table, status: data.status, currentCustomer: data.currentCustomer }
              : table
          )
        );
        
        // If QR modal is open and showing this table, update selected table
        if (selectedTable && (selectedTable._id === data.tableId || selectedTable.id === data.tableId)) {
          setSelectedTable(prev => ({ ...prev, status: data.status, currentCustomer: data.currentCustomer }));
        }
        
        // Clear the loading state for this table
        setStatusChanging(prev => ({
          ...prev,
          [data.tableId]: false
        }));
      });
      
      return () => {
        // Clean up listeners on unmount
        socketService.off('tableStatusUpdate');
      };
    }
  }, [selectedTable]);
  
  useEffect(() => {
    fetchTables();
  }, []);
  
  // Control body overflow when modal is open
  useEffect(() => {
    const isModalOpen = showAddModal || showEditModal || showQRModal;
    
    if (isModalOpen) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
      
      // Fix for dashboard container overflow
      const dashboardContainer = document.querySelector('.dashboard-container');
      if (dashboardContainer) {
        dashboardContainer.classList.add('modal-open');
      }
      
      // Fix for main content container overflow
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.overflow = 'visible';
      }
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      
      // Reset dashboard container overflow
      const dashboardContainer = document.querySelector('.dashboard-container');
      if (dashboardContainer) {
        dashboardContainer.classList.remove('modal-open');
      }
      
      // Reset main content container overflow
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.overflow = '';
      }
    }
    
    // Cleanup function to ensure we remove the class when component unmounts
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      
      const dashboardContainer = document.querySelector('.dashboard-container');
      if (dashboardContainer) {
        dashboardContainer.classList.remove('modal-open');
      }
      
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.overflow = '';
      }
    };
  }, [showAddModal, showEditModal, showQRModal]);
  
  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getTables();
      
      if (response && response.success) {
        let tableData = [];
        if (response.tables) {
          tableData = response.tables;
        } else if (response.data && Array.isArray(response.data)) {
          tableData = response.data;
        }
        
        setTables(tableData);
        
        if (tableData && tableData.length > 0) {
          const uniqueSections = [...new Set(tableData.map(table => table.section).filter(Boolean))];
          const uniqueFloors = [...new Set(tableData.map(table => table.floor).filter(Boolean))];
          
          setSections(uniqueSections);
          setFloors(uniqueFloors);
        }
      } else {
        setError(response?.message || 'Failed to fetch tables');
      }
    } catch (err) {
      console.error('Fetch tables error:', err);
      
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Error loading tables. Please try again.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding new table
  const handleAddTable = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await createTable(formData);
      
      if (response.success) {
        setTables(prevTables => [...prevTables, response.table]);
        setShowAddModal(false);
        resetForm();
      } else {
        setError(response.message || 'Failed to create table');
      }
    } catch (err) {
      console.error('Add table error:', err);
      setError(err.message || 'Error creating table');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle editing existing table
  const handleEditTable = async (e) => {
    e.preventDefault();
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const tableId = selectedTable._id || selectedTable.id;
      const response = await updateTable(tableId, formData);
      
      if (response.success) {
        setTables(prevTables => 
          prevTables.map(table => 
            (table._id || table.id) === tableId 
              ? response.table 
              : table
          )
        );
        setShowEditModal(false);
        setSelectedTable(null);
        resetForm();
      } else {
        setError(response.message || 'Failed to update table');
      }
    } catch (err) {
      console.error('Edit table error:', err);
      setError(err.message || 'Error updating table');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle deleting a table
  const handleDeleteTable = async (tableId) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await deleteTable(tableId);
      
      if (response.success) {
        setTables(prevTables => 
          prevTables.filter(table => (table._id || table.id) !== tableId)
        );
      } else {
        setError(response.message || 'Failed to delete table');
      }
    } catch (err) {
      console.error('Delete table error:', err);
      setError(err.message || 'Error deleting table');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle changing table status with real-time updates
  const handleStatusChange = async (tableId, newStatus) => {
    try {
      // Mark this specific table as changing status
      setStatusChanging(prev => ({
        ...prev,
        [tableId]: true
      }));
      
      // Optimistically update UI immediately
      setTables(prevTables => 
        prevTables.map(table => 
          (table._id === tableId || table.id === tableId) 
            ? { ...table, status: newStatus }
            : table
        )
      );
      
      // Update selected table if in QR modal
      if (selectedTable && (selectedTable._id === tableId || selectedTable.id === tableId)) {
        setSelectedTable(prev => ({ ...prev, status: newStatus }));
      }
      
      // Get restaurant ID for socket emit
      const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
      
      // Emit directly to socket for instant update to all clients
      // This will trigger the tableStatusUpdate event we're listening for
      if (socketService.isSocketConnected()) {
        console.log('Emitting updateTableStatus event via socket');
        socketService.emit('updateTableStatus', {
          tableId,
          status: newStatus,
          restaurantId: restaurant.id
        });
      }
      
      // Make the API call in the background
      const response = await changeTableStatus(tableId, newStatus);
      
      if (!response.success) {
        // Only show error, don't revert UI since socket will handle updates
        setError(`Failed to update table status: ${response.message || 'Unknown error'}`);
        
        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Status change error:', err);
      setError(`Error updating table status: ${err.message || 'Unknown error'}`);
      
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      // Clear the loading state for this table after a delay
      // (The socket event should clear it normally)
      setTimeout(() => {
        setStatusChanging(prev => ({
          ...prev,
          [tableId]: false
        }));
      }, 2000);
    }
  };
  
  // Handle regenerating QR code
  const handleRegenerateQR = async (tableId) => {
    try {
      setQrLoading(true);
      setError(null);
      
      const response = await regenerateQRCode(tableId);
      
      if (response.success) {
        setTables(prevTables => 
          prevTables.map(table => 
            (table._id || table.id) === tableId 
              ? { ...table, qrCode: response.qrCode } 
              : table
          )
        );
        
        if (selectedTable && (selectedTable._id === tableId || selectedTable.id === tableId)) {
          setSelectedTable(prev => ({ ...prev, qrCode: response.qrCode }));
        }
        
      } else {
        setError(response.message || 'Failed to regenerate QR code');
      }
    } catch (err) {
      console.error('QR regeneration error:', err);
      setError(err.message || 'Error regenerating QR code');
    } finally {
      setQrLoading(false);
    }
  };
  
  const handleViewQR = (table) => {
    setSelectedTable(table);
    setShowQRModal(true);
  };
  
  const handleEditClick = (table) => {
    setSelectedTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      section: table.section || 'Main',
      floor: table.floor || 'Ground',
      isActive: table.isActive !== false
    });
    setShowEditModal(true);
  };
  
  const resetForm = () => {
    setFormData({
      tableNumber: '',
      capacity: 4,
      section: 'Main',
      floor: 'Ground',
      isActive: true
    });
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? checked 
        : name === 'capacity' 
          ? (parseInt(value) || '') 
          : value
    }));
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const applyFilters = (tableList) => {
    // Ensure tableList is an array
    if (!tableList || !Array.isArray(tableList)) {
      return [];
    }
    
    return tableList.filter(table => {
      // Skip invalid table objects
      if (!table) return false;
      
      // Apply section filter if provided
      if (filters.section && table.section !== filters.section) {
        return false;
      }
      
      // Apply floor filter if provided
      if (filters.floor && table.floor !== filters.floor) {
        return false;
      }
      
      // Apply status filter if provided
      if (filters.status && table.status !== filters.status) {
        return false;
      }
      
      // Apply active filter if provided
      if (filters.isActive === 'active' && table.isActive === false) {
        return false;
      }
      if (filters.isActive === 'inactive' && table.isActive !== false) {
        return false;
      }
      
      return true;
    });
  };
  
  const filteredTables = applyFilters(tables);

  return (
    <div className={`table-management-container ${inDashboard ? 'in-dashboard' : ''}`}>
      {!inDashboard && (
        <header className="table-header">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate('/dashboard')}>
              &larr; Back to Dashboard
            </button>
            <h1>Table Management</h1>
          </div>
          <button 
            className="add-table-button"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            + Add Table
          </button>
        </header>
      )}
      
      <div className={inDashboard ? "dashboard-table-content" : "tables-content"}>
        {/* Single-line filters container */}
        <div className="single-line-filters-container">
          <div className="filter-item">
            <label>Section:</label>
            <select 
              name="section" 
              value={filters.section} 
              onChange={handleFilterChange}
            >
              <option value="">All Sections</option>
              {sections.map((section, idx) => (
                <option key={idx} value={section}>{section}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-item">
            <label>Floor:</label>
            <select 
              name="floor" 
              value={filters.floor} 
              onChange={handleFilterChange}
            >
              <option value="">All Floors</option>
              {floors.map((floor, idx) => (
                <option key={idx} value={floor}>{floor}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-item">
            <label>Status:</label>
            <select 
              name="status" 
              value={filters.status} 
              onChange={handleFilterChange}
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          
          <div className="filter-item">
            <label>Activity:</label>
            <select 
              name="isActive" 
              value={filters.isActive} 
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <button 
            className="reset-filters-button"
            onClick={() => setFilters({
              section: '',
              floor: '',
              status: '',
              isActive: ''
            })}
          >
            Reset Filters
          </button>
          
          {inDashboard && (
            <button 
              className="add-table-button"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              + Add Table
            </button>
          )}
        </div>
        
        {error && !showAddModal && !showEditModal && !showQRModal && (
          <div className="error-message">{error}</div>
        )}
        
        {loading && !showAddModal && !showEditModal && !showQRModal ? (
          <div className="loading">Loading tables...</div>
        ) : (
          <>
            {filteredTables.length > 0 ? (
              <div className="tables-grid">
                {filteredTables.map(table => (
                  <div 
                    key={table._id || table.id} 
                    className={`table-card ${!table.isActive ? 'inactive' : ''} status-${table.status || 'available'}`}
                  >
                    <div className="table-header">
                      <div className="table-number-container">
                        <span className={`status-dot status-${table.status || 'available'}`}></span>
                        <h3>TT{table.tableNumber}</h3>
                      </div>
                      <span className={`status-badge status-${table.status || 'available'}`}>
                        {table.status === 'available' ? 'Available' : 
                         table.status === 'occupied' ? 'Occupied' : 
                         table.status === 'reserved' ? 'Reserved' : 'Maintenance'}
                      </span>
                    </div>
                    
                    <div className="table-details">
                      <div className="detail-item">
                        <span className="detail-label">Capacity:</span>
                        <span className="detail-value">{table.capacity}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Section:</span>
                        <span className="detail-value">{table.section || 'Main'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Floor:</span>
                        <span className="detail-value">{table.floor || 'Ground'}</span>
                      </div>
                    </div>
                    
                    {table.status === 'occupied' && table.currentCustomer && (
                      <a href="#" className="customer-link">
                        Customer: {table.currentCustomer.name || 'Guest'}
                      </a>
                    )}
                    
                    <div className="table-actions">
                      <div className="status-actions">
                        <select 
                          value={table.status || 'available'}
                          onChange={(e) => handleStatusChange(table._id || table.id, e.target.value)}
                          className="status-select"
                          disabled={statusChanging[table._id || table.id]}
                        >
                          <option value="available">
                            {statusChanging[table._id || table.id] ? 'Updating...' : 'Set Available'}
                          </option>
                          <option value="occupied">
                            {statusChanging[table._id || table.id] ? 'Updating...' : 'Set Occupied'}
                          </option>
                          <option value="reserved">
                            {statusChanging[table._id || table.id] ? 'Updating...' : 'Set Reserved'}
                          </option>
                          <option value="maintenance">
                            {statusChanging[table._id || table.id] ? 'Updating...' : 'Set Maintenance'}
                          </option>
                        </select>
                      </div>
                      
                      <div className="card-buttons">
                        <button 
                          className="qr-button"
                          onClick={() => handleViewQR(table)}
                        >
                          QR
                        </button>
                        <button 
                          className="edit-button"
                          onClick={() => handleEditClick(table)}
                        >
                          Edit
                        </button>
                        <button 
                          className="delete-button"
                          onClick={() => handleDeleteTable(table._id || table.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <h3>No Tables Found</h3>
                <p>
                  {tables.length === 0
                    ? "You haven't added any tables yet."
                    : "No tables match the current filters."}
                </p>
                {tables.length === 0 && (
                  <button 
                    className="add-first-button"
                    onClick={() => {
                      resetForm();
                      setShowAddModal(true);
                    }}
                  >
                    Add Your First Table
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Add Table Modal */}
      {showAddModal && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2>Add New Table</h2>
              <button 
                type="button"
                className="close-button" 
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddTable}>
              <div className="form-group">
                <label htmlFor="tableNumber">Table Number</label>
                <input
                  type="text"
                  id="tableNumber"
                  name="tableNumber"
                  value={formData.tableNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. T01, A3"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="capacity">Capacity</label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="section">Section</label>
                <input
                  type="text"
                  id="section"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  placeholder="e.g. Main, Outdoor, VIP"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="floor">Floor</label>
                <input
                  type="text"
                  id="floor"
                  name="floor"
                  value={formData.floor}
                  onChange={handleInputChange}
                  placeholder="e.g. Ground, First, Basement"
                />
              </div>
              
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                <label htmlFor="isActive">Active</label>
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
                  disabled={!formData.tableNumber || !formData.capacity || loading}
                >
                  {loading ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Table Modal */}
      {showEditModal && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2>Edit Table</h2>
              <button 
                type="button"
                className="close-button" 
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTable(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditTable}>
              <div className="form-group">
                <label htmlFor="edit-tableNumber">Table Number</label>
                <input
                  type="text"
                  id="edit-tableNumber"
                  name="tableNumber"
                  value={formData.tableNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. T01, A3"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-capacity">Capacity</label>
                <input
                  type="number"
                  id="edit-capacity"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-section">Section</label>
                <input
                  type="text"
                  id="edit-section"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  placeholder="e.g. Main, Outdoor, VIP"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-floor">Floor</label>
                <input
                  type="text"
                  id="edit-floor"
                  name="floor"
                  value={formData.floor}
                  onChange={handleInputChange}
                  placeholder="e.g. Ground, First, Basement"
                />
              </div>
              
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                <label htmlFor="edit-isActive">Active</label>
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedTable(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="save-button" 
                  disabled={!formData.tableNumber || !formData.capacity || loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* QR Code Modal */}
      {showQRModal && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal large">
            <div className="modal-header">
              <h2>Table QR Code</h2>
              <button 
                type="button"
                className="close-button" 
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedTable(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {selectedTable && (
                <div className="qr-container">
                  <div className="qr-details">
                    <h4>Table {selectedTable.tableNumber}</h4>
                    <p>Section: {selectedTable.section || 'Main'}</p>
                    <p>Floor: {selectedTable.floor || 'Ground'}</p>
                    {selectedTable.currentCustomer && (
                      <div className="customer-info-qr">
                        <p className="customer-name">Customer: {selectedTable.currentCustomer.name}</p>
                        <p>Guests: {selectedTable.currentCustomer.numberOfGuests}</p>
                        {selectedTable.currentCustomer.specialRequests && (
                          <p>Notes: {selectedTable.currentCustomer.specialRequests}</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {selectedTable.qrCode ? (
                    <div className="qr-code-image">
                      <img 
                        src={`${API_URL.replace('/api', '')}${selectedTable.qrCode.replace(/^\/api/, '')}`} 
                        alt={`QR Code for Table ${selectedTable.tableNumber}`} 
                      />
                    </div>
                  ) : (
                    <div className="no-qr-message">
                      <p>No QR code available for this table.</p>
                    </div>
                  )}
                  
                  <div className="qr-actions">
                    <button 
                      className="regenerate-button"
                      onClick={() => handleRegenerateQR(selectedTable._id || selectedTable.id)}
                      disabled={qrLoading}
                    >
                      {qrLoading ? 'Generating...' : 'Regenerate QR Code'}
                    </button>
                    
                    {selectedTable.qrCode && (
                      <button 
                        className="download-button"
                        onClick={() => {
                          const qrUrl = `${API_URL.replace('/api', '')}${selectedTable.qrCode}`;
                          fetch(qrUrl)
                            .then(response => response.blob())
                            .then(blob => {
                              const blobUrl = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = `table-${selectedTable.tableNumber}-qr.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                            })
                            .catch(err => {
                              console.error("Download failed:", err);
                              alert("Download failed. Please try again.");
                            });
                        }}
                      >
                        Download QR Code
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableManagement;