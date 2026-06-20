import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Select, DatePicker, Space, Tag, Descriptions, 
  Modal, Card, Row, Col, Statistic, message 
} from 'antd';
import { EyeOutlined, ReloadOutlined, CalendarOutlined } from '@ant-design/icons';
import { transactionApi } from '../services/api.js';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const typeColors = {
  '寄养': 'green',
  '美容': 'blue',
  '综合': 'purple'
};

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [filters, setFilters] = useState({
    start_date: null,
    end_date: null,
    type: null,
    payment_method: null
  });

  useEffect(() => {
    loadData();
    loadDailyData();
  }, []);

  const loadData = async (newFilters = filters) => {
    try {
      setLoading(true);
      const params = {};
      if (newFilters.start_date) params.start_date = newFilters.start_date.format('YYYY-MM-DD');
      if (newFilters.end_date) params.end_date = newFilters.end_date.format('YYYY-MM-DD');
      if (newFilters.type) params.type = newFilters.type;
      if (newFilters.payment_method) params.payment_method = newFilters.payment_method;
      
      const data = await transactionApi.list(params);
      setTransactions(data.transactions);
      setSummary(data.summary);
    } catch (err) {
      message.error('加载交易记录失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDailyData = async (date = null) => {
    try {
      const data = await transactionApi.daily(date ? date.format('YYYY-MM-DD') : null);
      setDailySummary(data.summary);
    } catch (err) {
      console.error('加载今日数据失败:', err);
    }
  };

  const handleView = async (record) => {
    try {
      const data = await transactionApi.get(record.id);
      setViewingTransaction(data);
      setDetailVisible(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    loadData(newFilters);
  };

  const handleReset = () => {
    const newFilters = {
      start_date: null,
      end_date: null,
      type: null,
      payment_method: null
    };
    setFilters(newFilters);
    loadData(newFilters);
    loadDailyData();
  };

  const columns = [
    { title: '交易ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    { title: '宠物名称', dataIndex: 'pet_name', key: 'pet_name', width: 120 },
    { title: '宠物品种', dataIndex: 'pet_breed', key: 'pet_breed', width: 120 },
    { 
      title: '交易类型', 
      dataIndex: 'type', 
      key: 'type', 
      width: 100,
      render: t => <Tag color={typeColors[t]}>{t}</Tag>
    },
    { 
      title: '金额', 
      dataIndex: 'amount', 
      key: 'amount', 
      width: 120,
      render: a => <strong style={{ color: '#f5222d' }}>¥{a}</strong>
    },
    { title: '支付方式', dataIndex: 'payment_method', key: 'payment_method', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
      )
    }
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">📋 交易记录</h2>
        <Space>
          <Button icon={<CalendarOutlined />} onClick={() => loadDailyData(dayjs())}>
            今日数据
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置筛选</Button>
        </Space>
      </div>

      {dailySummary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic 
                title="今日交易笔数" 
                value={dailySummary.total_count} 
                suffix="笔" 
                valueStyle={{ color: '#1890ff' }} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic 
                title="今日营收" 
                value={dailySummary.total_amount} 
                prefix="¥" 
                valueStyle={{ color: '#52c41a' }} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic 
                title="寄养收入" 
                value={dailySummary.by_type['寄养'].amount} 
                prefix="¥" 
                valueStyle={{ color: '#faad14' }} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic 
                title="美容收入" 
                value={dailySummary.by_type['美容'].amount} 
                prefix="¥" 
                valueStyle={{ color: '#722ed1' }} 
              />
            </Card>
          </Col>
        </Row>
      )}

      {dailySummary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="按交易类型统计" size="small">
              <Row gutter={[8, 8]}>
                {Object.entries(dailySummary.by_type).map(([type, data]) => (
                  <Col xs={8} key={type}>
                    <div style={{ textAlign: 'center', padding: '12px 0', background: '#f9f9f9', borderRadius: 8 }}>
                      <Tag color={typeColors[type]} style={{ marginBottom: 8 }}>{type}</Tag>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>¥{data.amount}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{data.count} 笔</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="按支付方式统计" size="small">
              <Row gutter={[8, 8]}>
                {Object.entries(dailySummary.by_payment).map(([method, data]) => (
                  <Col xs={6} key={method}>
                    <div style={{ textAlign: 'center', padding: '12px 0', background: '#f9f9f9', borderRadius: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{method}</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>¥{data.amount}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{data.count} 笔</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      <div className="search-bar">
        <RangePicker 
          value={filters.start_date && filters.end_date ? [filters.start_date, filters.end_date] : null}
          onChange={dates => {
            if (dates && dates.length === 2) {
              handleFilterChange('start_date', dates[0]);
              handleFilterChange('end_date', dates[1]);
            } else {
              handleFilterChange('start_date', null);
              handleFilterChange('end_date', null);
            }
          }}
        />
        <Select 
          placeholder="交易类型" 
          style={{ width: 150 }} 
          allowClear 
          value={filters.type}
          onChange={v => handleFilterChange('type', v)}
        >
          <Option value="寄养">寄养</Option>
          <Option value="美容">美容</Option>
          <Option value="综合">综合</Option>
        </Select>
        <Select 
          placeholder="支付方式" 
          style={{ width: 150 }} 
          allowClear
          value={filters.payment_method}
          onChange={v => handleFilterChange('payment_method', v)}
        >
          <Option value="现金">现金</Option>
          <Option value="微信">微信</Option>
          <Option value="支付宝">支付宝</Option>
          <Option value="银行卡">银行卡</Option>
        </Select>
      </div>

      {summary && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f0f5ff', borderRadius: 8 }}>
          <Space size={24}>
            <span>筛选结果：共 <strong style={{ color: '#1890ff' }}>{summary.count}</strong> 笔交易</span>
            <span>合计金额：<strong style={{ color: '#f5222d', fontSize: 16 }}>¥{summary.total_amount}</strong></span>
          </Space>
        </div>
      )}

      <Table 
        columns={columns} 
        dataSource={transactions} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="交易详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {viewingTransaction && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="交易ID">#{viewingTransaction.id}</Descriptions.Item>
              <Descriptions.Item label="交易时间">{viewingTransaction.created_at}</Descriptions.Item>
              <Descriptions.Item label="宠物名称">{viewingTransaction.pet_name}</Descriptions.Item>
              <Descriptions.Item label="宠物品种">{viewingTransaction.pet_breed}</Descriptions.Item>
              <Descriptions.Item label="交易类型">
                <Tag color={typeColors[viewingTransaction.type]}>{viewingTransaction.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">{viewingTransaction.payment_method}</Descriptions.Item>
              <Descriptions.Item label="交易金额">
                <strong style={{ color: '#f5222d', fontSize: 18 }}>¥{viewingTransaction.amount}</strong>
              </Descriptions.Item>
            </Descriptions>

            {viewingTransaction.details && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 12 }}>消费明细</h4>
                {viewingTransaction.details.boarding && (
                  <Card title="🏠 寄养明细" size="small" style={{ marginBottom: 12 }}>
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="笼位">{viewingTransaction.details.boarding.cage_name}</Descriptions.Item>
                      <Descriptions.Item label="天数">{viewingTransaction.details.boarding.days}天</Descriptions.Item>
                      <Descriptions.Item label="入住">{viewingTransaction.details.boarding.check_in_date}</Descriptions.Item>
                      <Descriptions.Item label="离店">{viewingTransaction.details.boarding.check_out_date}</Descriptions.Item>
                      <Descriptions.Item label="费用" span={2}>
                        <strong>¥{viewingTransaction.details.boarding.subtotal}</strong>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
                {viewingTransaction.details.grooming && viewingTransaction.details.grooming.length > 0 && (
                  <Card title="✂️ 美容明细" size="small">
                    <Table 
                      columns={[
                        { title: '服务项目', dataIndex: 'service_type', key: 'service_type' },
                        { title: '美容师', dataIndex: 'groomer_name', key: 'groomer_name' },
                        { title: '时间', key: 'time', render: r => `${r.appointment_date} ${r.appointment_time}` },
                        { title: '费用', dataIndex: 'price', key: 'price', render: p => <strong>¥{p}</strong> }
                      ]}
                      dataSource={viewingTransaction.details.grooming}
                      rowKey="id"
                      size="small"
                      pagination={false}
                    />
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Transactions;
