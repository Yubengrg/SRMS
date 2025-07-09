// src/rmsPayment/PaymentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Tabs, Button, notification, Typography, 
  Space, Input, Select, Empty, Spin, Tag, Table, Modal,
  DatePicker, Statistic, Badge
} from 'antd';
import { 
  DollarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, PrinterOutlined
} from '@ant-design/icons';
import { 
  getRestaurantPayments, verifyPayment, getPaymentAnalytics,
  confirmCashPayment, getPaymentSummary 
} from '../services/api';
import moment from 'moment';
import './PaymentDashboard.css';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PaymentDashboard = ({ inDashboard = false, isActive = true }) => {
  const [payments, setPayments] = useState({
    pending: [],
    processing: [],
    completed: [],
    failed: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [dateRange, setDateRange] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (isActive) {
      fetchPayments();
      fetchAnalytics();
    }
  }, [isActive, dateRange, filterStatus, filterMethod]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const filters = {};
      
      if (filterStatus !== 'all') filters.status = filterStatus;
      if (filterMethod !== 'all') filters.paymentMethod = filterMethod;
      if (dateRange.length === 2) {
        filters.startDate = dateRange[0].format('YYYY-MM-DD');
        filters.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (searchTerm) filters.search = searchTerm;

      const response = await getRestaurantPayments(filters);
      
      if (response.success) {
        // Organize payments by status
        const organizedPayments = {
          pending: response.payments.filter(p => p.status === 'pending'),
          processing: response.payments.filter(p => p.status === 'processing'),
          completed: response.payments.filter(p => p.status === 'completed'),
          failed: response.payments.filter(p => p.status === 'failed')
        };
        
        setPayments(organizedPayments);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch payments'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const period = dateRange.length === 2 ? 'custom' : 'today';
      const params = { period };
      
      if (dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await getPaymentAnalytics(params);
      if (response.success) {
        setAnalytics(response.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleVerifyPayment = async (paymentId, action, notes = '') => {
    try {
      setLoading(true);
      const response = await verifyPayment(paymentId, { action, notes });
      
      if (response.success) {
        notification.success({
          message: 'Success',
          description: `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        });
        fetchPayments();
      }
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to verify payment'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCashPayment = async (orderId, amount, receivedBy) => {
    try {
      setLoading(true);
      const response = await confirmCashPayment(orderId, {
        amount,
        receivedBy,
        notes: 'Cash payment confirmed by staff'
      });
      
      if (response.success) {
        notification.success({
          message: 'Success',
          description: 'Cash payment confirmed successfully'
        });
        fetchPayments();
      }
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to confirm cash payment'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'green';
      case 'pending': return 'orange';
      case 'processing': return 'blue';
      case 'failed': return 'red';
      default: return 'default';
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return '💵';
      case 'ime-pay': return '📱';
      case 'bank-transfer': return '🏦';
      case 'credit-card': return '💳';
      default: return '💰';
    }
  };

  const columns = [
    {
      title: 'Transaction ID',
      dataIndex: 'transactionId',
      key: 'transactionId',
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: 'Order',
      dataIndex: ['order', 'orderNumber'],
      key: 'orderNumber',
      render: (text) => <Text strong>#{text}</Text>
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_, record) => (
        <Text strong style={{ color: '#52c41a' }}>
          NPR {record.amount.toFixed(2)}
        </Text>
      )
    },
    {
      title: 'Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method) => (
        <Tag>
          {getPaymentMethodIcon(method)} {method?.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={getStatusColor(status)} 
          text={status?.charAt(0).toUpperCase() + status?.slice(1)}
        />
      )
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => moment(date).format('MMM DD, HH:mm')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPayment(record);
              setShowDetailsModal(true);
            }}
          >
            View
          </Button>
          
          {record.status === 'processing' && (
            <>
              <Button
                size="small"
                type="primary"
                onClick={() => handleVerifyPayment(record._id, 'approve')}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                onClick={() => handleVerifyPayment(record._id, 'reject', 'Verification failed')}
              >
                Reject
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  const renderPaymentList = (paymentsList, status) => {
    if (paymentsList.length === 0) {
      return (
        <Empty 
          description={`No ${status} payments`}
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      );
    }

    return (
      <Table
        dataSource={paymentsList}
        columns={columns}
        rowKey="_id"
        size="small"
        pagination={{ pageSize: 10 }}
      />
    );
  };

  return (
    <div className={inDashboard ? "dashboard-content-section" : "payment-management-container"}>
      {/* Analytics Cards */}
      {analytics && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={analytics.totalRevenue || 0}
                precision={2}
                prefix="NPR "
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Completed Payments"
                value={analytics.completedPayments || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Pending Verification"
                value={analytics.processingPayments || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Average Amount"
                value={analytics.averageAmount || 0}
                precision={2}
                prefix="NPR "
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card className={inDashboard ? "dashboard-content-card" : "payment-dashboard-card"}>
        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="Search payments..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 200 }}
            />
            
            <Select
              defaultValue="all"
              style={{ width: 120 }}
              onChange={setFilterStatus}
              placeholder="Status"
            >
              <Option value="all">All Status</Option>
              <Option value="pending">Pending</Option>
              <Option value="processing">Processing</Option>
              <Option value="completed">Completed</Option>
              <Option value="failed">Failed</Option>
            </Select>

            <Select
              defaultValue="all"
              style={{ width: 140 }}
              onChange={setFilterMethod}
              placeholder="Payment Method"
            >
              <Option value="all">All Methods</Option>
              <Option value="cash">Cash</Option>
              <Option value="ime-pay">IME Pay</Option>
              <Option value="bank-transfer">Bank Transfer</Option>
              <Option value="credit-card">Credit Card</Option>
            </Select>

            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['Start Date', 'End Date']}
            />

            <Button 
              type="primary" 
              onClick={fetchPayments} 
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        <Tabs defaultActiveKey="processing" type="card">
          <TabPane 
            tab={
              <span>
                <ClockCircleOutlined />
                Processing ({payments.processing.length})
              </span>
            } 
            key="processing"
          >
            {loading ? (
              <Spin size="large" />
            ) : (
              renderPaymentList(payments.processing, 'processing')
            )}
          </TabPane>

          <TabPane 
            tab={
              <span>
                <ExclamationCircleOutlined />
                Pending ({payments.pending.length})
              </span>
            } 
            key="pending"
          >
            {loading ? (
              <Spin size="large" />
            ) : (
              renderPaymentList(payments.pending, 'pending')
            )}
          </TabPane>

          <TabPane 
            tab={
              <span>
                <CheckCircleOutlined />
                Completed ({payments.completed.length})
              </span>
            } 
            key="completed"
          >
            {loading ? (
              <Spin size="large" />
            ) : (
              renderPaymentList(payments.completed, 'completed')
            )}
          </TabPane>

          <TabPane 
            tab={
              <span>
                <ExclamationCircleOutlined />
                Failed ({payments.failed.length})
              </span>
            } 
            key="failed"
          >
            {loading ? (
              <Spin size="large" />
            ) : (
              renderPaymentList(payments.failed, 'failed')
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <Modal
          title={`Payment Details - ${selectedPayment.transactionId}`}
          visible={showDetailsModal}
          onCancel={() => {
            setShowDetailsModal(false);
            setSelectedPayment(null);
          }}
          width={800}
          footer={[
            <Button key="close" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          ]}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Payment Information" size="small">
                <p><strong>Transaction ID:</strong> {selectedPayment.transactionId}</p>
                <p><strong>Amount:</strong> NPR {selectedPayment.amount?.toFixed(2)}</p>
                <p><strong>Method:</strong> {selectedPayment.paymentMethod}</p>
                <p><strong>Status:</strong> 
                  <Badge 
                    status={getStatusColor(selectedPayment.status)} 
                    text={selectedPayment.status}
                    style={{ marginLeft: 8 }}
                  />
                </p>
                <p><strong>Date:</strong> {moment(selectedPayment.createdAt).format('MMMM DD, YYYY HH:mm')}</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Order Information" size="small">
                <p><strong>Order Number:</strong> #{selectedPayment.order?.orderNumber}</p>
                <p><strong>Customer:</strong> {selectedPayment.customer?.name || 'N/A'}</p>
                <p><strong>Table:</strong> {selectedPayment.order?.table?.tableNumber || 'Takeaway'}</p>
              </Card>
            </Col>
          </Row>

          {selectedPayment.gatewayResponse && (
            <Card title="Payment Details" size="small" style={{ marginTop: 16 }}>
              <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {JSON.stringify(selectedPayment.gatewayResponse, null, 2)}
              </pre>
            </Card>
          )}
        </Modal>
      )}
    </div>
  );
};

export default PaymentDashboard;