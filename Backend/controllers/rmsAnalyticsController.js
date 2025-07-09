// controllers/rmsAnalyticsController.js
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

// Helper function to get date range based on period
const getDateRange = (period) => {
  const endDate = new Date();
  let startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'year':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    default:
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
  }
  
  return { startDate, endDate };
};

// Get sales analytics
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const restaurantId = req.restaurant._id;
    const { startDate, endDate } = getDateRange(period);
    
    // Determine grouping format based on period
    let groupByField;
    let dateFormat;
    
    switch (period) {
      case 'day':
        groupByField = { $hour: '$createdAt' };
        dateFormat = '%H:00';
        break;
      case 'week':
        groupByField = { $dayOfWeek: '$createdAt' };
        dateFormat = '%w';
        break;
      case 'month':
        groupByField = { $dayOfMonth: '$createdAt' };
        dateFormat = '%d';
        break;
      case 'year':
        groupByField = { $month: '$createdAt' };
        dateFormat = '%m';
        break;
      default:
        groupByField = { $dayOfWeek: '$createdAt' };
        dateFormat = '%w';
    }
    
    // Aggregate sales data
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
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          customers: { $addToSet: '$customer.userId' },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      {
        $addFields: {
          customers: { $size: '$customers' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Format data based on period
    let formattedData = [];
    
    if (period === 'day') {
      // 24 hours
      for (let hour = 0; hour < 24; hour++) {
        const hourData = salesData.find(data => data._id === hour) || {
          sales: 0, orders: 0, customers: 0, avgOrderValue: 0
        };
        formattedData.push({
          period: `${hour.toString().padStart(2, '0')}:00`,
          sales: hourData.sales,
          orders: hourData.orders,
          customers: hourData.customers,
          avgOrderValue: Math.round(hourData.avgOrderValue || 0)
        });
      }
    } else if (period === 'week') {
      // 7 days
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let day = 1; day <= 7; day++) {
        const dayData = salesData.find(data => data._id === day) || {
          sales: 0, orders: 0, customers: 0, avgOrderValue: 0
        };
        formattedData.push({
          period: dayNames[day === 7 ? 0 : day], // MongoDB week starts at 1 (Sunday)
          sales: dayData.sales,
          orders: dayData.orders,
          customers: dayData.customers,
          avgOrderValue: Math.round(dayData.avgOrderValue || 0)
        });
      }
    } else if (period === 'month') {
      // Days of current month
      const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = salesData.find(data => data._id === day) || {
          sales: 0, orders: 0, customers: 0, avgOrderValue: 0
        };
        formattedData.push({
          period: day.toString(),
          sales: dayData.sales,
          orders: dayData.orders,
          customers: dayData.customers,
          avgOrderValue: Math.round(dayData.avgOrderValue || 0)
        });
      }
    } else if (period === 'year') {
      // 12 months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let month = 1; month <= 12; month++) {
        const monthData = salesData.find(data => data._id === month) || {
          sales: 0, orders: 0, customers: 0, avgOrderValue: 0
        };
        formattedData.push({
          period: monthNames[month - 1],
          sales: monthData.sales,
          orders: monthData.orders,
          customers: monthData.customers,
          avgOrderValue: Math.round(monthData.avgOrderValue || 0)
        });
      }
    }
    
    // Calculate totals
    const totalSales = formattedData.reduce((sum, data) => sum + data.sales, 0);
    const totalOrders = formattedData.reduce((sum, data) => sum + data.orders, 0);
    const totalCustomers = formattedData.reduce((sum, data) => sum + data.customers, 0);
    
    res.status(200).json({
      success: true,
      period,
      data: formattedData,
      summary: {
        totalSales,
        totalOrders,
        totalCustomers,
        avgOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0
      }
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales analytics'
    });
  }
};

// Get popular items analytics
const getPopularItems = async (req, res) => {
  try {
    const { period = 'month', limit = 10 } = req.query;
    const restaurantId = req.restaurant._id;
    const { startDate, endDate } = getDateRange(period);
    
    const popularItems = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'served'] }
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.status': { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$items.menuItem',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);
    
    // Add colors for chart visualization  
    const colors = ['#FFB930', '#4299E1', '#805AD5', '#ED8936', '#38A169', '#E53E3E', 
                   '#F59F00', '#9F7AEA', '#00B5D8', '#F56565'];
    
    const formattedItems = popularItems.map((item, index) => ({
      name: item.name,
      value: item.totalQuantity,
      revenue: item.totalRevenue,
      orders: item.orderCount,
      color: colors[index % colors.length]
    }));
    
    res.status(200).json({
      success: true,
      period,
      data: formattedItems
    });
  } catch (error) {
    console.error('Popular items analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving popular items analytics'
    });
  }
};

// Get payment method statistics
const getPaymentMethodStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const restaurantId = req.restaurant._id;
    const { startDate, endDate } = getDateRange(period);
    
    const paymentStats = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'served'] },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Calculate total orders for percentage calculation
    const totalOrders = paymentStats.reduce((sum, method) => sum + method.count, 0);
    
    // Colors for different payment methods
    const methodColors = {
      'cash': '#805AD5',
      'esewa': '#4299E1', 
      'khalti': '#38A169',
      'imepay': '#ED8936',
      'credit': '#E53E3E',
      'debit': '#F59F00',
      'other': '#9F7AEA'
    };
    
    const formattedStats = paymentStats.map(method => ({
      name: method._id.charAt(0).toUpperCase() + method._id.slice(1),
      value: totalOrders > 0 ? Math.round((method.count / totalOrders) * 100) : 0,
      count: method.count,
      amount: method.totalAmount,
      color: methodColors[method._id.toLowerCase()] || '#9F7AEA'
    }));
    
    res.status(200).json({
      success: true,
      period,
      data: formattedStats,
      summary: {
        totalOrders,
        totalAmount: paymentStats.reduce((sum, method) => sum + method.totalAmount, 0)
      }
    });
  } catch (error) {
    console.error('Payment method stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payment method statistics'
    });
  }
};

// Get revenue analytics with trends
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const restaurantId = req.restaurant._id;
    const { startDate, endDate } = getDateRange(period);
    
    // Get current period data
    const currentPeriodRevenue = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'served'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    // Get previous period for comparison
    const periodDiff = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);
    
    const previousPeriodRevenue = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: prevStartDate, $lte: prevEndDate },
          status: { $in: ['completed', 'served'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    const current = currentPeriodRevenue[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
    const previous = previousPeriodRevenue[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
    
    // Calculate percentage changes
    const revenueChange = previous.totalRevenue > 0 
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 
      : 0;
    
    const ordersChange = previous.totalOrders > 0 
      ? ((current.totalOrders - previous.totalOrders) / previous.totalOrders) * 100 
      : 0;
    
    const avgOrderChange = previous.avgOrderValue > 0 
      ? ((current.avgOrderValue - previous.avgOrderValue) / previous.avgOrderValue) * 100 
      : 0;
    
    res.status(200).json({
      success: true,
      period,
      data: {
        current: {
          totalRevenue: current.totalRevenue,
          totalOrders: current.totalOrders,
          avgOrderValue: Math.round(current.avgOrderValue)
        },
        previous: {
          totalRevenue: previous.totalRevenue,
          totalOrders: previous.totalOrders,
          avgOrderValue: Math.round(previous.avgOrderValue)
        },
        trends: {
          revenueChange: Math.round(revenueChange * 100) / 100,
          ordersChange: Math.round(ordersChange * 100) / 100,
          avgOrderChange: Math.round(avgOrderChange * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving revenue analytics'
    });
  }
};

// Get comprehensive analytics dashboard data
const getAnalyticsDashboard = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const restaurantId = req.restaurant._id;
    
    // Execute all analytics queries in parallel
    const [salesData, popularItems, paymentMethods, revenueData] = await Promise.all([
      getSalesAnalytics({ ...req, restaurant: { _id: restaurantId } }, { status: () => ({ json: (data) => data }) }),
      getPopularItems({ ...req, restaurant: { _id: restaurantId } }, { status: () => ({ json: (data) => data }) }),
      getPaymentMethodStats({ ...req, restaurant: { _id: restaurantId } }, { status: () => ({ json: (data) => data }) }),
      getRevenueAnalytics({ ...req, restaurant: { _id: restaurantId } }, { status: () => ({ json: (data) => data }) })
    ]);
    
    res.status(200).json({
      success: true,
      period,
      dashboard: {
        sales: salesData,
        popularItems: popularItems,
        paymentMethods: paymentMethods,
        revenue: revenueData
      }
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving analytics dashboard'
    });
  }
};

module.exports = {
  getSalesAnalytics,
  getPopularItems,
  getPaymentMethodStats,
  getRevenueAnalytics,
  getAnalyticsDashboard
};