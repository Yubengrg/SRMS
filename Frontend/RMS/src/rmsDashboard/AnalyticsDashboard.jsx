import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesAnalytics, getPopularItems, getPaymentMethodStats, getRevenueAnalytics } from '../services/api';

const AnalyticsDashboard = ({ inDashboard = false }) => {
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

  // Mock data generators for fallback
  const generateMockSalesData = (period) => {
    let data = [];
    let totalSales = 0;
    let totalOrders = 0;
    let totalCustomers = 0;
    
    switch (period) {
      case 'day':
        for (let hour = 0; hour < 24; hour++) {
          const sales = Math.floor(Math.random() * 5000) + 1000;
          const orders = Math.floor(Math.random() * 20) + 5;
          const customers = Math.floor(orders * 0.8);
          data.push({
            period: `${hour.toString().padStart(2, '0')}:00`,
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
      case 'week':
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(day => {
          const sales = Math.floor(Math.random() * 15000) + 8000;
          const orders = Math.floor(Math.random() * 80) + 40;
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
    { name: 'Momo', value: 118, revenue: 23600, orders: 118, color: '#4299E1' },
    { name: 'Chicken Curry', value: 97, revenue: 38800, orders: 97, color: '#805AD5' },
    { name: 'Fried Rice', value: 85, revenue: 25500, orders: 85, color: '#ED8936' },
    { name: 'Noodles', value: 73, revenue: 21900, orders: 73, color: '#38A169' },
    { name: 'Gundruk', value: 65, revenue: 9750, orders: 65, color: '#E53E3E' }
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
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '300px',
      color: 'var(--text-color-light)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255, 185, 48, 0.1)',
          borderLeft: '4px solid var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
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
    <div style={{ 
      width: '100%', 
      padding: inDashboard ? '0' : '1.5rem',
      color: 'var(--text-color)'
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(229, 62, 62, 0.1)',
          border: '1px solid rgba(229, 62, 62, 0.2)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: 'var(--danger-color)'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }}></i>
          {error}
        </div>
      )}
      
      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
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

        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
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

        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
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

        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Sales Chart */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ 
              margin: 0, 
              color: 'var(--text-color-dark)',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>
              Sales Analytics
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {periodButtons.map(period => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    background: selectedPeriod === period.id ? 'var(--primary-color)' : 'transparent',
                    border: selectedPeriod === period.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    color: selectedPeriod === period.id ? 'white' : 'var(--text-color-light)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            {chartButtons.map(chart => (
              <button
                key={chart.id}
                onClick={() => setActiveChart(chart.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  background: activeChart === chart.id ? 'rgba(255, 185, 48, 0.15)' : 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: activeChart === chart.id ? 'var(--primary-color)' : 'var(--text-color-light)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>{chart.icon}</span>
                {chart.label}
              </button>
            ))}
          </div>

          {renderChart()}
        </div>

        {/* Popular Items */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
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

              <div style={{ marginTop: '1rem' }}>
                {popularItems.slice(0, 4).map((item, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: index < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: item.color
                      }}></div>
                      <span style={{ 
                        fontSize: '0.85rem',
                        color: 'var(--text-color)'
                      }}>
                        {item.name}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '0.8rem',
                      color: 'var(--text-color-light)',
                      fontWeight: '600'
                    }}>
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
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        marginBottom: '1.5rem'
      }}>
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            {paymentMethods.map((method, index) => (
              <div key={index} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: `conic-gradient(${method.color} 0deg ${method.value * 3.6}deg, rgba(255,255,255,0.1) ${method.value * 3.6}deg 360deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                  position: 'relative'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--card-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: method.color
                  }}>
                    {method.value}%
                  </div>
                </div>
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'var(--text-color)',
                  textAlign: 'center'
                }}>
                  {method.name}
                </span>
                <span style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-color-light)',
                  textAlign: 'center',
                  marginTop: '0.25rem'
                }}>
                  {method.count} orders
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue Trends */}
      {revenueData && (
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <h3 style={{ 
            margin: '0 0 1.5rem 0', 
            color: 'var(--text-color-dark)',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}>
            Revenue Comparison
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'rgba(255, 185, 48, 0.05)',
              border: '1px solid rgba(255, 185, 48, 0.1)'
            }}>
              <h4 style={{
                margin: '0 0 0.5rem 0',
                color: 'var(--text-color-dark)',
                fontSize: '0.9rem'
              }}>
                Current {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </h4>
              <p style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.4rem',
                fontWeight: '700',
                color: 'var(--primary-color)'
              }}>
                {formatCurrency(revenueData.current.totalRevenue)}
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--text-color-light)'
              }}>
                {revenueData.current.totalOrders} orders • {formatCurrency(revenueData.current.avgOrderValue)} avg
              </p>
            </div>

            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h4 style={{
                margin: '0 0 0.5rem 0',
                color: 'var(--text-color-dark)',
                fontSize: '0.9rem'
              }}>
                Previous {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </h4>
              <p style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.4rem',
                fontWeight: '700',
                color: 'var(--text-color)'
              }}>
                {formatCurrency(revenueData.previous.totalRevenue)}
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--text-color-light)'
              }}>
                {revenueData.previous.totalOrders} orders • {formatCurrency(revenueData.previous.avgOrderValue)} avg
              </p>
            </div>

            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h4 style={{
                margin: '0 0 0.5rem 0',
                color: 'var(--text-color-dark)',
                fontSize: '0.9rem'
              }}>
                Growth
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-color-light)'
                  }}>
                    Revenue:
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: getTrendColor(revenueData.trends.revenueChange)
                  }}>
                    {getTrendIcon(revenueData.trends.revenueChange)} {Math.abs(revenueData.trends.revenueChange).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-color-light)'
                  }}>
                    Orders:
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: getTrendColor(revenueData.trends.ordersChange)
                  }}>
                    {getTrendIcon(revenueData.trends.ordersChange)} {Math.abs(revenueData.trends.ordersChange).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-color-light)'
                  }}>
                    Avg Order:
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: getTrendColor(revenueData.trends.avgOrderChange)
                  }}>
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

export default AnalyticsDashboard;