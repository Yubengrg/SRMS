// src/components/orders/KitchenView.jsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Button, notification, Typography, Tag, Space, Table, Divider, Empty, Spin, Switch } from 'antd';
import { ClockCircleOutlined, CheckOutlined, ExclamationCircleOutlined, BellOutlined } from '@ant-design/icons';
import moment from 'moment';
import { subscribeToOrders, refreshOrders } from '../services/globalOrderState';
import { updateOrderItemStatus } from '../services/api';

const { Title, Text } = Typography;

const KitchenView = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  useEffect(() => {
    console.log('KitchenView: Setting up subscription to global order state');
    
    // Subscribe to global order state
    const unsubscribe = subscribeToOrders((orderData) => {
      console.log('KitchenView: Received order update');
      
      // Combine all active orders that have items needing preparation
      const activeOrders = [
        ...(orderData.pending || []),
        ...(orderData.inProgress || [])
      ];
      
      // Filter orders with items that need preparation
      const ordersForKitchen = activeOrders.filter(order => {
        // Include if any items are pending or in-progress
        return order.items && order.items.some(item => 
          item.status === 'pending' || item.status === 'in-progress'
        );
      });
      
      setOrders(ordersForKitchen);
      setLoading(false);
      
      // Play notification for new orders if needed
      if (ordersForKitchen.length > orders.length) {
        playNotification();
      }
    });
    
    // Set up auto-refresh interval
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refreshOrders();
        }
      }, 30000);
    }
    
    // Initial fetch
    refreshOrders();
    
    // Clean up on unmount
    return () => {
      console.log('KitchenView: Cleaning up subscriptions');
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);
  
  // Play audio notification for new orders
  const playNotification = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.error('Error playing notification sound:', e));
    } catch (error) {
      console.error('Error with audio notification:', error);
    }
  };
  
  // Handle item status change
  const handleItemStatusChange = async (orderId, itemId, newStatus) => {
    try {
      console.log(`Changing item ${itemId} in order ${orderId} to status ${newStatus}`);
      setLoading(true);
      
      const response = await updateOrderItemStatus(orderId, itemId, newStatus);
      
      if (response && response.success) {
        notification.success({
          message: 'Success',
          description: `Item marked as ${newStatus}`
        });
        refreshOrders();
      } else {
        notification.error({
          message: 'Error',
          description: response.message || 'Failed to update item status'
        });
        // Manual refresh as fallback
        refreshOrders();
      }
    } catch (error) {
      console.error('Error updating item status:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to update item status'
      });
      // Manual refresh as fallback
      refreshOrders();
    } finally {
      setLoading(false);
    }
  };
  
  // Get time elapsed since order was created
  const getTimeElapsed = (createdAt) => {
    if (!createdAt) return 'Unknown';
    
    try {
      const created = moment(createdAt);
      const now = moment();
      const duration = moment.duration(now.diff(created));
      
      const minutes = Math.floor(duration.asMinutes());
      
      if (minutes < 60) {
        return `${minutes} min`;
      } else {
        const hours = Math.floor(duration.asHours());
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
      }
    } catch (error) {
      console.error('Error calculating time elapsed:', error);
      return 'Invalid time';
    }
  };
  
  // Get warning level based on time elapsed
  const getTimeWarningLevel = (createdAt) => {
    if (!createdAt) return 'error';
    
    try {
      const created = moment(createdAt);
      const now = moment();
      const minutesElapsed = moment.duration(now.diff(created)).asMinutes();
      
      if (minutesElapsed > 30) {
        return 'error';
      } else if (minutesElapsed > 15) {
        return 'warning';
      } else {
        return 'success';
      }
    } catch (error) {
      console.error('Error calculating time warning level:', error);
      return 'error';
    }
  };
  
  // Render order card for kitchen
  const renderOrderCard = (order) => {
    if (!order || !order._id) {
      console.warn('Invalid order object:', order);
      return null;
    }
    
    const timeWarningLevel = getTimeWarningLevel(order.createdAt);
    
    // Filter items that need preparation (pending or in-progress)
    const activeItems = order.items.filter(item => 
      item && (item.status === 'pending' || item.status === 'in-progress')
    );
    
    if (activeItems.length === 0) {
      return null; // Don't show orders with no active items
    }
    
    return (
      <Card 
        key={order._id} 
        className="kitchen-order-card" 
        style={{ 
          marginBottom: 16,
          borderLeft: order.priority > 0 ? 
            `4px solid ${order.priority === 2 ? 'red' : 'orange'}` : undefined
        }}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Text strong style={{ fontSize: 16 }}>#{order.orderNumber || 'New Order'}</Text>
                {order.table ? (
                  <Tag color="blue">Table {order.table.tableNumber || (order.tableName && order.tableName.replace('Table ', ''))}</Tag>
                ) : (
                  <Tag color="purple">Takeaway</Tag>
                )}
                
                {order.priority > 0 && (
                  <Tag color={order.priority === 2 ? "red" : "orange"}>
                    {order.priority === 2 ? "URGENT" : "HIGH PRIORITY"}
                  </Tag>
                )}
              </Space>
              
              <Space>
                <Badge 
                  status={timeWarningLevel} 
                  text={<Text type={timeWarningLevel === 'error' ? 'danger' : undefined}>
                    {getTimeElapsed(order.createdAt)}
                  </Text>} 
                />
                <ClockCircleOutlined style={{ 
                  color: timeWarningLevel === 'error' ? '#ff4d4f' : 
                         timeWarningLevel === 'warning' ? '#faad14' : '#52c41a'
                }} />
              </Space>
            </div>
          </Col>
          
          <Col span={24}>
            <Table 
              dataSource={activeItems} 
              pagination={false}
              size="small"
              rowKey={record => record._id || `temp-${Math.random()}`}
              columns={[
                {
                  title: 'Item',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text, record) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{text}</Text>
                      {record.specialInstructions && (
                        <Text type="secondary" italic style={{ fontSize: 12 }}>
                          Note: {record.specialInstructions}
                        </Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: 'Qty',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 60,
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  width: 120,
                  render: (status) => (
                    <Badge 
                      status={status === 'pending' ? 'warning' : 'processing'} 
                      text={status === 'pending' ? 'Pending' : 'Preparing'} 
                    />
                  ),
                },
                {
                  title: 'Action',
                  key: 'action',
                  width: 100,
                  render: (_, record) => {
                    const nextStatus = record.status === 'pending' ? 'in-progress' : 'ready';
                    const btnText = record.status === 'pending' ? 'Start' : 'Ready';
                    const btnType = record.status === 'pending' ? 'primary' : 'success';
                    
                    return (
                      <Button 
                        type={btnType}
                        size="small"
                        onClick={() => handleItemStatusChange(order._id, record._id, nextStatus)}
                        disabled={loading}
                      >
                        {btnText}
                      </Button>
                    );
                  },
                },
              ]}
            />
          </Col>
          
          <Col span={24} style={{ textAlign: 'right' }}>
            <Space>
              <Button 
                type="primary"
                onClick={() => {
                  // Mark all pending items as in-progress
                  if (!loading) {
                    const pendingItems = order.items.filter(item => item && item.status === 'pending');
                    
                    if (pendingItems.length > 0) {
                      pendingItems.forEach(item => {
                        handleItemStatusChange(order._id, item._id, 'in-progress');
                      });
                    } else {
                      notification.info({
                        message: 'Info',
                        description: 'No pending items to start'
                      });
                    }
                  }
                }}
                disabled={loading || !order.items.some(item => item && item.status === 'pending')}
              >
                Start All Pending
              </Button>
              
              <Button 
                type="success"
                onClick={() => {
                  // Mark all in-progress items as ready
                  if (!loading) {
                    const inProgressItems = order.items.filter(item => item && item.status === 'in-progress');
                    
                    if (inProgressItems.length > 0) {
                      inProgressItems.forEach(item => {
                        handleItemStatusChange(order._id, item._id, 'ready');
                      });
                    } else {
                      notification.info({
                        message: 'Info',
                        description: 'No in-progress items to complete'
                      });
                    }
                  }
                }}
                disabled={loading || !order.items.some(item => item && item.status === 'in-progress')}
              >
                Complete Order
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };
  
  return (
    <Card className="kitchen-view-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Kitchen Orders</Title>
        <Space>
          <Switch 
            checkedChildren="Auto Refresh" 
            unCheckedChildren="Manual Refresh" 
            checked={autoRefresh}
            onChange={setAutoRefresh}
          />
          <Button type="primary" onClick={refreshOrders} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>
      
      <Divider />
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading kitchen orders...</div>
        </div>
      ) : !Array.isArray(orders) || orders.length === 0 ? (
        <Empty description="No active orders for kitchen" />
      ) : (
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '0 1px' }}>
          {orders.map(order => renderOrderCard(order)).filter(Boolean)}
        </div>
      )}
    </Card>
  );
};

export default KitchenView;