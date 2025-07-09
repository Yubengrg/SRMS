// Updated OrderCard.jsx with cancelled order handling
import React from 'react';
import { Card, Badge, Button, Typography, Space, Tag, Tooltip } from 'antd';
import { 
  ClockCircleOutlined, UserOutlined, TableOutlined, 
  DollarOutlined, RightOutlined, EyeOutlined, StopOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Text } = Typography;

const OrderCard = ({ order, onViewDetails, onStatusChange, currentStatus, isCancelled = false }) => {
  // Validate order object to prevent runtime errors
  if (!order) {
    console.error('OrderCard received null or undefined order');
    return null;
  }
  
  // Status badges
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge status="warning" text="Pending" />;
      case 'in-progress':
        return <Badge status="processing" text="In Progress" />;
      case 'ready':
        return <Badge status="success" text="Ready" />;
      case 'served':
        return <Badge status="default" text="Served" />;
      case 'completed':
        return <Badge status="success" text="Completed" />;
      case 'cancelled':
        return <Badge status="error" text="Cancelled" />;
      default:
        return <Badge status="default" text={status || 'Unknown'} />;
    }
  };
  
  // Payment status badge
  const getPaymentBadge = (status) => {
    // For cancelled orders, show a different payment status
    if (isCancelled) {
      switch (status) {
        case 'paid':
          return <Tag color="orange">Paid (Refund Required)</Tag>;
        case 'pending':
          return <Tag color="red">Cancelled</Tag>;
        default:
          return <Tag color="red">Cancelled</Tag>;
      }
    }
    
    switch (status) {
      case 'paid':
        return <Tag color="green">Paid</Tag>;
      case 'pending':
        return <Tag color="orange">Not Paid</Tag>;
      case 'failed':
        return <Tag color="red">Failed</Tag>;
      case 'refunded':
        return <Tag color="purple">Refunded</Tag>;
      default:
        return <Tag color="default">{status || 'Unknown'}</Tag>;
    }
  };
  
  // Priority badge
  const getPriorityBadge = (priority) => {
    // Don't show priority for cancelled orders
    if (isCancelled) return null;
    
    switch (priority) {
      case 0:
        return null; // No badge for normal priority
      case 1:
        return <Tag color="orange">High Priority</Tag>;
      case 2:
        return <Tag color="red">Urgent</Tag>;
      default:
        return null;
    }
  };
  
  // Next status action button - DISABLED for cancelled orders
  const getNextStatusButton = () => {
    // Don't show action buttons for cancelled orders
    if (isCancelled || currentStatus === 'cancelled') {
      return (
        <Tooltip title="This order has been cancelled">
          <Button 
            type="default" 
            size="small"
            disabled
            icon={<StopOutlined />}
          >
            Cancelled
          </Button>
        </Tooltip>
      );
    }
    
    let nextStatus, buttonText, buttonType;
    
    switch (currentStatus) {
      case 'pending':
        nextStatus = 'in-progress';
        buttonText = 'Start';
        buttonType = 'primary';
        break;
      case 'in-progress':
        nextStatus = 'ready';
        buttonText = 'Ready';
        buttonType = 'success';
        break;
      case 'ready':
        nextStatus = 'served';
        buttonText = 'Served';
        buttonType = 'default';
        break;
      case 'served':
        nextStatus = 'completed';
        buttonText = 'Complete';
        buttonType = 'default';
        break;
      default:
        return null;
    }
    
    return (
      <Button 
        type={buttonType} 
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          if (onStatusChange) {
            onStatusChange(order._id, nextStatus);
          }
        }}
        disabled={!onStatusChange} // Disable if no handler provided
      >
        {buttonText}
      </Button>
    );
  };
  
  // Calculate time since order was created
  const getTimeSinceCreated = () => {
    if (!order.createdAt) return 'Unknown time';
    
    try {
      const createdTime = moment(order.createdAt);
      const now = moment();
      const duration = moment.duration(now.diff(createdTime));
      
      const minutes = Math.floor(duration.asMinutes());
      
      if (minutes < 60) {
        return `${minutes} min ago`;
      } else {
        const hours = Math.floor(duration.asHours());
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m ago`;
      }
    } catch (error) {
      console.error('Error calculating time since created:', error);
      return 'Invalid time';
    }
  };
  
  // Helper function to safely get customer name
  const getCustomerName = () => {
    if (order.customer && order.customer.name) {
      return order.customer.name;
    }
    return 'Guest';
  };
  
  // Helper function to safely get table info
  const getTableInfo = () => {
    if (order.table) {
      return order.table.tableNumber || (order.tableName || 'Unknown');
    }
    return null;
  };
  
  // Get cancellation info for cancelled orders
  const getCancellationInfo = () => {
    if (!isCancelled) return null;
    
    // Find cancellation in processing history
    const cancellationHistory = order.processingHistory?.find(
      history => history.status === 'cancelled'
    );
    
    if (cancellationHistory) {
      return {
        cancelledAt: cancellationHistory.timestamp,
        cancelledBy: cancellationHistory.user,
        reason: cancellationHistory.note
      };
    }
    
    return null;
  };
  
  const cancellationInfo = getCancellationInfo();
  
  return (
    <Card 
      className={`order-card status-${currentStatus} ${isCancelled ? 'cancelled-order' : ''}`}
      style={{ 
        cursor: 'pointer',
        borderLeft: isCancelled ? 
          '4px solid #ff4d4f' : // Red border for cancelled orders
          (order.priority > 0 ? 
            `4px solid ${order.priority === 1 ? 'orange' : 'red'}` : undefined),
        opacity: isCancelled ? 0.8 : 1, // Slightly faded for cancelled orders
        background: isCancelled ? 
          'linear-gradient(135deg, rgba(255, 77, 79, 0.05) 0%, rgba(255, 77, 79, 0.02) 100%)' : 
          undefined
      }}
      onClick={() => onViewDetails(order)}
      hoverable={!isCancelled}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <Space>
            <Text 
              strong 
              style={{ 
                fontSize: 16,
                textDecoration: isCancelled ? 'line-through' : 'none',
                color: isCancelled ? '#ff4d4f' : undefined
              }}
            >
              #{order.orderNumber || 'New Order'}
            </Text>
            {isCancelled && (
              <Tag color="red" style={{ fontSize: '10px' }}>
                CANCELLED
              </Tag>
            )}
          </Space>
          
          <div style={{ marginTop: 4 }}>
            {getTableInfo() ? (
              <Space>
                <TableOutlined />
                <Text>Table {getTableInfo()}</Text>
              </Space>
            ) : (
              <Tag color="geekblue">Takeaway</Tag>
            )}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <Text style={{ display: 'block', fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {getTimeSinceCreated()}
          </Text>
          <Text 
            strong
            style={{ 
              textDecoration: isCancelled ? 'line-through' : 'none',
              color: isCancelled ? '#ff4d4f' : undefined
            }}
          >
            NPR{(order.totalAmount || 0).toFixed(2)}
          </Text>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <Space>
          {getStatusBadge(order.status)}
          {getPaymentBadge(order.paymentStatus)}
          {getPriorityBadge(order.priority)}
        </Space>
        
        <Space>
          {order.customer && (
            <Space size={2}>
              <UserOutlined />
              <Text style={{ fontSize: 12 }}>{getCustomerName()}</Text>
            </Space>
          )}
        </Space>
      </div>
      
      {/* Show cancellation info for cancelled orders */}
      {isCancelled && cancellationInfo && (
        <div style={{ 
          marginTop: 8, 
          padding: '6px 8px', 
          background: 'rgba(255, 77, 79, 0.1)', 
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          <Text type="secondary">
            Cancelled {moment(cancellationInfo.cancelledAt).fromNow()} by {cancellationInfo.cancelledBy}
          </Text>
          {cancellationInfo.reason && (
            <div style={{ marginTop: '2px' }}>
              <Text type="secondary" italic>
                Reason: {cancellationInfo.reason}
              </Text>
            </div>
          )}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div>
          <Text type="secondary">
            Items: {order.items?.length || 0}
            {isCancelled && (
              <Text type="danger" style={{ marginLeft: 8, fontSize: '10px' }}>
                (All Cancelled)
              </Text>
            )}
          </Text>
        </div>
        <Space>
          {getNextStatusButton()}
          <Button 
            type="text" 
            icon={isCancelled ? <EyeOutlined /> : <RightOutlined />} 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(order);
            }}
          >
            {isCancelled ? 'View' : ''}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default OrderCard;