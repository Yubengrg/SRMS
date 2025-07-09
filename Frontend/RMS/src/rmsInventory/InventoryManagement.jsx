import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getInventoryItems,
  getInventorySummary,
  createInventoryItem,
  updateInventoryItem,
  updateInventoryQuantity,
  deleteInventoryItem,
  getInventoryTransactions
} from '../services/api';
import './InventoryManagement.css';

const InventoryManagement = ({ inDashboard = false }) => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    expiringSoonItems: 0,
    categories: []
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    lowStock: false
  });
  
  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'ingredient',
    quantity: '',
    unit: '',
    unitPrice: '',
    reorderLevel: '',
    supplier: {
      name: '',
      contactInfo: ''
    },
    location: '',
    expiryDate: ''
  });
  
  // Transaction form
  const [transactionForm, setTransactionForm] = useState({
    type: 'purchase',
    quantity: '',
    notes: ''
  });
  
  const navigate = useNavigate();

  // Control body overflow when modal is open
  useEffect(() => {
    const isModalOpen = showAddModal || showEditModal || showAdjustModal || showTransactionsModal;
    
    if (isModalOpen) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    
    // Cleanup function to ensure we remove the class when component unmounts
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showAddModal, showEditModal, showAdjustModal, showTransactionsModal]);
  
  // Initial data loading
  useEffect(() => {
    fetchInventorySummary();
    fetchInventoryItems();
  }, []);
  
  // Fetch inventory summary
  const fetchInventorySummary = async () => {
    try {
      const response = await getInventorySummary();
      if (response.success) {
        setSummary(response.summary);
      }
    } catch (err) {
      console.error('Error fetching inventory summary:', err);
      setError('Failed to load inventory summary');
    }
  };
  
  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      
      // Apply filters
      const queryParams = {};
      if (filters.category) queryParams.category = filters.category;
      if (filters.search) queryParams.search = filters.search;
      if (filters.lowStock) queryParams.lowStock = true;
      
      const response = await getInventoryItems(queryParams);
      
      if (response.success) {
        setInventoryItems(response.items);
      } else {
        setError(response.message || 'Failed to fetch inventory items');
      }
    } catch (err) {
      console.error('Error fetching inventory items:', err);
      setError('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch transactions for an item
  const fetchItemTransactions = async (itemId) => {
    try {
      setLoading(true);
      const response = await getInventoryTransactions({ itemId });
      
      if (response.success) {
        setTransactions(response.transactions);
      } else {
        setError(response.message || 'Failed to fetch transactions');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding new inventory item
  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const response = await createInventoryItem(itemForm);
      
      if (response.success) {
        setInventoryItems([...inventoryItems, response.item]);
        fetchInventorySummary(); // Refresh summary
        setShowAddModal(false);
        resetItemForm();
      } else {
        setError(response.message || 'Failed to create inventory item');
      }
    } catch (err) {
      console.error('Error adding inventory item:', err);
      setError('Failed to create inventory item');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle updating existing inventory item
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    try {
      setLoading(true);
      
      const response = await updateInventoryItem(selectedItem._id, itemForm);
      
      if (response.success) {
        const updatedItems = inventoryItems.map(item => 
          item._id === selectedItem._id ? response.item : item
        );
        
        setInventoryItems(updatedItems);
        fetchInventorySummary(); // Refresh summary
        setShowEditModal(false);
        setSelectedItem(null);
        resetItemForm();
      } else {
        setError(response.message || 'Failed to update inventory item');
      }
    } catch (err) {
      console.error('Error updating inventory item:', err);
      setError('Failed to update inventory item');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle inventory quantity adjustment
  const handleAdjustQuantity = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    try {
      setLoading(true);
      
      const response = await updateInventoryQuantity(selectedItem._id, transactionForm);
      
      if (response.success) {
        const updatedItems = inventoryItems.map(item => 
          item._id === selectedItem._id ? response.item : item
        );
        
        setInventoryItems(updatedItems);
        fetchInventorySummary(); // Refresh summary
        setShowAdjustModal(false);
        setSelectedItem(null);
        resetTransactionForm();
      } else {
        setError(response.message || 'Failed to adjust inventory');
      }
    } catch (err) {
      console.error('Error adjusting inventory:', err);
      setError('Failed to adjust inventory');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle deleting inventory item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      setLoading(true);
      
      const response = await deleteInventoryItem(itemId);
      
      if (response.success) {
        const updatedItems = inventoryItems.filter(item => item._id !== itemId);
        setInventoryItems(updatedItems);
        fetchInventorySummary(); // Refresh summary
      } else {
        setError(response.message || 'Failed to delete inventory item');
      }
    } catch (err) {
      console.error('Error deleting inventory item:', err);
      setError('Failed to delete inventory item');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Apply filters
  const applyFilters = () => {
    fetchInventoryItems();
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      category: '',
      search: '',
      lowStock: false
    });
    
    fetchInventoryItems();
  };
  
  // Reset item form
  const resetItemForm = () => {
    setItemForm({
      name: '',
      category: 'ingredient',
      quantity: '',
      unit: '',
      unitPrice: '',
      reorderLevel: '',
      supplier: {
        name: '',
        contactInfo: ''
      },
      location: '',
      expiryDate: ''
    });
  };
  
  // Reset transaction form
  const resetTransactionForm = () => {
    setTransactionForm({
      type: 'purchase',
      quantity: '',
      notes: ''
    });
  };
  
  // Handle edit button click
  const handleEditClick = (item) => {
    setSelectedItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      unitPrice: item.unitPrice,
      reorderLevel: item.reorderLevel,
      supplier: item.supplier || { name: '', contactInfo: '' },
      location: item.location || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : ''
    });
    setShowEditModal(true);
  };
  
  // Handle adjust button click
  const handleAdjustClick = (item) => {
    setSelectedItem(item);
    resetTransactionForm();
    setShowAdjustModal(true);
  };
  
  // Handle transactions button click
  const handleTransactionsClick = (item) => {
    setSelectedItem(item);
    fetchItemTransactions(item._id);
    setShowTransactionsModal(true);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('supplier.')) {
      const supplierField = name.split('.')[1];
      setItemForm(prev => ({
        ...prev,
        supplier: {
          ...prev.supplier,
          [supplierField]: value
        }
      }));
    } else {
      setItemForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Handle transaction form changes
  const handleTransactionFormChange = (e) => {
    const { name, value } = e.target;
    setTransactionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Get stock status
  const getStockStatus = (item) => {
    const ratio = item.quantity / item.reorderLevel;
    if (ratio <= 0.5) return 'critical';
    if (ratio <= 1) return 'low';
    return 'optimal';
  };
  
  // Get expiry status
  const getExpiryStatus = (item) => {
    if (!item.expiryDate) return null;
    
    const today = new Date();
    const expiry = new Date(item.expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 0) return { status: 'expired', days: 0 };
    if (daysUntilExpiry <= 3) return { status: 'critical', days: daysUntilExpiry };
    if (daysUntilExpiry <= 7) return { status: 'expiring', days: daysUntilExpiry };
    return null;
  };
  
  // Calculate quantity ratio as percentage
  const getQuantityRatio = (item) => {
    return Math.min(Math.round((item.quantity / item.reorderLevel) * 100), 100);
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  return (
    <div className={inDashboard ? "dashboard-content-section" : "inventory-management-container"}>
      {!inDashboard && (
        <header className="inventory-header">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate('/dashboard')}>
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </button>
            <h1>Inventory Management</h1>
          </div>
          <button 
            className="primary-button"
            onClick={() => {
              resetItemForm();
              setShowAddModal(true);
            }}
          >
            <i className="fas fa-plus"></i> Add Inventory Item
          </button>
        </header>
      )}
      
      <div className={inDashboard ? "inventory-dashboard-content" : ""}>
        {inDashboard && (
          <div className="dashboard-inventory-header">
            <h3>Inventory Management</h3>
            <button 
              className="primary-button"
              onClick={() => {
                resetItemForm();
                setShowAddModal(true);
              }}
            >
              <i className="fas fa-plus"></i> Add Inventory Item
            </button>
          </div>
        )}
        
        {/* Enhanced Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-title">
              <i className="fas fa-boxes"></i> Total Items
            </div>
            <div className="card-value">{summary.totalItems}</div>
            <div className="card-subtitle">In inventory</div>
          </div>
          
          <div className="summary-card total-value-card">
            <div className="card-title">
              <i className="fas fa-rupee-sign"></i> Total Value
            </div>
            <div className="card-value total-value">{formatCurrency(summary.totalValue)}</div>
            <div className="card-subtitle">Inventory value</div>
          </div>
          
          <div className="summary-card low-stock-card">
            <div className="card-title">
              <i className="fas fa-exclamation-triangle"></i> Low Stock Items
            </div>
            <div className="card-value low-stock-value">
              {summary.lowStockItems}
              <span className="percentage">
                {Math.round((summary.lowStockItems / (summary.totalItems || 1)) * 100)}%
              </span>
            </div>
            <div className="card-subtitle">Need reordering</div>
          </div>
          
          <div className="summary-card expiring-card">
            <div className="card-title">
              <i className="fas fa-clock"></i> Expiring Soon
            </div>
            <div className="card-value expiring-value">
              {summary.expiringSoonItems}
              <span className="percentage">
                {Math.round((summary.expiringSoonItems / (summary.totalItems || 1)) * 100)}%
              </span>
            </div>
            <div className="card-subtitle">Within 7 days</div>
          </div>
        </div>
        
        {/* Enhanced Filters */}
        <div className="inventory-filters">
          <div className="filter-group">
            <label>Category:</label>
            <select 
              name="category" 
              value={filters.category} 
              onChange={handleFilterChange}
            >
              <option value="">All Categories</option>
              <option value="ingredient">Ingredients</option>
              <option value="beverage">Beverages</option>
              <option value="packaging">Packaging</option>
              <option value="cleaning">Cleaning</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search items..."
            />
          </div>
          
          <div className="filter-checkbox">
            <input
              type="checkbox"
              id="lowStock"
              name="lowStock"
              checked={filters.lowStock}
              onChange={handleFilterChange}
            />
            <label htmlFor="lowStock">Low Stock Only</label>
          </div>
          
          <button className="primary-button" onClick={applyFilters}>
            <i className="fas fa-filter"></i> Apply Filters
          </button>
          <button className="reset-filters" onClick={resetFilters}>
            <i className="fas fa-undo"></i> Reset
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            <p><i className="fas fa-exclamation-circle"></i> {error}</p>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        {/* Enhanced Inventory Table */}
        <div className="inventory-table-container">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Loading inventory data...</p>
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="fas fa-box-open"></i>
              </div>
              <h3>No Inventory Items Found</h3>
              <p>
                {filters.search || filters.category || filters.lowStock
                  ? "No items match your current filters."
                  : "You haven't added any inventory items yet."}
              </p>
              {!filters.search && !filters.category && !filters.lowStock && (
                <button 
                  className="primary-button"
                  onClick={() => {
                    resetItemForm();
                    setShowAddModal(true);
                  }}
                >
                  <i className="fas fa-plus"></i> Add Your First Item
                </button>
              )}
            </div>
          ) : (
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total Value</th>
                  <th>Reorder Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map(item => {
                  const stockStatus = getStockStatus(item);
                  const expiryStatus = getExpiryStatus(item);
                  
                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="item-name-container">
                          <span className="item-name">{item.name}</span>
                          <span className="item-category">{item.category}</span>
                          
                          {expiryStatus && (
                            <span className="expire-warning">
                              {expiryStatus.status === 'expired' 
                                ? <><i className="fas fa-ban"></i> Expired</> 
                                : <><i className="fas fa-clock"></i> Expires in {expiryStatus.days} day{expiryStatus.days !== 1 ? 's' : ''}</>
                              }
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="quantity-cell">
                          <div className="quantity-value">
                            <span className={stockStatus !== 'optimal' ? `${stockStatus}-stock` : ''}>
                              {item.quantity} {item.unit}
                            </span>
                            
                            {stockStatus !== 'optimal' && (
                              <span className={`status-tag stock-${stockStatus}`}>
                                {stockStatus === 'critical' 
                                  ? <><i className="fas fa-exclamation-circle"></i> Critical</> 
                                  : <><i className="fas fa-exclamation-triangle"></i> Low</>
                                }
                              </span>
                            )}
                          </div>
                          <div className="quantity-progress">
                            <div 
                              className={`quantity-bar quantity-${stockStatus}`}
                              style={{ width: `${getQuantityRatio(item)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{formatCurrency(item.quantity * item.unitPrice)}</td>
                      <td>{item.reorderLevel} {item.unit}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-adjust"
                          onClick={() => handleAdjustClick(item)}
                        >
                          <i className="fas fa-plus-minus"></i> Adjust
                        </button>
                        <button 
                          className="btn-edit"
                          onClick={() => handleEditClick(item)}
                        >
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteItem(item._id)}
                        >
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Add Item Modal */}
      {showAddModal && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2><i className="fas fa-plus-circle"></i> Add Inventory Item</h2>
              <button 
                className="close-button"
                onClick={() => {
                  setShowAddModal(false);
                  resetItemForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label htmlFor="name">Item Name*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={itemForm.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category*</label>
                  <select
                    id="category"
                    name="category"
                    value={itemForm.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="ingredient">Ingredient</option>
                    <option value="beverage">Beverage</option>
                    <option value="packaging">Packaging</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="location">Storage Location</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={itemForm.location}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="quantity">Initial Quantity*</label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={itemForm.quantity}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="unit">Unit of Measure*</label>
                  <input
                    type="text"
                    id="unit"
                    name="unit"
                    value={itemForm.unit}
                    onChange={handleInputChange}
                    placeholder="kg, liters, pieces, etc."
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="unitPrice">Unit Price (₹)*</label>
                  <input
                    type="number"
                    id="unitPrice"
                    name="unitPrice"
                    value={itemForm.unitPrice}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="reorderLevel">Reorder Level*</label>
                  <input
                    type="number"
                    id="reorderLevel"
                    name="reorderLevel"
                    value={itemForm.reorderLevel}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="expiryDate">Expiry Date</label>
                <input
                  type="date"
                  id="expiryDate"
                  name="expiryDate"
                  value={itemForm.expiryDate}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="supplier.name">Supplier Name</label>
                <input
                  type="text"
                  id="supplier.name"
                  name="supplier.name"
                  value={itemForm.supplier.name}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="supplier.contactInfo">Supplier Contact Info</label>
                <input
                  type="text"
                  id="supplier.contactInfo"
                  name="supplier.contactInfo"
                  value={itemForm.supplier.contactInfo}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetItemForm();
                  }}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button 
                  type="submit"
                  className="save-button"
                  disabled={loading}
                >
                  {loading ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save Item</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Item Modal */}
      {showEditModal && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2><i className="fas fa-edit"></i> Edit Inventory Item</h2>
              <button 
                className="close-button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedItem(null);
                  resetItemForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleUpdateItem}>
              <div className="form-group">
                <label htmlFor="edit-name">Item Name*</label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={itemForm.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-category">Category*</label>
                  <select
                    id="edit-category"
                    name="category"
                    value={itemForm.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="ingredient">Ingredient</option>
                    <option value="beverage">Beverage</option>
                    <option value="packaging">Packaging</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-location">Storage Location</label>
                  <input
                    type="text"
                    id="edit-location"
                    name="location"
                    value={itemForm.location}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-unit">Unit of Measure*</label>
                  <input
                    type="text"
                    id="edit-unit"
                    name="unit"
                    value={itemForm.unit}
                    onChange={handleInputChange}
                    placeholder="kg, liters, pieces, etc."
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-reorderLevel">Reorder Level*</label>
                  <input
                    type="number"
                    id="edit-reorderLevel"
                    name="reorderLevel"
                    value={itemForm.reorderLevel}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-unitPrice">Unit Price (₹)*</label>
                <input
                  type="number"
                  id="edit-unitPrice"
                  name="unitPrice"
                  value={itemForm.unitPrice}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-expiryDate">Expiry Date</label>
                <input
                  type="date"
                  id="edit-expiryDate"
                  name="expiryDate"
                  value={itemForm.expiryDate}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-supplier-name">Supplier Name</label>
                <input
                  type="text"
                  id="edit-supplier-name"
                  name="supplier.name"
                  value={itemForm.supplier.name}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-supplier-contact">Supplier Contact Info</label>
                <input
                  type="text"
                  id="edit-supplier-contact"
                  name="supplier.contactInfo"
                  value={itemForm.supplier.contactInfo}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedItem(null);
                    resetItemForm();
                  }}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button 
                  type="submit"
                  className="save-button"
                  disabled={loading}
                >
                  {loading ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Adjust Quantity Modal */}
      {showAdjustModal && selectedItem && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2>
                <i className={
                  transactionForm.type === 'purchase' ? 'fas fa-cart-plus' :
                  transactionForm.type === 'usage' ? 'fas fa-utensils' :
                  transactionForm.type === 'wastage' ? 'fas fa-trash-alt' :
                  'fas fa-balance-scale'
                }></i> 
                {transactionForm.type === 'purchase' ? 'Add Stock' :
                 transactionForm.type === 'usage' ? 'Record Usage' :
                 transactionForm.type === 'wastage' ? 'Record Wastage' :
                 'Adjust Inventory Level'}: {selectedItem.name}
              </h2>
              <button 
                className="close-button"
                onClick={() => {
                  setShowAdjustModal(false);
                  setSelectedItem(null);
                  resetTransactionForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAdjustQuantity}>
              <div className="transaction-summary">
                <p>Current Quantity: <strong>{selectedItem.quantity} {selectedItem.unit}</strong></p>
                <p>Reorder Level: <strong>{selectedItem.reorderLevel} {selectedItem.unit}</strong></p>
                {selectedItem.expiryDate && (
                  <p>Current Expiry Date: <strong>{formatDate(selectedItem.expiryDate)}</strong></p>
                )}
              </div>
              
              <div className="form-group">
                <label>Transaction Type:</label>
                <div className="transaction-type-select">
                  <button 
                    type="button"
                    className={transactionForm.type === 'purchase' ? 'active' : ''}
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'purchase' })}
                  >
                    <i className="fas fa-cart-plus"></i> Purchase
                  </button>
                  <button 
                    type="button"
                    className={transactionForm.type === 'usage' ? 'active' : ''}
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'usage' })}
                  >
                    <i className="fas fa-utensils"></i> Usage
                  </button>
                  <button 
                    type="button"
                    className={transactionForm.type === 'wastage' ? 'active' : ''}
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'wastage' })}
                  >
                    <i className="fas fa-trash-alt"></i> Wastage
                  </button>
                  <button 
                    type="button"
                    className={transactionForm.type === 'adjustment' ? 'active' : ''}
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'adjustment' })}
                  >
                    <i className="fas fa-balance-scale"></i> Set Value
                  </button>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="transaction-quantity">
                  {transactionForm.type === 'adjustment' ? 'New Quantity:' : 'Quantity:'}
                </label>
                <input
                  type="number"
                  id="transaction-quantity"
                  name="quantity"
                  value={transactionForm.quantity}
                  onChange={handleTransactionFormChange}
                  min={transactionForm.type === 'adjustment' ? '0' : '0.01'}
                  step="0.01"
                  required
                />
                <small>
                  {transactionForm.type === 'purchase' && <><i className="fas fa-info-circle"></i> Amount to add to inventory</>}
                  {(transactionForm.type === 'usage' || transactionForm.type === 'wastage') && <><i className="fas fa-info-circle"></i> Amount to remove from inventory</>}
                  {transactionForm.type === 'adjustment' && <><i className="fas fa-info-circle"></i> New inventory value to set</>}
                </small>
              </div>
              
              <div className="form-group">
                <label htmlFor="transaction-notes">Notes:</label>
                <textarea
                  id="transaction-notes"
                  name="notes"
                  value={transactionForm.notes}
                  onChange={handleTransactionFormChange}
                  rows="3"
                  placeholder="Enter details about this transaction (e.g., supplier info, reason for adjustment, etc.)"
                ></textarea>
              </div>
              
              <div className="transaction-summary">
                <h4><i className="fas fa-receipt"></i> Transaction Summary</h4>
                <div className="summary-details">
                  {transactionForm.type === 'purchase' && (
                    <>
                      <p>
                        <strong>Adding {transactionForm.quantity || 0} {selectedItem.unit}</strong> of {selectedItem.name}
                      </p>
                      <p>
                        New Quantity: <strong>{
                          parseFloat(selectedItem.quantity) + (parseFloat(transactionForm.quantity) || 0)
                        } {selectedItem.unit}</strong>
                      </p>
                    </>
                  )}
                  
                  {transactionForm.type === 'usage' && (
                    <>
                      <p>
                        <strong>Removing {transactionForm.quantity || 0} {selectedItem.unit}</strong> of {selectedItem.name} for usage
                      </p>
                      <p>
                        New Quantity: <strong>{
                          Math.max(0, parseFloat(selectedItem.quantity) - (parseFloat(transactionForm.quantity) || 0))
                        } {selectedItem.unit}</strong>
                      </p>
                    </>
                  )}
                  
                  {transactionForm.type === 'wastage' && (
                    <>
                      <p>
                        <strong>Removing {transactionForm.quantity || 0} {selectedItem.unit}</strong> of {selectedItem.name} due to wastage
                      </p>
                      <p>
                        New Quantity: <strong>{
                          Math.max(0, parseFloat(selectedItem.quantity) - (parseFloat(transactionForm.quantity) || 0))
                        } {selectedItem.unit}</strong>
                      </p>
                    </>
                  )}
                  
                  {transactionForm.type === 'adjustment' && (
                    <p>
                      <strong>Setting quantity to {transactionForm.quantity || 0} {selectedItem.unit}</strong> of {selectedItem.name}
                      {selectedItem.quantity && transactionForm.quantity && (
                        <span className="quantity-change">
                          {" "}
                          (Change: {parseFloat(transactionForm.quantity) > selectedItem.quantity ? "+" : ""}
                          {(parseFloat(transactionForm.quantity) - selectedItem.quantity).toFixed(2)} {selectedItem.unit})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedItem(null);
                    resetTransactionForm();
                  }}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button 
                  type="submit"
                  className="save-button"
                  disabled={loading || !transactionForm.quantity}
                >
                  {loading ? <><i className="fas fa-spinner fa-spin"></i> Processing...</> : <><i className="fas fa-check-circle"></i> Save Transaction</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Transactions History Modal */}
      {showTransactionsModal && selectedItem && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2><i className="fas fa-history"></i> Transaction History: {selectedItem.name}</h2>
              <button 
                className="close-button"
                onClick={() => {
                  setShowTransactionsModal(false);
                  setSelectedItem(null);
                  setTransactions([]);
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '20px' }}>
              {loading ? (
                <div className="loading">
                  <div className="loading-spinner"></div>
                  <p>Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <div className="empty-icon"><i className="fas fa-receipt"></i></div>
                  <h3>No transaction history found</h3>
                  <p>No transactions have been recorded for this item yet.</p>
                </div>
              ) : (
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Value</th>
                      <th>Notes</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={transaction._id}>
                        <td>{new Date(transaction.date).toLocaleString()}</td>
                        <td>
                          <span className={`transaction-type transaction-${transaction.type}`}>
                            {transaction.type === 'purchase' && <i className="fas fa-cart-plus"></i>}
                            {transaction.type === 'usage' && <i className="fas fa-utensils"></i>}
                            {transaction.type === 'wastage' && <i className="fas fa-trash-alt"></i>}
                            {transaction.type === 'adjustment' && <i className="fas fa-balance-scale"></i>}
                            {' '}
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                          </span>
                        </td>
                        <td>
                          {transaction.type === 'adjustment' ? 
                            `Set to ${transaction.quantity} ${selectedItem.unit}` : 
                            `${transaction.quantity} ${selectedItem.unit}`}
                        </td>
                        <td>
                          {transaction.totalPrice ? 
                            `₹${transaction.totalPrice.toFixed(2)}` : 
                            '-'}
                        </td>
                        <td>{transaction.notes || '-'}</td>
                        <td>{transaction.performedBy?.name || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowTransactionsModal(false);
                    setSelectedItem(null);
                    setTransactions([]);
                  }}
                >
                  <i className="fas fa-times"></i> Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;