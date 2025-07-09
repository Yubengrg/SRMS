// Updated OrderDetailsModal.jsx with cancelled order handling
import React, { useState, useEffect } from 'react';
import { 
  Modal, Button, Descriptions, Table, Tag, Space, Typography, 
  Divider, Timeline, Form, Select, notification, Steps, Card, 
  Row, Col, Statistic, Collapse, Input, Spin, Empty, Badge, Alert
} from 'antd';
import { 
  CheckCircleOutlined, ClockCircleOutlined, PrinterOutlined, 
  ExclamationCircleOutlined, EditOutlined, SaveOutlined, 
  HistoryOutlined, ReloadOutlined, CopyOutlined, EyeOutlined, 
  DownloadOutlined, CheckOutlined, CloseOutlined, StopOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { 
  updateOrderStatus, 
  updateOrderItemStatus,
  confirmCashPayment, 
  getOrderPaymentDetails, 
  verifyPayment,
  API_URL
} from '../services/api';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { Step } = Steps;

const OrderDetailsModal = ({ visible, order, onClose, onRefresh, isCancelled = false }) => {
  const [loading, setLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentForm] = Form.useForm();
  const [editingItem, setEditingItem] = useState(null);
  
  // Payment-related state
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  
  // Validation check for order object
  if (!order) {
    console.error('OrderDetailsModal received null or undefined order');
    return null;
  }
  
  // Check if order is cancelled
  const isOrderCancelled = isCancelled || order.status === 'cancelled';
  
  // Fetch payment details when modal opens (disabled for cancelled orders)
  useEffect(() => {
    if (visible && order?._id && !isOrderCancelled) {
      fetchPaymentDetails();
    }
  }, [visible, order, isOrderCancelled]);
  
  // Fetch payment details
  const fetchPaymentDetails = async () => {
    if (isOrderCancelled) return; // Don't fetch for cancelled orders
    
    try {
      setLoadingPayment(true);
      console.log('Fetching payment details for order:', order._id);
      const response = await getOrderPaymentDetails(order._id);
      
      if (response.success) {
        console.log('Payment details fetched:', response.payment);
        setPaymentDetails(response.payment);
      } else {
        console.log('No payment details found:', response.message);
        setPaymentDetails(null);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
      setPaymentDetails(null);
    } finally {
      setLoadingPayment(false);
    }
  };

  // Disabled payment functions for cancelled orders
  const handleCashPaymentConfirm = async () => {
    if (isOrderCancelled) {
      notification.warning({
        message: 'Action Disabled',
        description: 'Cannot process payment for cancelled orders'
      });
      return;
    }
    
    Modal.confirm({
      title: 'Confirm Cash Payment',
      content: 'Mark this order as paid in cash?',
      onOk: async () => {
        try {
          setLoading(false);
        }
        catch{

        }
      }
    });
  };

  // Handle payment verification (disabled for cancelled orders)
  const handlePaymentVerification = async (paymentId, action) => {
    if (isOrderCancelled) {
      notification.warning({
        message: 'Action Disabled',
        description: 'Cannot verify payment for cancelled orders'
      });
      return;
    }
    
    try {
      setLoadingPayment(true);
      console.log(`${action} payment:`, paymentId);
      
      const response = await verifyPayment(paymentId, { 
        action, 
        notes: action === 'approve' ? 'Payment verified by staff' : 'Payment verification failed' 
      });

      if (response.success) {
        notification.success({
          message: 'Success',
          description: `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        });
        fetchPaymentDetails();
        onRefresh();
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to verify payment'
      });
    } finally {
      setLoadingPayment(false);
    }
  };

  // Handle marking payment as paid (disabled for cancelled orders)
  const handleMarkAsPaid = async (paymentMethod = 'cash') => {
    if (isOrderCancelled) {
      notification.warning({
        message: 'Action Disabled',
        description: 'Cannot mark payment as paid for cancelled orders'
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await confirmCashPayment(order._id, {
        amount: order.totalAmount,
        receivedBy: 'Staff',
        paymentMethod: paymentMethod,
        notes: `Payment confirmed by staff via ${paymentMethod}`
      });

      if (response.success) {
        notification.success({
          message: 'Success',
          description: 'Payment marked as paid successfully'
        });
        setEditingPayment(false);
        fetchPaymentDetails();
        onRefresh();
      } else {
        notification.error({
          message: 'Error',
          description: response.message || 'Failed to mark payment as paid'
        });
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to mark payment as paid'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle payment form submission (disabled for cancelled orders)
  const handlePaymentFormSubmit = async (values) => {
    if (isOrderCancelled) {
      notification.warning({
        message: 'Action Disabled',
        description: 'Cannot update payment for cancelled orders'
      });
      return;
    }
    
    if (values.paymentStatus === 'paid') {
      await handleMarkAsPaid(values.paymentMethod);
    } else {
      notification.info({
        message: 'Info',
        description: 'Only "paid" status is currently supported for manual updates'
      });
    }
  };
  
  // Get order status display
  const getOrderStatusDisplay = (status) => {
    switch (status) {
      case 'pending':
        return <Tag color="orange">Pending</Tag>;
      case 'in-progress':
        return <Tag color="blue">In Progress</Tag>;
      case 'ready':
        return <Tag color="green">Ready</Tag>;
      case 'served':
        return <Tag color="cyan">Served</Tag>;
      case 'completed':
        return <Tag color="green">Completed</Tag>;
      case 'cancelled':
        return <Tag color="red">Cancelled</Tag>;
      default:
        return <Tag>{status || 'Unknown'}</Tag>;
    }
  };
  
  // Get item status display
  const getItemStatusDisplay = (status) => {
    switch (status) {
      case 'pending':
        return <Tag color="orange">Pending</Tag>;
      case 'in-progress':
        return <Tag color="blue">Preparing</Tag>;
      case 'ready':
        return <Tag color="green">Ready</Tag>;
      case 'served':
        return <Tag color="cyan">Served</Tag>;
      case 'cancelled':
        return <Tag color="red">Cancelled</Tag>;
      default:
        return <Tag>{status || 'Unknown'}</Tag>;
    }
  };
  
  // Get payment status display
  const getPaymentStatusDisplay = (status) => {
    if (isOrderCancelled) {
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
      case 'completed':
        return <Tag color="green">Paid</Tag>;
      case 'pending':
        return <Tag color="orange">Pending</Tag>;
      case 'processing':
        return <Tag color="blue">Processing</Tag>;
      case 'failed':
        return <Tag color="red">Failed</Tag>;
      case 'refunded':
        return <Tag color="purple">Refunded</Tag>;
      default:
        return <Tag color="default">{status || 'Unknown'}</Tag>;
    }
  };
  
  // Handle order status change (disabled for cancelled orders)
  const handleOrderStatusChange = async (orderId, newStatus) => {
    if (isOrderCancelled) {
      notification.warning({
        message: 'Action Disabled',
        description: 'Cannot change status of cancelled orders'
      });
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Changing order ${orderId} status to ${newStatus}`);
      const response = await updateOrderStatus(orderId, newStatus, '');
      
      if (response.success) {
        notification.success({
          message: 'Success',
          description: `Order status updated to ${newStatus}`
        });
        onRefresh();
      } else {
        notification.error({
          message: 'Error',
          description: response.message || 'Failed to update order status'
        });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to update order status'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle item status change (disabled for cancelled orders)
  const handleItemStatusChange = async (itemId, newStatus) => {
    if (isOrderCancelled) {
      notification.warning({
        message: 'Action Disabled',
        description: 'Cannot change item status for cancelled orders'
      });
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Changing item ${itemId} status to ${newStatus}`);
      
      const response = await updateOrderItemStatus(order._id, itemId, newStatus);
      
      if (response && response.success) {
        notification.success({
          message: 'Success',
          description: `Item status updated to ${newStatus}`
        });
        
        onRefresh();
      } else {
        notification.warning({
          message: 'Note',
          description: 'Item status was updated but there might be issues. The display will refresh momentarily.'
        });
        onRefresh();
      }
    } catch (error) {
      console.error('Error updating item status:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to update item status'
      });
      onRefresh();
    } finally {
      setLoading(false);
      setEditingItem(null);
    }
  };
  
  // Handle order cancellation (already cancelled orders don't need this)
  const handleCancelOrder = async () => {
  // Don't cancel if already cancelled
  if (order.status === 'cancelled') {
    notification.info({ message: 'Order already cancelled' });
    return;
  }
  
  // Simple confirmation
  const confirmed = window.confirm(`Are you sure you want to cancel order #${order.orderNumber}?`);
  if (!confirmed) return;
  
  try {
    setLoading(true);
    
    // Show loading message
    notification.info({ 
      key: 'cancelling', 
      message: 'Cancelling order...', 
      duration: 0 
    });
    
    // Get token and make API call
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/rms/orders/${order._id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'cancelled',
        note: 'Order cancelled by staff'
      })
    });
    
    const result = await response.json();
    notification.close('cancelling');
    
    if (result.success) {
      // Success! Order cancelled
      notification.success({ 
        message: '✅ Order Cancelled', 
        description: `Order #${order.orderNumber} has been cancelled and moved to cancelled tab.`,
        duration: 3
      });
      
      // Refresh the orders (this will move it to cancelled tab)
      if (onRefresh) {
        onRefresh();
      }
      
      // Close modal after short delay
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 1000);
      
    } else {
      throw new Error(result.message || 'Failed to cancel order');
    }
    
  } catch (error) {
    notification.close('cancelling');
    notification.error({ 
      message: '❌ Cancel Failed', 
      description: error.message || 'Could not cancel order. Please try again.',
      duration: 5
    });
    console.error('Cancel error:', error);
  } finally {
    setLoading(false);
  }
};
  
  // Handle print receipt
  const handlePrintReceipt = () => {
    const receiptWindow = window.open('', '_blank');
    
    let receiptContent = `
      <html>
        <head>
          <title>Receipt - ${order.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.3; }
            .header { text-align: center; margin-bottom: 20px; }
            .order-info { margin-bottom: 20px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items th, .items td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
            .total-row { font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; font-size: 10px; }
            .cancelled { color: #ff4d4f; text-decoration: line-through; }
            .cancelled-notice { background: #fff2f0; border: 1px solid #ffccc7; padding: 10px; margin: 10px 0; color: #ff4d4f; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${order.restaurant?.name || 'Restaurant Name'}</h2>
            <p>Order #${order.orderNumber}</p>
            <p>${moment(order.createdAt).format('MMM DD, YYYY HH:mm')}</p>
            ${isOrderCancelled ? '<div class="cancelled-notice"><strong>⚠️ THIS ORDER HAS BEEN CANCELLED</strong></div>' : ''}
          </div>
          
          <div class="order-info">
            <p><strong>Order Type:</strong> ${order.orderType}</p>
            ${order.table ? `<p><strong>Table:</strong> ${order.table.tableNumber}</p>` : ''}
            ${order.customer?.name ? `<p><strong>Customer:</strong> ${order.customer.name}</p>` : ''}
            <p><strong>Status:</strong> <span class="${isOrderCancelled ? 'cancelled' : ''}">${order.status?.toUpperCase()}</span></p>
          </div>
          
          <table class="items">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    // Add items
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemClass = isOrderCancelled || item.status === 'cancelled' ? 'cancelled' : '';
        receiptContent += `
          <tr class="${itemClass}">
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>NPR${item.price.toFixed(2)}</td>
            <td>NPR${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `;
        
        if (item.specialInstructions) {
          receiptContent += `
            <tr class="${itemClass}">
              <td colspan="4" style="font-size: 10px; font-style: italic; padding-left: 20px;">
                Note: ${item.specialInstructions}
              </td>
            </tr>
          `;
        }
      });
    }
    
    // Add totals
    const totalClass = isOrderCancelled ? 'cancelled' : '';
    receiptContent += `
            <tr class="${totalClass}">
              <td colspan="3" style="text-align: right;"><strong>Subtotal:</strong></td>
              <td>NPR${order.subTotal ? order.subTotal.toFixed(2) : '0.00'}</td>
            </tr>
            <tr class="${totalClass}">
              <td colspan="3" style="text-align: right;"><strong>Tax (${order.taxPercentage || 0}%):</strong></td>
              <td>NPR${order.taxAmount ? order.taxAmount.toFixed(2) : '0.00'}</td>
            </tr>
    `;
    
    if (order.discountAmount && order.discountAmount > 0) {
      receiptContent += `
            <tr class="${totalClass}">
              <td colspan="3" style="text-align: right;"><strong>Discount:</strong></td>
              <td>-NPR${order.discountAmount.toFixed(2)}</td>
            </tr>
      `;
    }
    
    if (order.serviceCharge && order.serviceCharge > 0) {
      receiptContent += `
            <tr class="${totalClass}">
              <td colspan="3" style="text-align: right;"><strong>Service Charge:</strong></td>
              <td>NPR${order.serviceCharge.toFixed(2)}</td>
            </tr>
      `;
    }
    
    receiptContent += `
            <tr class="total-row ${totalClass}">
              <td colspan="3" style="text-align: right;"><strong>TOTAL:</strong></td>
              <td>NPR${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</td>
            </tr>
          </tbody>
        </table>
        
        <div>
          <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Not specified'}</p>
          <p><strong>Payment Status:</strong> ${isOrderCancelled ? 'Cancelled' : (order.paymentStatus || 'Not specified')}</p>
        </div>
        
        ${isOrderCancelled ? '<div class="cancelled-notice">This order was cancelled and is void.</div>' : ''}
        
        <div class="footer">
          <p>Thank you for your visit!</p>
          <p>Generated on ${moment().format('MMM DD, YYYY HH:mm')}</p>
        </div>
      </body>
    </html>
    `;
    
    if (receiptWindow) {
      receiptWindow.document.write(receiptContent);
      receiptWindow.document.close();
      receiptWindow.focus();
      receiptWindow.print();
    } else {
      notification.error({
        message: 'Print Error',
        description: 'Unable to open print window. Please check your browser settings.'
      });
    }
  };
  
  // Define table columns for items (disabled editing for cancelled orders)
  const columns = [
    {
      title: 'Item',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text 
            strong 
            style={{ 
              textDecoration: isOrderCancelled || record.status === 'cancelled' ? 'line-through' : 'none',
              color: isOrderCancelled || record.status === 'cancelled' ? '#ff4d4f' : undefined
            }}
          >
            {text}
          </Text>
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
      width: 70,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => `NPR${(price || 0).toFixed(2)}`,
    },
    {
      title: 'Total',
      key: 'total',
      width: 100,
      render: (_, record) => `NPR${((record.price || 0) * (record.quantity || 0)).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getItemStatusDisplay(status),
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_, record) => {
        // Disable actions for cancelled orders
        if (isOrderCancelled) {
          return (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              No actions available
            </Text>
          );
        }
        
        if (editingItem === record._id) {
          return (
            <Select
              defaultValue={record.status}
              style={{ width: 120 }}
              onChange={(value) => handleItemStatusChange(record._id, value)}
              loading={loading}
            >
              <Option value="pending">Pending</Option>
              <Option value="in-progress">Preparing</Option>
              <Option value="ready">Ready</Option>
              <Option value="served">Served</Option>
              <Option value="cancelled">Cancel</Option>
            </Select>
          );
        }
        
        return (
          <Button
            type="link"
            size="small"
            onClick={() => setEditingItem(record._id)}
            disabled={order.status === 'completed' || order.status === 'cancelled'}
          >
            Update Status
          </Button>
        );
      },
    },
  ];
  
  // Get order progress step
  const getOrderProgressStep = () => {
    switch (order.status) {
      case 'pending':
        return 0;
      case 'in-progress':
        return 1;
      case 'ready':
        return 2;
      case 'served':
        return 3;
      case 'completed':
        return 4;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };
  
  // Get cancellation info
  const getCancellationInfo = () => {
    if (!isOrderCancelled) return null;
    
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
    <Modal
      title={
        <Space>
          <span>Order #{order.orderNumber || 'New Order'}</span>
          {order.priority > 0 && !isOrderCancelled && (
            <Tag color={order.priority === 1 ? "orange" : "red"}>
              {order.priority === 1 ? "High Priority" : "Urgent"}
            </Tag>
          )}
          {isOrderCancelled && (
            <Tag color="red" icon={<StopOutlined />}>
              CANCELLED
            </Tag>
          )}
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrintReceipt}>
          Print Receipt
        </Button>,
        // Only show cancel button for non-cancelled orders
        !isOrderCancelled && order.status !== 'completed' && (
          <Button 
            key="cancel" 
            danger 
            icon={<ExclamationCircleOutlined />} 
            onClick={handleCancelOrder}
            loading={loading}
          >
            Cancel Order
          </Button>
        ),
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ].filter(Boolean)}
    >
      {/* Show cancellation alert for cancelled orders */}
      {isOrderCancelled && (
        <Alert
          message="Order Cancelled"
          description={
            <div>
              <p>This order has been cancelled and cannot be modified.</p>
              {cancellationInfo && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>Cancelled:</Text> {moment(cancellationInfo.cancelledAt).format('MMM DD, YYYY HH:mm')} by {cancellationInfo.cancelledBy}
                  {cancellationInfo.reason && (
                    <div style={{ marginTop: 4 }}>
                      <Text strong>Reason:</Text> {cancellationInfo.reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
      
      {/* Show progress steps only for non-cancelled orders */}
      {!isOrderCancelled && (
        <Steps current={getOrderProgressStep()} style={{ marginBottom: 24 }}>
          <Step title="Received" icon={<ClockCircleOutlined />} />
          <Step title="Preparing" />
          <Step title="Ready" />
          <Step title="Served" />
          <Step title="Completed" icon={<CheckCircleOutlined />} />
        </Steps>
      )}
      
      <Row gutter={24}>
        <Col span={12}>
          <Card title="Order Information" bordered={false}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                {getOrderStatusDisplay(order.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Date & Time">
                {moment(order.createdAt).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Order Type">
                {order.orderType || 'Not specified'}
              </Descriptions.Item>
              {order.table && (
                <Descriptions.Item label="Table">
                  {order.table.tableNumber}, Section: {order.table.section || 'Main'}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Special Instructions">
                {order.specialInstructions || 'None'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="Customer & Payment" bordered={false}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Customer">
                {order.customer?.name || 'Guest'}
              </Descriptions.Item>
              {order.customer?.phone && (
                <Descriptions.Item label="Phone">
                  {order.customer.phone}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Payment Status">
                {editingPayment && !isOrderCancelled ? (
                  <Form
                    form={paymentForm}
                    layout="inline"
                    initialValues={{
                      paymentStatus: order.paymentStatus || 'pending',
                      paymentMethod: order.paymentMethod || 'cash'
                    }}
                    onFinish={handlePaymentFormSubmit}
                  >
                    <Form.Item name="paymentStatus" style={{ marginBottom: 8 }}>
                      <Select style={{ width: 120 }}>
                        <Option value="pending">Pending</Option>
                        <Option value="paid">Paid</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="paymentMethod" style={{ marginBottom: 8 }}>
                      <Select style={{ width: 120 }}>
                        <Option value="cash">Cash</Option>
                        <Option value="ime-pay">IME Pay</Option>
                        <Option value="bank-transfer">Bank Transfer</Option>
                        <Option value="credit-card">Credit Card</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item>
                      <Space>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          size="small"
                          loading={loading}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setEditingPayment(false)}
                        >
                          Cancel
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                ) : (
                  <Space>
                    {getPaymentStatusDisplay(order.paymentStatus)}
                    <Text type="secondary">via {order.paymentMethod || 'Not specified'}</Text>
                    {/* Disable payment editing for cancelled orders */}
                    {(!isOrderCancelled && order.status !== 'completed') && (
                      <Button
                        type="link"
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => setEditingPayment(true)}
                      />
                    )}
                  </Space>
                )}
              </Descriptions.Item>
            </Descriptions>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic 
                  title="Subtotal" 
                  value={order.subTotal || 0} 
                  prefix="NPR" 
                  precision={2}
                  valueStyle={{ 
                    textDecoration: isOrderCancelled ? 'line-through' : 'none',
                    color: isOrderCancelled ? '#ff4d4f' : undefined
                  }}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Tax" 
                  value={order.taxAmount || 0} 
                  prefix="NPR" 
                  precision={2}
                  valueStyle={{ 
                    textDecoration: isOrderCancelled ? 'line-through' : 'none',
                    color: isOrderCancelled ? '#ff4d4f' : undefined
                  }}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Total" 
                  value={order.totalAmount || 0} 
                  prefix="NPR" 
                  precision={2} 
                  valueStyle={{ 
                    color: isOrderCancelled ? '#ff4d4f' : '#3f8600', 
                    fontWeight: 'bold',
                    textDecoration: isOrderCancelled ? 'line-through' : 'none'
                  }} 
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Payment Details Section - Disabled for cancelled orders */}
        {!isOrderCancelled && (
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <span>Payment Details</span>
                  {paymentDetails?.status === 'processing' && (
                    <Badge count="Verification Required" style={{ backgroundColor: '#fa8c16' }} />
                  )}
                </Space>
              } 
              bordered={false} 
              style={{ marginTop: 16 }}
              extra={
                paymentDetails && (
                  <Button 
                    size="small" 
                    onClick={fetchPaymentDetails}
                    loading={loadingPayment}
                    icon={<ReloadOutlined />}
                  >
                    Refresh
                  </Button>
                )
              }
            >
              {loadingPayment ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px', color: '#666' }}>Loading payment details...</div>
                </div>
              ) : paymentDetails ? (
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card size="small" title="Payment Information" style={{ height: '100%' }}>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Status">
                          <Space>
                            {getPaymentStatusDisplay(paymentDetails.status)}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="Payment Method">
                          <Tag color="blue">
                            {paymentDetails.paymentMethod?.toUpperCase().replace('-', ' ') || 'N/A'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Transaction ID">
                          <Space>
                            <Text code style={{ fontSize: '12px' }}>{paymentDetails.transactionId}</Text>
                            <Button 
                              size="small" 
                              type="text"
                              onClick={() => navigator.clipboard?.writeText(paymentDetails.transactionId)}
                              icon={<CopyOutlined />}
                            />
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="Amount">
                          <Text style={{ 
                            color: '#52c41a', 
                            fontSize: '18px', 
                            fontWeight: 'bold'
                          }}>
                            NPR {paymentDetails.amount?.toFixed(2)}
                          </Text>
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="Actions" style={{ height: '100%' }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {(paymentDetails.status === 'pending' || paymentDetails.status === 'processing') && (
                          <Button
                            type="primary"
                            size="small"
                            onClick={handleCashPaymentConfirm}
                            loading={loading}
                            icon={<CheckOutlined />}
                          >
                            Mark as Paid
                          </Button>
                        )}
                      </Space>
                    </Card>
                  </Col>
                </Row>
              ) : (
                <Empty 
                  description="No payment details available for this order"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>
        )}
      </Row>
      
      <Divider />
      
      <Title level={5}>Order Items</Title>
      <Table 
        dataSource={order.items} 
        columns={columns} 
        rowKey="_id"
        pagination={false}
        size="small"
      />
      
      <Divider />
      
      <Collapse ghost>
        <Panel header="Order History" key="1" extra={<HistoryOutlined />}>
          <Timeline mode="left">
            {order.processingHistory && order.processingHistory.map((history, index) => (
              <Timeline.Item 
                key={index}
                color={
                  history.status?.includes('cancelled') ? 'red' : 
                  history.status?.includes('completed') ? 'green' :
                  'blue'
                }
              >
                <p><strong>{history.status}</strong></p>
                <p>{history.note}</p>
                <p style={{ fontSize: 12, color: '#999' }}>
                  {moment(history.timestamp).format('MMM DD, YYYY HH:mm:ss')} by {history.user}
                </p>
              </Timeline.Item>
            ))}
          </Timeline>
        </Panel>
      </Collapse>
    </Modal>
  );
};

export default OrderDetailsModal;