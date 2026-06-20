import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Tag, Statistic, Space, Button } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { boardingApi, groomingApi, transactionApi, petApi } from '../services/api.js';

const statusColors = {
  '待入住': 'warning',
  '已入住': 'processing',
  '已离店': 'success',
  '已取消': 'default',
  '待服务': 'warning',
  '服务中': 'processing',
  '已完成': 'success'
};

function Dashboard() {
  const [stats, setStats] = useState({
    pets: 0,
    boarding: 0,
    grooming: 0,
    income: 0
  });
  const [recentBoarding, setRecentBoarding] = useState([]);
  const [recentGrooming, setRecentGrooming] = useState([]);
  const [todayIncome, setTodayIncome] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pets, boarding, grooming, daily] = await Promise.all([
        petApi.list(),
        boardingApi.list({ status: '已入住' }),
        groomingApi.list({ status: '待服务', start_date: dayjs().format('YYYY-MM-DD') }),
        transactionApi.daily(dayjs().format('YYYY-MM-DD'))
      ]);
      
      setStats({
        pets: pets.length,
        boarding: boarding.length,
        grooming: grooming.length,
        income: daily.summary.total_amount
      });
      
      const [allBoarding, allGrooming] = await Promise.all([
        boardingApi.list(),
        groomingApi.list()
      ]);
      
      setRecentBoarding(allBoarding.slice(0, 5));
      setRecentGrooming(allGrooming.slice(0, 5));
      setTodayIncome(daily);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const boardingColumns = [
    { title: '宠物名称', dataIndex: 'pet_name', key: 'pet_name' },
    { title: '笼位', dataIndex: 'cage_name', key: 'cage_name' },
    { title: '入住日期', dataIndex: 'check_in_date', key: 'check_in_date' },
    { title: '离店日期', dataIndex: 'check_out_date', key: 'check_out_date' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={statusColors[s]}>{s}</Tag> }
  ];

  const groomingColumns = [
    { title: '宠物名称', dataIndex: 'pet_name', key: 'pet_name' },
    { title: '服务项目', dataIndex: 'service_type', key: 'service_type' },
    { title: '美容师', dataIndex: 'groomer_name', key: 'groomer_name' },
    { title: '预约时间', key: 'time', render: r => `${r.appointment_date} ${r.appointment_time}` },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={statusColors[s]}>{s}</Tag> }
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">📊 数据概览</h2>
        <Button type="primary" onClick={loadData}>刷新数据</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="宠物档案" value={stats.pets} suffix="只" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="在店寄养" value={stats.boarding} suffix="只" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="今日美容" value={stats.grooming} suffix="单" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="今日营收" value={stats.income} prefix="¥" valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card 
            title="最近寄养预约" 
            extra={<Link to="/boarding">查看全部</Link>}
          >
            <Table 
              columns={boardingColumns} 
              dataSource={recentBoarding} 
              rowKey="id" 
              size="small"
              pagination={false}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title="最近美容预约" 
            extra={<Link to="/grooming">查看全部</Link>}
          >
            <Table 
              columns={groomingColumns} 
              dataSource={recentGrooming} 
              rowKey="id" 
              size="small"
              pagination={false}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {todayIncome && todayIncome.transactions.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card title="今日交易明细" extra={<Link to="/transactions">查看全部</Link>}>
              <Table 
                columns={[
                  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
                  { title: '宠物', dataIndex: 'pet_name', key: 'pet_name' },
                  { title: '类型', dataIndex: 'type', key: 'type', render: t => <Tag color="blue">{t}</Tag> },
                  { title: '金额', dataIndex: 'amount', key: 'amount', render: a => <strong>¥{a}</strong> },
                  { title: '支付方式', dataIndex: 'payment_method', key: 'payment_method' }
                ]}
                dataSource={todayIncome.transactions}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default Dashboard;
