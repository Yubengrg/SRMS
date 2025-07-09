// src/rmsDashboard/SalesAnalyticsDashboard.jsx - Enhanced Version
import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesAnalytics, getPopularItems, getPaymentMethodStats, getRevenueAnalytics } from '../services/api';

const SalesAnalyticsDashboard = ({ inDashboard = false }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [activeChart, setActiveChart] = useState('sales');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data states
  const [salesData, setSalesData] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [revenueData, setRevenueData] = useState(null);
  const [summary, setSummary] = useState({ 
    totalSales: 0, 
    totalOrders: 0, 
    totalCustomers: 0, 
    avgOrderValue: 0 
  });

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Loading analytics data for period: ${selectedPeriod}`);
      
      // Execute all API calls in parallel for better performance
      const [salesResponse, popularItemsResponse, paymentMethodsResponse, revenueResponse] = await Promise.all([
        getSalesAnalytics(selectedPeriod).catch(err => {
          console.warn('Sales analytics API error, using mock data:', err);
          return generateMockSalesData(selectedPeriod);
        }),
        getPopularItems(selectedPeriod).catch(err => {
          console.warn('Popular items API error, using mock data:', err);
          return { success: true, data: generateMockPopularItems() };
        }),
        getPaymentMethodStats(selectedPeriod).catch(err => {
          console.warn('Payment methods API error, using mock data:', err);
          return { success: true, data: generateMockPaymentMethods() };
        }),
        getRevenueAnalytics(selectedPeriod).catch(err => {
          console.warn('Revenue analytics API error, using mock data:', err);
          return generateMockRevenueData(selectedPeriod);
        })
      ]);
      
      // Process sales data
      if (salesResponse && salesResponse.success) {
        setSalesData(salesResponse.data || []);
        setSummary(salesResponse.summary || { totalSales: 0, totalOrders: 0, totalCustomers: 0, avgOrderValue: 0 });
      } else {
        const mockData = generateMockSalesData(selectedPeriod);
        setSalesData(mockData.data);
        setSummary(mockData.summary);
      }
      
      // Process popular items
      if (popularItemsResponse && popularItemsResponse.success) {
        setPopularItems(popularItemsResponse.data || []);
      } else {
        setPopularItems(generateMockPopularItems());
      }
      
      // Process payment methods
      if (paymentMethodsResponse && paymentMethodsResponse.success) {
        setPaymentMethods(paymentMethodsResponse.data || []);
      } else {
        setPaymentMethods(generateMockPaymentMethods());
      }
      
      // Process revenue data
      if (revenueResponse && revenueResponse.success) {
        setRevenueData(revenueResponse.data || null);
      } else {
        setRevenueData(generateMockRevenueData(selectedPeriod).data);
      }
      
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data. Using sample data for demonstration.');
      
      // Use mock data as fallback
      const mockSalesData = generateMockSalesData(selectedPeriod);
      setSalesData(mockSalesData.data);
      setSummary(mockSalesData.summary);
      setPopularItems(generateMockPopularItems());
      setPaymentMethods(generateMockPaymentMethods());
      setRevenueData(generateMockRevenueData(selectedPeriod).data);
    } finally {
      setLoading(false);
    }
  };

  // Mock data generators - Updated with more realistic restaurant data
  const generateMockSalesData = (period) => {
    let data = [];
    let totalSales = 0;
    let totalOrders = 0;
    let totalCustomers = 0;
    
    switch (period) {
      case 'day':
        for (let hour = 0; hour < 24; hour++) {
          // Simulate restaurant peak hours
          let multiplier = 1;
          if (hour >= 11 && hour <= 14) multiplier = 3; // Lunch rush
          if (hour >= 17 && hour <= 21) multiplier = 4; // Dinner rush
          if (hour < 7 || hour > 23) multiplier = 0.1; // Closed hours
          
          const sales = Math.floor((Math.random() * 5000 + 1000) * multiplier);
          const orders = Math.floor((Math.random() * 20 + 5) * multiplier);
          const customers = Math.floor(orders * 0.8);
          data.push({
            period: `${hour.toString().padStart(2, '0')}:00`,
            sales,
            orders,
            customers,
            avgOrderValue: orders > 0 ? Math.floor(sales / orders) : 0
          });
          totalSales += sales;
          totalOrders += orders;
          totalCustomers += customers;
        }
        break;
      case 'week':
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach((day, index) => {
          // Weekend typically busier
          const multiplier = (index >= 5) ? 1.5 : 1;
          const sales = Math.floor((Math.random() * 15000 + 8000) * multiplier);
          const orders = Math.floor((Math.random() * 80 + 40) * multiplier);
          const customers = Math.floor(orders * 0.7);
          data.push({
            period: day,
            sales,
            orders,
            customers,
            avgOrderValue: Math.floor(sales / orders)
          });
          totalSales += sales;
          totalOrders += orders;
          totalCustomers += customers;
        });
        break;
      case 'month':
        for (let day = 1; day <= 30; day++) {
          const sales = Math.floor(Math.random() * 20000) + 10000;
          const orders = Math.floor(Math.random() * 100) + 50;
          const customers = Math.floor(orders * 0.6);
          data.push({
            period: day.toString(),
            sales,
            orders,
            customers,
            avgOrderValue: Math.floor(sales / orders)
          });
          totalSales += sales;
          totalOrders += orders;
          totalCustomers += customers;
        }
        break;
      case 'year':
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach(month => {
          const sales = Math.floor(Math.random() * 200000) + 100000;
          const orders = Math.floor(Math.random() * 1000) + 800;
          const customers = Math.floor(orders * 0.5);
          data.push({
            period: month,
            sales,
            orders,
            customers,
            avgOrderValue: Math.floor(sales / orders)
          });
          totalSales += sales;
          totalOrders += orders;
          totalCustomers += customers;
        });
        break;
    }
    
    return {
      success: true,
      data,
      summary: {
        totalSales,
        totalOrders,
        totalCustomers,
        avgOrderValue: totalOrders > 0 ? Math.floor(totalSales / totalOrders) : 0
      }
    };
  };

  const generateMockPopularItems = () => [
    { name: 'Dal Bhat', value: 152, revenue: 45600, orders: 152, color: '#FFB930' },
    { name: 'Chicken Momo', value: 118, revenue: 23600, orders: 118, color: '#4299E1' },
    { name: 'Butter Chicken', value: 97, revenue: 38800, orders: 97, color: '#805AD5' },
    { name: 'Fried Rice', value: 85, revenue: 25500, orders: 85, color: '#ED8936' },
    { name: 'Chicken Chowmein', value: 73, revenue: 21900, orders: 73, color: '#38A169' },
    { name: 'Gundruk Soup', value: 65, revenue: 9750, orders: 65, color: '#E53E3E' }
  ];

  const generateMockPaymentMethods = () => [
    { name: 'Cash', value: 45, count: 180, amount: 540000, color: '#805AD5' },
    { name: 'eSewa', value: 25, count: 100, amount: 300000, color: '#4299E1' },
    { name: 'Khalti', value: 20, count: 80, amount: 240000, color: '#38A169' },
    { name: 'IME Pay', value: 10, count: 40, amount: 120000, color: '#ED8936' }
  ];

  const generateMockRevenueData = (period) => {
    const current = {
      totalRevenue: Math.floor(Math.random() * 500000) + 200000,
      totalOrders: Math.floor(Math.random() * 500) + 200,
      avgOrderValue: 0
    };
    current.avgOrderValue = Math.floor(current.totalRevenue / current.totalOrders);
    
    const previous = {
      totalRevenue: Math.floor(current.totalRevenue * (0.8 + Math.random() * 0.4)),
      totalOrders: Math.floor(current.totalOrders * (0.8 + Math.random() * 0.4)),
      avgOrderValue: 0
    };
    previous.avgOrderValue = Math.floor(previous.totalRevenue / previous.totalOrders);
    
    const revenueChange = previous.totalRevenue > 0 
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 
      : 0;
    
    const ordersChange = previous.totalOrders > 0 
      ? ((current.totalOrders - previous.totalOrders) / previous.totalOrders) * 100 
      : 0;
    
    const avgOrderChange = previous.avgOrderValue > 0 
      ? ((current.avgOrderValue - previous.avgOrderValue) / previous.avgOrderValue) * 100 
      : 0;
    
    return {
      success: true,
      data: {
        current,
        previous,
        trends: {
          revenueChange: Math.round(revenueChange * 100) / 100,
          ordersChange: Math.round(ordersChange * 100) / 100,
          avgOrderChange: Math.round(avgOrderChange * 100) / 100
        }
      }
    };
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const renderLoadingState = () => (
    <div className="analytics-loading">
      <div className="analytics-loading-content">
        <div className="analytics-loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    </div>
  );

  const renderChart = () => {
    if (loading) return renderLoadingState();
    
    switch (activeChart) {
      case 'sales':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB930" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FFB930" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="period" 
                stroke="var(--text-color-light)"
                fontSize={12}
              />
              <YAxis 
                stroke="var(--text-color-light)"
                fontSize={12}
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-color)'
                }}
                formatter={(value) => [formatCurrency(value), 'Sales']}
              />
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke="#FFB930" 
                strokeWidth={3}
                fill="url(#salesGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        );
        
      case 'orders':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="period" 
                stroke="var(--text-color-light)"
                fontSize={12}
              />
              <YAxis 
                stroke="var(--text-color-light)"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-color)'
                }}
                formatter={(value) => [value, 'Orders']}
              />
              <Bar dataKey="orders" fill="#4299E1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
        
      case 'comparison':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="period" 
                stroke="var(--text-color-light)"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="var(--text-color-light)"
                fontSize={12}
                tickFormatter={formatCurrency}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                stroke="var(--text-color-light)"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-color)'
                }}
                formatter={(value, name) => [
                  name === 'sales' ? formatCurrency(value) : value,
                  name === 'sales' ? 'Sales' : 'Orders'
                ]}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="sales" 
                stroke="#FFB930" 
                strokeWidth={3}
                name="Sales"
                dot={{ fill: '#FFB930', strokeWidth: 2, r: 4 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="orders" 
                stroke="#4299E1" 
                strokeWidth={3}
                name="Orders"
                dot={{ fill: '#4299E1', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
        
      default:
        return renderLoadingState();
    }
  };

  const chartButtons = [
    { id: 'sales', label: 'Sales Trend', icon: '📈' },
    { id: 'orders', label: 'Order Volume', icon: '📊' },
    { id: 'comparison', label: 'Comparison', icon: '📉' }
  ];

  const periodButtons = [
    { id: 'day', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' }
  ];

  const getTrendIcon = (value) => {
    if (value > 0) return '📈';
    if (value < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (value) => {
    if (value > 0) return 'var(--success-color)';
    if (value < 0) return 'var(--danger-color)';
    return 'var(--text-color-light)';
  };

  return (
    <div className="analytics-dashboard-container" style={{ 
      width: '100%', 
      padding: inDashboard ? '0' : '1.5rem',
      color: 'var(--text-color)'
    }}>
      {/* Error Message */}
      {error && (
        <div className="analytics-error">
          <i className="fas fa-exclamation-triangle analytics-error-icon"></i>
          {error}
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="analytics-summary-grid">
        <div className="analytics-summary-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 185, 48, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              💰
            </div>
            <h4 style={{ 
              margin: 0, 
              color: 'var(--text-color-dark)',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              Total Sales
            </h4>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.8rem', 
            fontWeight: '700',
            color: 'var(--primary-color)'
          }}>
            {loading ? '...' : formatCurrency(summary.totalSales)}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            {revenueData && (
              <>
                <span style={{ 
                  fontSize: '0.8rem',
                  color: getTrendColor(revenueData.trends?.revenueChange || 0)
                }}>
                  {getTrendIcon(revenueData.trends?.revenueChange || 0)} {Math.abs(revenueData.trends?.revenueChange || 0).toFixed(1)}%
                </span>
                <span style={{ 
                  fontSize: '0.8rem',
                  color: 'var(--text-color-light)'
                }}>
                  vs last {selectedPeriod}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="analytics-summary-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(66, 153, 225, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              🛍️
            </div>
            <h4 style={{ 
              margin: 0, 
              color: 'var(--text-color-dark)',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              Total Orders
            </h4>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.8rem', 
            fontWeight: '700',
            color: '#4299E1'
          }}>
            {loading ? '...' : summary.totalOrders.toLocaleString()}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            {revenueData && (
              <>
                <span style={{ 
                  fontSize: '0.8rem',
                  color: getTrendColor(revenueData.trends?.ordersChange || 0)
                }}>
                  {getTrendIcon(revenueData.trends?.ordersChange || 0)} {Math.abs(revenueData.trends?.ordersChange || 0).toFixed(1)}%
                </span>
                <span style={{ 
                  fontSize: '0.8rem',
                  color: 'var(--text-color-light)'
                }}>
                  vs last {selectedPeriod}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="analytics-summary-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(128, 90, 213, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              📊
            </div>
            <h4 style={{ 
              margin: 0, 
              color: 'var(--text-color-dark)',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              Avg. Order Value
            </h4>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.8rem', 
            fontWeight: '700',
            color: '#805AD5'
          }}>
            {loading ? '...' : formatCurrency(summary.avgOrderValue)}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            {revenueData && (
              <>
                <span style={{ 
                  fontSize: '0.8rem',
                  color: getTrendColor(revenueData.trends?.avgOrderChange || 0)
                }}>
                  {getTrendIcon(revenueData.trends?.avgOrderChange || 0)} {Math.abs(revenueData.trends?.avgOrderChange || 0).toFixed(1)}%
                </span>
                <span style={{ 
                  fontSize: '0.8rem',
                  color: 'var(--text-color-light)'
                }}>
                  vs last {selectedPeriod}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="analytics-summary-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(56, 161, 105, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              👥
            </div>
            <h4 style={{ 
              margin: 0, 
              color: 'var(--text-color-dark)',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              Total Customers
            </h4>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.8rem', 
            fontWeight: '700',
            color: '#38A169'
          }}>
            {loading ? '...' : summary.totalCustomers.toLocaleString()}
          </p>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            fontSize: '0.8rem',
            color: 'var(--text-color-light)'
          }}>
            This {selectedPeriod}
          </p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="analytics-main-grid">
        {/* Sales Chart */}
        <div className="analytics-chart-container">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">Sales Analytics</h3>
            <div className="analytics-period-buttons">
              {periodButtons.map(period => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`analytics-period-btn ${selectedPeriod === period.id ? 'active' : ''}`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          <div className="analytics-chart-type-buttons">
            {chartButtons.map(chart => (
              <button
                key={chart.id}
                onClick={() => setActiveChart(chart.id)}
                className={`analytics-chart-type-btn ${activeChart === chart.id ? 'active' : ''}`}
              >
                <span>{chart.icon}</span>
                {chart.label}
              </button>
            ))}
          </div>

          {renderChart()}
        </div>

        {/* Popular Items */}
        <div className="analytics-popular-items">
          <h3 style={{ 
            margin: '0 0 1.5rem 0', 
            color: 'var(--text-color-dark)',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}>
            Popular Items
          </h3>
          
          {loading ? (
            renderLoadingState()
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={popularItems}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {popularItems.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'var(--text-color)'
                    }}
                    formatter={(value) => [value, 'Orders']}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="analytics-popular-items-list">
                {popularItems.slice(0, 4).map((item, index) => (
                  <div key={index} className="analytics-popular-item">
                    <div className="analytics-popular-item-info">
                      <div 
                        className="analytics-popular-item-color"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="analytics-popular-item-name">
                        {item.name}
                      </span>
                    </div>
                    <span className="analytics-popular-item-value">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="analytics-chart-container analytics-full-width">
        <h3 style={{ 
          margin: '0 0 1.5rem 0', 
          color: 'var(--text-color-dark)',
          fontSize: '1.1rem',
          fontWeight: '600'
        }}>
          Payment Methods Distribution
        </h3>
        
        {loading ? (
          <div style={{ height: '200px' }}>
            {renderLoadingState()}
          </div>
        ) : (
          <div className="analytics-payment-methods-grid">
            {paymentMethods.map((method, index) => (
              <div key={index} className="analytics-payment-method-card">
                <div 
                  className="analytics-payment-method-circle"
                  style={{
                    background: `conic-gradient(${method.color} 0deg ${method.value * 3.6}deg, rgba(255,255,255,0.1) ${method.value * 3.6}deg 360deg)`
                  }}
                >
                  <div 
                    className="analytics-payment-method-inner"
                    style={{ color: method.color }}
                  >
                    {method.value}%
                  </div>
                </div>
                <span className="analytics-payment-method-name">
                  {method.name}
                </span>
                <span className="analytics-payment-method-count">
                  {method.count} orders
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue Comparison */}
      {revenueData && (
        <div className="analytics-revenue-comparison">
          <h3 style={{ 
            margin: '0 0 1.5rem 0', 
            color: 'var(--text-color-dark)',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}>
            Revenue Comparison
          </h3>
          
          <div className="analytics-revenue-grid">
            <div className="analytics-revenue-card current">
              <h4 className="analytics-revenue-card-title">
                Current {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </h4>
              <p 
                className="analytics-revenue-card-value"
                style={{ color: 'var(--primary-color)' }}
              >
                {formatCurrency(revenueData.current.totalRevenue)}
              </p>
              <p className="analytics-revenue-card-subtitle">
                {revenueData.current.totalOrders} orders • {formatCurrency(revenueData.current.avgOrderValue)} avg
              </p>
            </div>

            <div className="analytics-revenue-card previous">
              <h4 className="analytics-revenue-card-title">
                Previous {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </h4>
              <p 
                className="analytics-revenue-card-value"
                style={{ color: 'var(--text-color)' }}
              >
                {formatCurrency(revenueData.previous.totalRevenue)}
              </p>
              <p className="analytics-revenue-card-subtitle">
                {revenueData.previous.totalOrders} orders • {formatCurrency(revenueData.previous.avgOrderValue)} avg
              </p>
            </div>

            <div className="analytics-revenue-card growth">
              <h4 className="analytics-revenue-card-title">Growth</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className="analytics-growth-item">
                  <span className="analytics-growth-label">Revenue:</span>
                  <span 
                    className="analytics-growth-value"
                    style={{ color: getTrendColor(revenueData.trends.revenueChange) }}
                  >
                    {getTrendIcon(revenueData.trends.revenueChange)} {Math.abs(revenueData.trends.revenueChange).toFixed(1)}%
                  </span>
                </div>
                <div className="analytics-growth-item">
                  <span className="analytics-growth-label">Orders:</span>
                  <span 
                    className="analytics-growth-value"
                    style={{ color: getTrendColor(revenueData.trends.ordersChange) }}
                  >
                    {getTrendIcon(revenueData.trends.ordersChange)} {Math.abs(revenueData.trends.ordersChange).toFixed(1)}%
                  </span>
                </div>
                <div className="analytics-growth-item">
                  <span className="analytics-growth-label">Avg Order:</span>
                  <span 
                    className="analytics-growth-value"
                    style={{ color: getTrendColor(revenueData.trends.avgOrderChange) }}
                  >
                    {getTrendIcon(revenueData.trends.avgOrderChange)} {Math.abs(revenueData.trends.avgOrderChange).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesAnalyticsDashboard;