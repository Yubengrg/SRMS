// src/rmsPayment/PaymentReports.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, DatePicker, Button, Select, Table, 
  Statistic, Typography, Space, Spin, notification,
  Progress, Tag, Divider
} from 'antd';
import {
  DownloadOutlined, FileExcelOutlined, FilePdfOutlined,
  DollarOutlined, TrendingUpOutlined, PieChartOutlined
} from '@ant-design/icons';
import {
  getPaymentAnalytics, exportPaymentData, getPaymentTrends,
  getPaymentMethodStats, getDailyPaymentSummary
} from '../services/api';
import moment from 'moment';
import { Line, Pie } from '@ant-design/charts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const PaymentReports = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, 'days'),
    moment()
  ]);
  const [reportType, setReportType] = useState('summary');
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [methodStats, setMethodStats] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, reportType]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      const params = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        period: 'custom'
      };

      // Fetch analytics
      const analyticsResponse = await getPaymentAnalytics(params);
      if (analyticsResponse.success) {
        setAnalytics(analyticsResponse.analytics);
      }

      // Fetch trends
      const trendsResponse = await getPaymentTrends('custom');
      setTrends(trendsResponse || []);

      // Fetch payment method stats
      const methodStatsResponse = await getPaymentMethodStats('custom');
      setMethodStats(methodStatsResponse || []);

      // Fetch daily summary
      const summaryResponse = await getDailyPaymentSummary();
      if (summaryResponse.success) {
        setDailySummary(summaryResponse.summary);
      }

    } catch (error) {
      console.error('Error fetching report data:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch report data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setLoading(true);
      const filters = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        format
      };

      await exportPaymentData(filters);
      
      notification.success({
        message: 'Success',
        description: `Payment data exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: `Failed to export payment data`
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const trendChartData = trends.map(item => ({
    date: moment(item.date).format('MMM DD'),
    revenue: item.totalRevenue || 0,
    transactions: item.totalTransactions || 0
  }));

  const methodChartData = methodStats.map(item => ({
    method: item.method?.charAt(0).toUpperCase() + item.method?.slice(1) || 'Unknown',
    amount: item.amount || 0,
    count: item.count || 0
  }));

  const trendChartConfig = {
    data: trendChartData,
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    color: '#FFB930',
    point: {
      size: 5,
      shape: 'diamond',
    },
    label: {
      style: {
        fill: '#aaa',
      },
    },
  };

  const pieChartConfig = {
    data: methodChartData,
    angleField: 'amount',
    colorField: 'method',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
  };

  const summaryColumns = [
    {
      title: 'Payment Method',
      dataIndex: 'method',
      key: 'method',
      render: (method) => (
        <Tag color={method === 'cash' ? 'green' : method === 'ime-pay' ? 'blue' : 'orange'}>
          {method?.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Transactions',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
    {
      title: 'Total Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `NPR ${amount?.toFixed(2)}`,
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: 'Average',
      key: 'average',
      render: (_, record) => `NPR ${(record.amount / record.count).toFixed(2)}`,
    },
    {
      title: 'Percentage',
      key: 'percentage',
      render: (_, record) => {
        const total = methodStats.reduce((sum, item) => sum + item.amount, 0);
        const percentage = total > 0 ? (record.amount / total * 100).toFixed(1) : 0;
        return `${percentage}%`;
      }
    }
  ];

  return (
    <div style={{ padding: '20px', background: '#1A1E2D', minHeight: '100vh' }}>
      <Card style={{ marginBottom: '24px', background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ color: '#FFFFFF', margin: 0 }}>Payment Reports</Title>
          </Col>
          <Col>
            <Space>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: 300 }}
              />
              <Select
                value={reportType}
                onChange={setReportType}
                style={{ width: 150 }}
              >
                <Option value="summary">Summary</Option>
                <Option value="detailed">Detailed</Option>
                <Option value="trends">Trends</Option>
              </Select>
              <Button 
                type="primary" 
                onClick={fetchReportData}
                loading={loading}
              >
                Generate Report
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ color: '#FFFFFF', marginTop: '16px' }}>Loading report data...</div>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          {analytics && (
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={6}>
                <Card style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Statistic
                    title="Total Revenue"
                    value={analytics.totalRevenue || 0}
                    precision={2}
                    prefix="NPR "
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Statistic
                    title="Total Transactions"
                    value={analytics.totalTransactions || 0}
                    prefix={<DollarOutlined />}
                    valueStyle={{ color: '#FFB930' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Statistic
                    title="Average Transaction"
                    value={analytics.averageTransaction || 0}
                    precision={2}
                    prefix="NPR "
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Statistic
                    title="Success Rate"
                    value={analytics.successRate || 0}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Charts */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={16}>
              <Card 
                title="Revenue Trends" 
                style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}
                headStyle={{ color: '#FFFFFF' }}
              >
                {trendChartData.length > 0 ? (
                  <Line {...trendChartConfig} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    No trend data available
                  </div>
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card 
                title="Payment Methods" 
                style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}
                headStyle={{ color: '#FFFFFF' }}
              >
                {methodChartData.length > 0 ? (
                  <Pie {...pieChartConfig} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    No method data available
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* Payment Method Breakdown */}
          <Card 
            title="Payment Method Breakdown" 
            style={{ marginBottom: '24px', background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}
            headStyle={{ color: '#FFFFFF' }}
            extra={
              <Space>
                <Button 
                  icon={<FileExcelOutlined />}
                  onClick={() => handleExport('csv')}
                  loading={loading}
                >
                  Export CSV
                </Button>
                <Button 
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExport('pdf')}
                  loading={loading}
                >
                  Export PDF
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={methodStats}
              columns={summaryColumns}
              rowKey="method"
              pagination={false}
              size="middle"
              style={{
                background: 'transparent'
              }}
            />
          </Card>

          {/* Daily Summary */}
          {dailySummary && (
            <Card 
              title={`Today's Summary - ${moment().format('MMMM DD, YYYY')}`}
              style={{ background: '#242A3D', border: '1px solid rgba(255,255,255,0.05)' }}
              headStyle={{ color: '#FFFFFF' }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Today's Revenue"
                    value={dailySummary.totalRevenue || 0}
                    precision={2}
                    prefix="NPR "
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Transactions"
                    value={dailySummary.totalTransactions || 0}
                    valueStyle={{ color: '#FFB930' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Pending Verifications"
                    value={dailySummary.pendingVerifications || 0}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
              </Row>
              
              <Divider />
              
              <Title level={5} style={{ color: '#FFFFFF' }}>Payment Method Performance</Title>
              {dailySummary.methodBreakdown && Object.entries(dailySummary.methodBreakdown).map(([method, data]) => (
                <div key={method} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Text style={{ color: '#FFFFFF' }}>{method.toUpperCase()}</Text>
                    <Text style={{ color: '#52c41a' }}>NPR {data.amount?.toFixed(2)}</Text>
                  </div>
                  <Progress 
                    percent={dailySummary.totalRevenue > 0 ? (data.amount / dailySummary.totalRevenue * 100).toFixed(1) : 0}
                    strokeColor="#FFB930"
                    trailColor="rgba(255,255,255,0.1)"
                  />
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentReports;