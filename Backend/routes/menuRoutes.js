// routes/menuRoutes.js
const express = require('express');
const { getRestaurantMenu, getMenuItemDetails } = require('../controllers/menuController');

const router = express.Router();

// Define menu routes
router.get('/:restaurantId', getRestaurantMenu);
router.get('/item/:itemId', getMenuItemDetails);

module.exports = router;