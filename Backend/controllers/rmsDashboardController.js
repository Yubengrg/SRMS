// controllers/rmsDashboardController.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const RestaurantStaff = require('../models/RestaurantStaff');

// Get dashboard overview data
const getDashboardOverview = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    // Get date range for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // Get date range for current month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(todayEnd);
    
    // Get menu count
    const menuCount = await MenuItem.countDocuments({ restaurant: restaurantId });
    
    // Get table counts
    const totalTables = await Table.countDocuments({ restaurant: restaurantId });
    const activeTables = await Table.countDocuments({ restaurant: restaurantId, isActive: true });
    
    // Get today's order count and revenue
    const todayOrders = await Order.find({
      restaurant: restaurantId,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    
    const todayOrderCount = todayOrders.length;
    const todayRevenue = todayOrders.reduce((sum, order) => {
      // Only include completed or served orders for revenue
      if (order.status === 'completed' || order.status === 'served') {
        return sum + (order.totalAmount || 0);
      }
      return sum;
    }, 0);
    
    // Get month's order count and revenue
    const monthOrders = await Order.find({
      restaurant: restaurantId,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });
    
    const monthOrderCount = monthOrders.length;
    const monthRevenue = monthOrders.reduce((sum, order) => {
      // Only include completed or served orders for revenue
      if (order.status === 'completed' || order.status === 'served') {
        return sum + (order.totalAmount || 0);
      }
      return sum;
    }, 0);
    
    // Get occupied tables count
    const occupiedTables = await Table.countDocuments({
      restaurant: restaurantId,
      status: 'occupied'
    });
    
    // Get active orders count (orders that are not completed or cancelled)
    const activeOrders = await Order.countDocuments({
      restaurant: restaurantId,
      status: { $nin: ['completed', 'cancelled'] }
    });
    
    // Get inventory stats
    let inventoryStats = {
      totalItems: 0,
      lowStockItems: 0,
      totalValue: 0
    };
    
    try {
      if (mongoose.models.Inventory) {
        const Inventory = mongoose.models.Inventory;
        
        // Get inventory counts
        inventoryStats.totalItems = await Inventory.countDocuments({ 
          restaurant: restaurantId 
        });
        
        // Get low stock items count
        inventoryStats.lowStockItems = await Inventory.countDocuments({
          restaurant: restaurantId,
          $expr: { $lte: ['$quantity', '$reorderLevel'] }
        });
        
        // Calculate total inventory value
        const valueResult = await Inventory.aggregate([
          { $match: { restaurant: restaurantId } },
          { $project: { 
            totalValue: { $multiply: ['$quantity', '$unitPrice'] } 
          }},
          { $group: { 
            _id: null, 
            sum: { $sum: '$totalValue' } 
          }}
        ]);
        
        if (valueResult.length > 0) {
          inventoryStats.totalValue = valueResult[0].sum;
        }
      }
    } catch (error) {
      console.log('Inventory model not available or error:', error.message);
    }
    
    // Get popular menu items (top 5 ordered items)
    const popularItems = await Order.aggregate([
      { $match: { restaurant: restaurantId } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.menuItem',
        count: { $sum: 1 },
        name: { $first: '$items.name' }
      }},
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Format response
    const dashboardData = {
      menuItems: menuCount,
      tables: {
        total: totalTables,
        active: activeTables,
        occupied: occupiedTables
      },
      orders: {
        active: activeOrders,
        today: todayOrderCount,
        month: monthOrderCount
      },
      revenue: {
        today: todayRevenue,
        month: monthRevenue
      },
      popularItems: popularItems,
      inventory: inventoryStats
    };
    
    return res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard data'
    });
  }
};

// Get sales statistics
const getSalesStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Define date range based on period
    const endDate = new Date();
    let startDate = new Date();
    let groupByField;
    
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        groupByField = { $hour: '$createdAt' };
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        groupByField = { $dayOfWeek: '$createdAt' };
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        groupByField = { $dayOfMonth: '$createdAt' };
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        groupByField = { $month: '$createdAt' };
        break;
      default:
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        groupByField = { $dayOfWeek: '$createdAt' };
    }
    
    // Aggregate sales data by period
    const salesData = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'served'] }
        }
      },
      {
        $group: {
          _id: groupByField,
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Format data for chart display
    let formattedData = [];
    
    if (period === 'day') {
      // Format data for hours of the day
      for (let hour = 0; hour < 24; hour++) {
        const hourData = salesData.find(data => data._id === hour);
        formattedData.push({
          period: `${hour}:00`,
          sales: hourData ? hourData.totalSales : 0,
          orders: hourData ? hourData.orderCount : 0
        });
      }
    } else if (period === 'week') {
      // Format data for days of the week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let day = 1; day <= 7; day++) {
        const dayData = salesData.find(data => data._id === day);
        formattedData.push({
          period: dayNames[day - 1],
          sales: dayData ? dayData.totalSales : 0,
          orders: dayData ? dayData.orderCount : 0
        });
      }
    } else if (period === 'month') {
      // Format data for days of the month
      const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = salesData.find(data => data._id === day);
        formattedData.push({
          period: `${day}`,
          sales: dayData ? dayData.totalSales : 0,
          orders: dayData ? dayData.orderCount : 0
        });
      }
    } else if (period === 'year') {
      // Format data for months of the year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let month = 1; month <= 12; month++) {
        const monthData = salesData.find(data => data._id === month);
        formattedData.push({
          period: monthNames[month - 1],
          sales: monthData ? monthData.totalSales : 0,
          orders: monthData ? monthData.orderCount : 0
        });
      }
    }
    
    // Calculate totals
    const totalSales = formattedData.reduce((sum, data) => sum + data.sales, 0);
    const totalOrders = formattedData.reduce((sum, data) => sum + data.orders, 0);
    
    res.status(200).json({
      success: true,
      period,
      totalSales,
      totalOrders,
      data: formattedData
    });
  } catch (error) {
    console.error('Sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales statistics'
    });
  }
};

// Get restaurant staff
const getStaffStats = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    
    // Get staff members
    const staffMembers = await RestaurantStaff.find({ restaurant: restaurantId })
      .populate('user', 'name email phone');
    
    // Count by role
    const roleCount = staffMembers.reduce((acc, staff) => {
      acc[staff.role] = (acc[staff.role] || 0) + 1;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      totalStaff: staffMembers.length,
      roleStats: roleCount,
      staff: staffMembers
    });
  } catch (error) {
    console.error('Staff stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving staff statistics'
    });
  }
};

// Get order trend
const getOrderTrend = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Define date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parseInt(days) - 1));
    startDate.setHours(0, 0, 0, 0);
    
    // Aggregate order data by day
    const orderData = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalOrders: { $sum: 1 },
          dineIn: {
            $sum: { $cond: [{ $eq: ['$orderType', 'dine-in'] }, 1, 0] }
          },
          takeaway: {
            $sum: { $cond: [{ $eq: ['$orderType', 'takeaway'] }, 1, 0] }
          },
          revenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['completed', 'served']] },
                '$totalAmount',
                0
              ]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Generate all dates in range
    const allDates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      const dateData = orderData.find(data => data._id === dateString) || {
        _id: dateString,
        totalOrders: 0,
        dineIn: 0,
        takeaway: 0,
        revenue: 0
      };
      
      // Format date for display
      const date = new Date(dateString);
      const displayDate = `${date.getDate()}/${date.getMonth() + 1}`;
      
      allDates.push({
        date: displayDate,
        totalOrders: dateData.totalOrders,
        dineIn: dateData.dineIn,
        takeaway: dateData.takeaway,
        revenue: dateData.revenue
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.status(200).json({
      success: true,
      data: allDates
    });
  } catch (error) {
    console.error('Order trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving order trend'
    });
  }
};

// Simplified dashboard data for quick loading
const getDashboardData = async (req, res) => {
  try {
    // Get base dashboard data
    const dashboardData = await getDashboardOverview(req, {
      status: (code) => code,
      json: (data) => data
    });
    
    if (dashboardData.status !== 200) {
      return res.status(dashboardData.status).json(dashboardData);
    }
    
    // Return just basic data for quick loading
    res.status(200).json({
      success: true,
      data: dashboardData.data
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard data'
    });
  }
};

module.exports = {
  getDashboardOverview,
  getSalesStats,
  getStaffStats,
  getOrderTrend,
  getDashboardData
};