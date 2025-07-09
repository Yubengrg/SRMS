import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MenuManagement.css';
import {
  getMenuCategories,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleItemAvailability,
  getInventoryItems
} from '../services/api';

// Custom Image Component with Error Handling
const ImageWithFallback = ({ src, alt, className, fallback, onError, ...props }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const handleError = (e) => {
    console.error(`Error loading image: ${src}`, e);
    e.target.onerror = null; // Prevent infinite loops
    setHasError(true);
    setIsLoading(false);
    if (onError) onError(e);
  };
  
  const handleLoad = () => {
    setIsLoading(false);
  };
  
  if (hasError) {
    return fallback || <div className="no-image-compact">No Image</div>;
  }
  
  return (
    <>
      {isLoading && <div className="no-image-compact">Loading...</div>}
      <img
        src={src}
        alt={alt}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        style={{ display: isLoading ? 'none' : 'block' }}
        {...props}
      />
    </>
  );
};

const MenuManagement = ({ inDashboard = false }) => {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableInventory, setAvailableInventory] = useState([]);
  
  // State for tracking image errors - FIXED APPROACH
  const [imageErrors, setImageErrors] = useState(new Set());
  
  // Debug modal state changes
  useEffect(() => {
    console.log("Modal states:", { showCategoryModal, showItemModal });
  }, [showCategoryModal, showItemModal]);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true
  });
  
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    discountedPrice: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    spicyLevel: 0,
    ingredients: [],
    allergens: [],
    preparationTime: '',
    calories: '',
    isAvailable: true,
    sortOrder: 0,
    isPopular: false,
    isFeatured: false,
    deductInitialInventory: false
  });
  
  // New state for image upload
  const [itemImage, setItemImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchCategories();
    fetchMenuItems();
    
    // Cleanup function for image preview
    return () => {
      cleanupImagePreview();
    };
  }, []);
  
  // Fetch inventory when modal is shown
  useEffect(() => {
    if (showItemModal) {
      fetchAvailableInventory();
    }
  }, [showItemModal]);
  
  // Function to fetch available inventory items
  const fetchAvailableInventory = async () => {
    try {
      const response = await getInventoryItems({ category: 'ingredient' });
      if (response.success) {
        setAvailableInventory(response.items);
      } else {
        console.error('Error fetching inventory:', response.message);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };
  
  // Handle image file selection with more lenient validation
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      console.log('Selected file:', file.name);
      console.log('File type:', file.type);
      console.log('File size:', file.size);
      
      // More lenient approach - check if it's any image type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPG, PNG, GIF, etc.)');
        e.target.value = ''; // Reset the input
        return;
      }
      
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file is too large. Maximum size is 5MB.');
        e.target.value = ''; // Reset the input
        return;
      }
      
      setItemImage(file);
      
      // Create a preview URL for the selected image
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };
  
  // Clean up image preview URL
  const cleanupImagePreview = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    setItemImage(null);
  };
  
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await getMenuCategories();
      if (response.success) {
        setCategories(response.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMenuItems = async (categoryId = '') => {
    try {
      setLoading(true);
      const response = await getMenuItems(categoryId);
      if (response.success) {
        console.log('Fetched menu items:', response.menuItems);
        // Log a sample item to inspect its structure
        if (response.menuItems.length > 0) {
          console.log('Sample menu item structure:', response.menuItems[0]);
        }
        setMenuItems(response.menuItems);
        
        // Reset image errors when fetching new items
        setImageErrors(new Set());
      }
    } catch (err) {
      console.error('Error fetching menu items:', err);
      setError('Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('name', categoryForm.name);
      formData.append('description', categoryForm.description);
      formData.append('sortOrder', categoryForm.sortOrder);
      formData.append('isActive', categoryForm.isActive);
      
      let response;
      if (editingCategory) {
        response = await updateMenuCategory(editingCategory._id, formData);
      } else {
        response = await createMenuCategory(formData);
      }
      
      if (response.success) {
        fetchCategories();
        setShowCategoryModal(false);
        setEditingCategory(null);
        resetCategoryForm();
      }
    } catch (err) {
      console.error('Error saving category:', err);
      setError('Failed to save category');
    } finally {
      setLoading(false);
    }
  };
  
  const handleItemSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const formData = new FormData();
      
      // Process ingredients
      let ingredients = [];
      if (itemForm.ingredients && itemForm.ingredients.length > 0) {
        ingredients = itemForm.ingredients.map(ing => {
          return {
            ...(ing.inventoryItem ? { inventoryItem: ing.inventoryItem } : {}),
            name: ing.name,
            quantity: parseFloat(ing.quantity) || 0
          };
        });
        formData.append('ingredients', JSON.stringify(ingredients));
      }
      
      // Add all form fields to FormData
      Object.keys(itemForm).forEach(key => {
        if (key === 'ingredients') {
          // Already handled above
        } else if (key === 'allergens') {
          formData.append(key, JSON.stringify(itemForm[key]));
        } else if (key !== 'deductInitialInventory') {
          formData.append(key, itemForm[key]);
        }
      });
      
      // Include deductInitialInventory flag
      formData.append('deductInitialInventory', itemForm.deductInitialInventory);
      
      // Add the image file if it exists
      if (itemImage) {
        console.log('Attaching image to form data:', itemImage.name, itemImage.type, itemImage.size);
        formData.append('image', itemImage);
      } else {
        console.log('No image attached to form data');
      }
      
      // Log form data entries for debugging
      console.log('Form data entries:');
      for (let pair of formData.entries()) {
        if (pair[0] === 'image') {
          console.log(pair[0], ':', '[File object]');
        } else {
          console.log(pair[0], ':', pair[1]);
        }
      }
      
      let response;
      let updatedItemId;
      
      if (editingItem) {
        updatedItemId = editingItem._id;
        console.log(`Updating menu item ${updatedItemId}`);
        response = await updateMenuItem(updatedItemId, formData);
      } else {
        console.log('Creating new menu item');
        response = await createMenuItem(formData);
        if (response.success && response.menuItem) {
          updatedItemId = response.menuItem._id;
        }
      }
      
      console.log('API response:', response);
      
      if (response.success) {
        // Always do a full refresh to ensure we have the latest data including images
        console.log('Menu item saved successfully, refreshing all data...');
        
        // Wait a short time to ensure server has processed the image
        setTimeout(async () => {
          try {
            await fetchMenuItems(selectedCategory?._id);
            console.log('Menu items refreshed after save');
          } catch (err) {
            console.error('Error refreshing menu items:', err);
          }
        }, 500); // 500ms delay
        
        setShowItemModal(false);
        setEditingItem(null);
        resetItemForm();
        cleanupImagePreview();
      } else {
        setError(response.message || 'Failed to save menu item');
      }
    } catch (err) {
      console.error('Error saving item:', err);
      setError('Failed to save menu item: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive
    });
    setShowCategoryModal(true);
  };
  
  const handleEditItem = (item) => {
    setEditingItem(item);
    
    // Extract ingredients data
    const ingredientsData = item.ingredients?.map(ing => ({
      inventoryItem: ing.inventoryItem?._id || ing.inventoryItem,
      name: ing.name || (ing.inventoryItem?.name || ''),
      quantity: ing.quantity || 0
    })) || [];
    
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category._id,
      discountedPrice: item.discountedPrice || '',
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isGlutenFree: item.isGlutenFree,
      spicyLevel: item.spicyLevel,
      ingredients: ingredientsData,
      allergens: item.allergens,
      preparationTime: item.preparationTime || '',
      calories: item.calories || '',
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
      isPopular: item.isPopular,
      isFeatured: item.isFeatured,
      deductInitialInventory: false
    });
    
    // Reset image states when editing
    cleanupImagePreview();
    setItemImage(null);
    
    setShowItemModal(true);
  };
  
  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        setLoading(true);
        const response = await deleteMenuCategory(categoryId);
        if (response.success) {
          fetchCategories();
          if (selectedCategory?._id === categoryId) {
            setSelectedCategory(null);
          }
        }
      } catch (err) {
        console.error('Error deleting category:', err);
        setError(err.response?.data?.message || 'Failed to delete category');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handleDeleteItem = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        setLoading(true);
        const response = await deleteMenuItem(itemId);
        if (response.success) {
          fetchMenuItems(selectedCategory?._id);
        }
      } catch (err) {
        console.error('Error deleting item:', err);
        setError('Failed to delete menu item');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const toggleItemAvailabilityHandler = async (itemId) => {
    try {
      const response = await toggleItemAvailability(itemId);
      if (response.success) {
        fetchMenuItems(selectedCategory?._id);
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
      setError('Failed to toggle item availability');
    }
  };
  
  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      sortOrder: 0,
      isActive: true
    });
  };
  
  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      price: '',
      category: selectedCategory?._id || '',
      discountedPrice: '',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      spicyLevel: 0,
      ingredients: [],
      allergens: [],
      preparationTime: '',
      calories: '',
      isAvailable: true,
      sortOrder: 0,
      isPopular: false,
      isFeatured: false,
      deductInitialInventory: false
    });
    
    // Also reset image state
    cleanupImagePreview();
  };
  
  const filteredItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Add/remove ingredient from inventory
  const handleIngredientChange = (inventoryItem, checked) => {
    if (checked) {
      // Add inventory item to ingredients
      setItemForm(prev => ({
        ...prev,
        ingredients: [
          ...prev.ingredients,
          {
            inventoryItem: inventoryItem._id,
            name: inventoryItem.name,
            quantity: 1
          }
        ]
      }));
    } else {
      // Remove inventory item from ingredients
      setItemForm(prev => ({
        ...prev,
        ingredients: prev.ingredients.filter(ing => 
          ing.inventoryItem !== inventoryItem._id
        )
      }));
    }
  };
  
  // Update ingredient quantity
  const handleIngredientQuantityChange = (inventoryItemId, quantity) => {
    setItemForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map(ing => 
        ing.inventoryItem === inventoryItemId
          ? { ...ing, quantity: parseFloat(quantity) || 0 }
          : ing
      )
    }));
  };
  
  // Handle adding custom ingredient (not from inventory)
  const handleAddCustomIngredient = () => {
    setItemForm(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          name: '',
          quantity: 1
        }
      ]
    }));
  };
  
  // Update custom ingredient
  const handleCustomIngredientChange = (index, field, value) => {
    setItemForm(prev => {
      const updatedIngredients = [...prev.ingredients];
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        [field]: field === 'quantity' ? (parseFloat(value) || 0) : value
      };
      return {
        ...prev,
        ingredients: updatedIngredients
      };
    });
  };
  
  // Remove custom ingredient
  const handleRemoveIngredient = (index) => {
    setItemForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  // FIXED: Handle individual image errors - React way
  const handleImageError = (itemId) => {
    setImageErrors(prev => new Set(prev).add(itemId));
  };
  
  return (
    <div className={inDashboard ? "dashboard-content-section" : "menu-management-container"}>
      {/* Only show header if not in dashboard */}
      {!inDashboard && (
        <header className="menu-header">
          <h1>Menu Management</h1>
          <div className="menu-actions">
            <button 
              className="primary-button"
              onClick={() => {
                console.log("Add Category button clicked");
                setShowCategoryModal(true);
              }}
            >
              + Add Category
            </button>
            <button 
              className="primary-button"
              onClick={() => {
                console.log("Add Menu Item button clicked");
                if (!categories.length) {
                  alert('Please add a category first');
                  return;
                }
                setItemForm(prev => ({ ...prev, category: categories[0]._id }));
                setShowItemModal(true);
              }}
            >
              + Add Menu Item
            </button>
          </div>
        </header>
      )}
      
      {/* Action buttons for dashboard view */}
      {inDashboard && (
        <div className="dashboard-menu-actions">
          <button 
            className="primary-button"
            onClick={() => {
              console.log("Add Category button clicked");
              setShowCategoryModal(true);
            }}
          >
            + Add Category
          </button>
          <button 
            className="primary-button"
            onClick={() => {
              console.log("Add Menu Item button clicked");
              if (!categories.length) {
                alert('Please add a category first');
                return;
              }
              setItemForm(prev => ({ ...prev, category: categories[0]._id }));
              setShowItemModal(true);
            }}
          >
            + Add Menu Item
          </button>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {/* Horizontal Categories */}
      <div className="categories-horizontal">
        <div className="search-filter-container">
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <div className="filter-buttons">
            <button className={!selectedCategory ? 'filter-btn active' : 'filter-btn'} onClick={() => {
              setSelectedCategory(null);
              fetchMenuItems();
            }}>All Items</button>
            
            {categories.map(category => (
              <div 
                key={category._id}
                className={selectedCategory?._id === category._id ? 'filter-btn active' : 'filter-btn'}
                onClick={() => {
                  setSelectedCategory(category);
                  fetchMenuItems(category._id);
                }}
              >
                <span className="category-name">{category.name}</span>
                <div className="category-actions">
                  <button
                    className="icon-button edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCategory(category);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="icon-button delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(category._id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Menu Items Grid */}
      <div className="menu-items-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="menu-items-compact-grid">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => {
                // Log image info for debugging
                if (item.images && item.images.length > 0) {
                  console.log(`Item ${item.name} has images:`, item.images);
                  
                  // Construct and log the full image URL
                  const imageUrl = `http://localhost:5001${item.images[0]}`;
                  console.log('Full image URL:', imageUrl);
                }
                
                return (
                  <div key={item._id} className="menu-item-compact-card">
                    {/* FIXED IMAGE AREA - Using React state instead of direct DOM manipulation */}
                    <div className="item-compact-image">
                      {item.images && item.images.length > 0 ? (
                        <ImageWithFallback
                          src={`http://localhost:5001${item.images[0]}`}
                          alt={item.name}
                          fallback={<div className="no-image-compact">No Image</div>}
                          onError={() => handleImageError(item._id)}
                        />
                      ) : (
                        <div className="no-image-compact">No Image</div>
                      )}
                      
                      {/* Badges on image */}
                      {item.isPopular && <div className="image-badge popular-badge">Popular</div>}
                      {item.isVegetarian && <div className="image-badge veg-badge">Veg</div>}
                    </div>
                    
                    {/* Item Content */}
                    <div className="item-compact-content">
                      <div className="item-compact-header">
                        <h3 className="item-compact-name">{item.name}</h3>
                        <div className="item-compact-price">
                          <span className={item.discountedPrice ? 'original-price' : ''}>{`₹${item.price}`}</span>
                          {item.discountedPrice && <span className="discounted-price">{`₹${item.discountedPrice}`}</span>}
                        </div>
                      </div>
                      
                      <div className="item-compact-badges">
                        {item.isVegan && <span className="compact-badge vegan">Vegan</span>}
                        {item.isGlutenFree && <span className="compact-badge gluten-free">GF</span>}
                        {item.spicyLevel > 0 && <span className="compact-badge spicy">🌶️ {item.spicyLevel}</span>}
                      </div>
                    </div>
                    
                    {/* Item Footer */}
                    <div className="item-compact-footer">
                      <button
                        className={`availability-btn ${item.isAvailable ? 'available' : 'unavailable'}`}
                        onClick={() => toggleItemAvailabilityHandler(item._id)}
                      >
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </button>
                      
                      <div className="compact-actions">
                        <button
                          className="edit-compact-btn"
                          onClick={() => handleEditItem(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-compact-btn"
                          onClick={() => handleDeleteItem(item._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-items-found">
                <h3>No menu items found</h3>
                <p>Try adjusting your search or add a new menu item.</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Category Modal */}
      {showCategoryModal && (
        <div className="menu-modal-overlay">
          <div className="menu-modal">
            <div className="menu-modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button 
                type="button"
                className="menu-close-button" 
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  resetCategoryForm();
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCategorySubmit}>
              <div className="form-group">
                <label htmlFor="category-name">Name</label>
                <input
                  id="category-name"
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="Enter category name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="category-description">Description</label>
                <textarea
                  id="category-description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows="3"
                  placeholder="Enter category description"
                />
              </div>
              <div className="form-group">
                <label htmlFor="category-sort-order">Sort Order</label>
                <input
                  id="category-sort-order"
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="Enter sort order"
                />
              </div>
              <div className="form-group checkbox-group">
                <label htmlFor="category-active">
                  <input
                    id="category-active"
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="menu-modal-actions">
                <button 
                  type="button" 
                  className="menu-cancel-button" 
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    resetCategoryForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="menu-save-button" 
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Menu Item Modal */}
      {showItemModal && (
        <div className="menu-modal-overlay">
          <div className="menu-modal menu-modal-large">
            <div className="menu-modal-header">
              <h2>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
              <button 
                type="button"
                className="menu-close-button" 
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                  resetItemForm();
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleItemSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category._id} value={category._id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows="3"
                />
              </div>
              
              {/* Enhanced Image Upload Section */}
              <div className="form-group">
                <label>Menu Item Image</label>
                <div className="image-upload-container">
                  {imagePreview && (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                      <button 
                        type="button" 
                        className="remove-image-button" 
                        onClick={() => {
                          cleanupImagePreview();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {!imagePreview && editingItem && editingItem.images && editingItem.images[0] && (
                    <div className="current-image">
                      <p>Current image:</p>
                      <ImageWithFallback
                        src={`http://localhost:5001${editingItem.images[0]}`}
                        alt={editingItem.name}
                        style={{ maxWidth: '100%', maxHeight: '200px' }}
                        fallback={<p>Error loading current image</p>}
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                  />
                  <p className="help-text">Max file size: 5MB. Recommended formats: JPG, PNG, GIF</p>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Price</label>
                  <input
                    type="number"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Discounted Price</label>
                  <input
                    type="number"
                    value={itemForm.discountedPrice}
                    onChange={(e) => setItemForm({ ...itemForm, discountedPrice: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              {/* Ingredients Section - with Inventory Integration */}
              <div className="form-group">
                <label>Ingredients from Inventory</label>
                {availableInventory.length === 0 ? (
                  <p className="help-text">No ingredients available in inventory.</p>
                ) : (
                  <div className="ingredients-selector" style={{ marginBottom: '15px' }}>
                    {availableInventory.map(item => (
                      <div key={item._id} className="ingredient-item" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '8px',
                        padding: '8px',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '4px'
                      }}>
                        <input
                          type="checkbox"
                          id={`ingredient-${item._id}`}
                          checked={itemForm.ingredients.some(ing => ing.inventoryItem === item._id)}
                          onChange={(e) => handleIngredientChange(item, e.target.checked)}
                          style={{ marginRight: '8px' }}
                        />
                        <label htmlFor={`ingredient-${item._id}`} style={{ 
                          marginRight: '10px',
                          flex: '1'
                        }}>
                          {item.name} ({item.quantity} {item.unit} available)
                        </label>
                        {itemForm.ingredients.some(ing => ing.inventoryItem === item._id) && (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <label style={{ marginRight: '5px' }}>Qty:</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={itemForm.ingredients.find(ing => ing.inventoryItem === item._id).quantity}
                              onChange={(e) => handleIngredientQuantityChange(item._id, e.target.value)}
                              style={{ width: '80px' }}
                            />
                            <span style={{ marginLeft: '5px' }}>{item.unit}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Custom Ingredients */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label>Custom Ingredients</label>
                    <button 
                      type="button" 
                      onClick={handleAddCustomIngredient}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  
                  {itemForm.ingredients.filter(ing => !ing.inventoryItem).map((ing, index) => {
                    const ingredientIndex = itemForm.ingredients.indexOf(ing);
                    return (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        marginBottom: '8px',
                        gap: '10px'
                      }}>
                        <input
                          type="text"
                          placeholder="Ingredient name"
                          value={ing.name}
                          onChange={(e) => handleCustomIngredientChange(ingredientIndex, 'name', e.target.value)}
                          style={{ flex: '1' }}
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          min="0"
                          step="0.01"
                          value={ing.quantity}
                          onChange={(e) => handleCustomIngredientChange(ingredientIndex, 'quantity', e.target.value)}
                          style={{ width: '80px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(ingredientIndex)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#e74c3c',
                            fontSize: '18px',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {/* Deduct from inventory option */}
                {!editingItem && (
                  <div className="checkbox-group" style={{ marginTop: '10px' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={itemForm.deductInitialInventory}
                        onChange={(e) => setItemForm({ ...itemForm, deductInitialInventory: e.target.checked })}
                      />
                      Deduct ingredients from inventory when saving
                    </label>
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label>Allergens</label>
                <input
                  type="text"
                  placeholder="Enter allergens separated by commas"
                  value={itemForm.allergens.join(', ')}
                  onChange={(e) => setItemForm({ 
                    ...itemForm, 
                    allergens: e.target.value.split(',').map(item => item.trim()).filter(item => item)
                  })}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Preparation Time (minutes)</label>
                  <input
                    type="number"
                    value={itemForm.preparationTime}
                    onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })}
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label>Calories</label>
                  <input
                    type="number"
                    value={itemForm.calories}
                    onChange={(e) => setItemForm({ ...itemForm, calories: e.target.value })}
                    min="0"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Spicy Level</label>
                <select
                  value={itemForm.spicyLevel}
                  onChange={(e) => setItemForm({ ...itemForm, spicyLevel: parseInt(e.target.value) })}
                >
                  <option value="0">Not Spicy</option>
                  <option value="1">Mild 🌶️</option>
                  <option value="2">Medium 🌶️🌶️</option>
                  <option value="3">Hot 🌶️🌶️🌶️</option>
                </select>
              </div>
              
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isVegetarian}
                    onChange={(e) => setItemForm({ ...itemForm, isVegetarian: e.target.checked })}
                  />
                  Vegetarian
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isVegan}
                    onChange={(e) => setItemForm({ ...itemForm, isVegan: e.target.checked })}
                  />
                  Vegan
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isGlutenFree}
                    onChange={(e) => setItemForm({ ...itemForm, isGlutenFree: e.target.checked })}
                  />
                  Gluten Free
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isPopular}
                    onChange={(e) => setItemForm({ ...itemForm, isPopular: e.target.checked })}
                  />
                  Popular
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isFeatured}
                    onChange={(e) => setItemForm({ ...itemForm, isFeatured: e.target.checked })}
                  />
                  Featured
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                  />
                  Available
                </label>
              </div>
              
              <div className="menu-modal-actions">
                <button type="button" className="menu-cancel-button" onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                  resetItemForm();
                }}>Cancel</button>
                <button type="submit" className="menu-save-button" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;