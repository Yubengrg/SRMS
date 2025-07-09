// models/MenuItem.js
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name for the menu item'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuCategory',
    required: true
  },
  price: {
    type: Number,
    required: [true, 'Please provide a price for the menu item'],
    min: 0
  },
  discountedPrice: {
    type: Number,
    min: 0
  },
  images: [String],
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  isGlutenFree: {
    type: Boolean,
    default: false
  },
  spicyLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  ingredients: [{
    // For items tracked in inventory
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
    },
    // For manual ingredients not tracked in inventory
    name: String,
    quantity: {
      type: Number,
      min: 0
    }
  }],
  allergens: [String],
  preparationTime: {
    type: Number,
    min: 0
  },
  calories: {
    type: Number,
    min: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
menuItemSchema.index({ restaurant: 1, category: 1, isAvailable: 1 });
menuItemSchema.index({ restaurant: 1, isPopular: 1 });
menuItemSchema.index({ restaurant: 1, isFeatured: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = MenuItem;