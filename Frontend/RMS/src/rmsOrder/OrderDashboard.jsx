// Updated OrderDashboard.jsx with Cancelled tab
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, Row, Col, Tabs, Button, notification, Typography, 
  Space, Input, Select, Empty, Spin, Tag 
} from 'antd';
import { 
  ClockCircleOutlined, CheckCircleOutlined, DollarOutlined, 
  ShoppingCartOutlined, SearchOutlined, CloseCircleOutlined 
} from '@ant-design/icons';
import { updateOrderStatus } from '../services/api';
import { subscribeToOrders, refreshOrders } from '../services/globalOrderState';
import OrderCard from './OrderCard';
import OrderDetailsModal from './OrderDetailsModal';
import './OrderDashboard.css';

const { TabPane } = Tabs;
const { Title } = Typography;
const { Option } = Select;

const OrderDashboard = ({ inDashboard = false, isActive = true }) => {
  const [orders, setOrders] = useState({
    pending: [],
    inProgress: [],
    ready: [],
    served: [],
    cancelled: [] // Add cancelled orders state
  });
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const navigate = useNavigate();

  // Subscribe to order updates - ENHANCED to include cancelled orders
  useEffect(() => {
    console.log('OrderDashboard: Setting up subscription to global order state');
    
    // Subscribe to global order state
    const unsubscribe = subscribeToOrders((orderData) => {
      console.log('OrderDashboard: Received order update', {
        pending: orderData.pending?.length || 0,
        inProgress: orderData.inProgress?.length || 0,
        ready: orderData.ready?.length || 0,
        served: orderData.served?.length || 0,
        cancelled: orderData.cancelled?.length || 0,
      });
      
      setOrders({
        pending: orderData.pending || [],
        inProgress: orderData.inProgress || [],
        ready: orderData.ready || [],
        served: orderData.served || [],
        cancelled: orderData.cancelled || [] // Include cancelled orders
      });
      setLoading(false);
    });
    
    // Clean up subscription on unmount
    return () => {
      console.log('OrderDashboard: Cleaning up subscription');
      unsubscribe();
    };
  }, []); // Empty dependency array - run once on mount
  
  // Refresh orders when tab becomes active
  useEffect(() => {
    if (isActive) {
      console.log('OrderDashboard: Tab is active, refreshing orders');
      refreshOrders();
    }
  }, [isActive]);
  
  // View order details
  const handleViewDetails = (order) => {
    console.log('Viewing order details:', order._id);
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };
  
  // Update order status - ENHANCED to handle cancelled orders
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      console.log(`Changing order ${orderId} status to ${newStatus}`);
      setLoading(true);
      
      // 1. Optimistically update UI immediately
      const optimisticUpdate = (prevOrders) => {
        // Create copy of order lists
        const updatedOrders = {
          pending: [...prevOrders.pending],
          inProgress: [...prevOrders.inProgress],
          ready: [...prevOrders.ready],
          served: [...prevOrders.served],
          cancelled: [...prevOrders.cancelled] // Include cancelled
        };
        
        // Find the order in all lists
        let targetOrder = null;
        let currentStatus = '';
        
        // Check each status list for the order
        for (const status in updatedOrders) {
          const index = updatedOrders[status].findIndex(o => o._id === orderId);
          if (index !== -1) {
            targetOrder = { ...updatedOrders[status][index] };
            currentStatus = status === 'inProgress' ? 'in-progress' : status;
            // Remove from current status list
            updatedOrders[status].splice(index, 1);
            break;
          }
        }
        
        // If order found, update its status and add to new list
        if (targetOrder) {
          targetOrder.status = newStatus;
          
          // Add to appropriate list based on new status
          switch (newStatus) {
            case 'pending':
              updatedOrders.pending.push(targetOrder);
              break;
            case 'in-progress':
              updatedOrders.inProgress.push(targetOrder);
              break;
            case 'ready':
              updatedOrders.ready.push(targetOrder);
              break;
            case 'served':
              updatedOrders.served.push(targetOrder);
              break;
            case 'cancelled':
              updatedOrders.cancelled.push(targetOrder);
              break;
            // Don't add to any list if completed
          }
        }
        
        return updatedOrders;
      };
      
      // Apply optimistic update
      setOrders(prevOrders => optimisticUpdate(prevOrders));
      
      // 2. Make actual API call
      const response = await updateOrderStatus(orderId, newStatus, '');
      
      // 3. Handle response
      if (response && response.success) {
        notification.success({
          message: 'Success',
          description: `Order status updated to ${newStatus}`
        });
        
        // Update selected order if in detail view
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(prev => ({
            ...prev,
            status: newStatus
          }));
        }
        
        // 4. Manually trigger a refresh for complete data sync
        setTimeout(() => {
          refreshOrders();
        }, 500);
      } else {
        notification.error({
          message: 'Error',
          description: (response && response.message) || 'Failed to update order status'
        });
        // Immediate refresh to revert optimistic update
        refreshOrders();
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error updating order';
      notification.error({
        message: 'Error',
        description: errorMessage
      });
      // Immediate refresh to revert optimistic update
      refreshOrders();
    } finally {
      setLoading(false);
    }
  };
  
  // Filter orders based on search term and filter type
  const filterOrders = (ordersList) => {
    if (!Array.isArray(ordersList)) {
      console.warn('filterOrders received non-array:', ordersList);
      return [];
    }
    
    return ordersList.filter(order => {
      if (!order) return false;
      
      // Search filter
      const matchesSearch = !searchTerm || 
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.tableName && order.tableName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.table?.tableNumber && order.table.tableNumber.toString().includes(searchTerm)) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.customer?.name && order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Order type filter
      const matchesType = filterType === 'all' || 
        (filterType === 'dine-in' && order.table) ||
        (filterType === 'takeaway' && !order.table);
      
      return matchesSearch && matchesType;
    });
  };
  
  // Render order list - ENHANCED to handle cancelled orders
  const renderOrderList = (ordersList, status) => {
    const filteredOrders = filterOrders(ordersList);
    
    if (filteredOrders.length === 0) {
      return (
        <Empty 
          description={
            <span style={{ color: 'var(--text-color-light, #A5B1CD)' }}>
              {status === 'cancelled' ? 'No cancelled orders' : `No ${status} orders`}
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      );
    }
    
    return (
      <div className="order-cards-container" style={{ 
        overflowY: 'auto', 
        maxHeight: inDashboard ? 'calc(100vh - 300px)' : 'calc(100vh - 250px)' 
      }}>
        {filteredOrders.map(order => (
          <OrderCard
            key={order._id}
            order={order}
            onViewDetails={() => handleViewDetails(order)}
            onStatusChange={status === 'cancelled' ? null : handleStatusChange} // Disable status change for cancelled orders
            currentStatus={status}
            isCancelled={status === 'cancelled'} // Pass cancelled flag
          />
        ))}
      </div>
    );
  };
  
  return (
    <div className={inDashboard ? "dashboard-content-section" : "order-management-container"}>
      {!inDashboard && (
        <header className="order-header">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate('/dashboard')}>
              &larr; Back to Dashboard
            </button>
            <h1>Order Management</h1>
          </div>
        </header>
      )}
      
      <Card className={inDashboard ? "dashboard-content-card" : "order-dashboard-card"}>
        <div className={inDashboard ? "dashboard-card-header" : "order-dashboard-header"}>
          {!inDashboard && <Title level={4} style={{ color: 'var(--text-color-dark, #FFFFFF)' }}>Order Management</Title>}
          <Space>
            <Input
              placeholder="Search orders..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 200 }}
              className="dark-theme-input"
            />
            <Select
              defaultValue="all"
              style={{ width: 120 }}
              onChange={setFilterType}
              placeholder="Filter by type"
              className="dark-theme-select"
            >
              <Option value="all">All Orders</Option>
              <Option value="dine-in">Dine In</Option>
              <Option value="takeaway">Takeaway</Option>
            </Select>
            <Button 
              type="primary" 
              onClick={refreshOrders} 
              loading={loading}
              className="primary-button"
            >
              Refresh
            </Button>
          </Space>
        </div>
        
        <Tabs defaultActiveKey="pending" type="card" className="dark-theme-tabs">
          <TabPane 
            tab={
              <span>
                <ClockCircleOutlined />
                Pending ({orders.pending.length})
              </span>
            } 
            key="pending"
          >
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <div className="loading-text">Loading pending orders...</div>
              </div>
            ) : (
              renderOrderList(orders.pending, 'pending')
            )}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <ShoppingCartOutlined />
                In Progress ({orders.inProgress.length})
              </span>
            } 
            key="inProgress"
          >
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <div className="loading-text">Loading in-progress orders...</div>
              </div>
            ) : (
              renderOrderList(orders.inProgress, 'in-progress')
            )}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <CheckCircleOutlined />
                Ready ({orders.ready.length})
              </span>
            } 
            key="ready"
          >
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <div className="loading-text">Loading ready orders...</div>
              </div>
            ) : (
              renderOrderList(orders.ready, 'ready')
            )}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <DollarOutlined />
                Served ({orders.served.length})
              </span>
            } 
            key="served"
          >
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <div className="loading-text">Loading served orders...</div>
              </div>
            ) : (
              renderOrderList(orders.served, 'served')
            )}
          </TabPane>
          
          {/* NEW CANCELLED TAB */}
          <TabPane 
            tab={
              <span>
                <CloseCircleOutlined />
                Cancelled ({orders.cancelled.length})
              </span>
            } 
            key="cancelled"
          >
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <div className="loading-text">Loading cancelled orders...</div>
              </div>
            ) : (
              renderOrderList(orders.cancelled, 'cancelled')
            )}
          </TabPane>
        </Tabs>
      </Card>
      
      {selectedOrder && (
        <OrderDetailsModal
          visible={showDetailsModal}
          order={selectedOrder}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOrder(null);
          }}
          onStatusChange={selectedOrder.status === 'cancelled' ? null : handleStatusChange} // Disable for cancelled orders
          onRefresh={refreshOrders}
          isCancelled={selectedOrder.status === 'cancelled'} // Pass cancelled flag to modal
        />
      )}
    </div>
  );
};

export default OrderDashboard;