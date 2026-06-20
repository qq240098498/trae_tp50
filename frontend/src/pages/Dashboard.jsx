import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Table, Tag, Statistic, Space, Button, Alert, Tooltip, Badge } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { boardingApi, groomingApi, transactionApi, petApi, vaccineApi } from '../services/api.js';
import VaccineAlertModal from '../components/VaccineAlertModal.jsx';
import { getVaccineStatus } from '../utils/vaccine.js';
import { ExclamationCircleTwoTone, WarningTwoTone, SyncOutlined } from '@ant-design/icons';

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
  const [vaccineAlertCount, setVaccineAlertCount] = useState(0);
  const [vaccineAlerts, setVaccineAlerts] = useState([]);
  const [vaccineModalVisible, setVaccineModalVisible] = useState(false);
  const [vaccineMode, setVaccineMode] = useState('pre_expire');
  const [vaccineStats, setVaccineStats] = useState({ expired: 0, expiring: 0, inShopExpired: 0, inShopExpiring: 0 });
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const preExpireShownRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadData();
    checkPreExpire();
    const timer = setInterval(() => {
      if (!mounted) return;
      setAutoRefreshing(true);
      Promise.allSettled([loadVaccineAlertCount(), checkPreExpire(true)])
        .catch(err => console.warn('Auto refresh error:', err))
        .finally(() => {
          setTimeout(() => mounted && setAutoRefreshing(false), 500);
        });
    }, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const loadVaccineAlertCount = async () => {
    try {
      const list = await vaccineApi.alerts();
      setVaccineAlertCount(list.length);
      let expired = 0, expiring = 0;
      for (const p of list) {
        const s = getVaccineStatus(p.vaccine_expiry_date || p.expire_date);
        if (s.status === 'expired') expired++;
        else if (s.status === 'expiring') expiring++;
      }
      setVaccineStats(prev => ({ ...prev, expired, expiring }));
    } catch (err) {
      // 静默处理
    }
  };

  const checkPreExpire = async (silent = false) => {
    try {
      const data = await vaccineApi.preExpire();
      if (data.length > 0 && (!silent || preExpireShownRef.current)) {
        setVaccineAlerts(data);
        setVaccineMode('pre_expire');
        setVaccineModalVisible(true);
        preExpireShownRef.current = true;
      } else if (data.length > 0) {
        setVaccineAlerts(data);
        setVaccineMode('pre_expire');
        setVaccineModalVisible(true);
        preExpireShownRef.current = true;
      }
    } catch (err) {
      console.error('疫苗到期提醒检查失败:', err);
    } finally {
      try {
        await loadVaccineAlertCount();
      } catch (e) {}
    }
  };

  const openAllVaccineAlerts = async () => {
    try {
      const data = await vaccineApi.alerts();
      setVaccineAlerts(data);
      setVaccineMode('all');
      setVaccineModalVisible(true);
    } catch (err) {
      console.error('加载疫苗提醒失败:', err);
    }
  };

  const refreshVaccineAlerts = async () => {
    try {
      if (vaccineMode === 'pre_expire') {
        const data = await vaccineApi.preExpire();
        setVaccineAlerts(data);
        if (data.length === 0) {
          setVaccineModalVisible(false);
        }
      } else {
        const data = await vaccineApi.alerts();
        setVaccineAlerts(data);
      }
    } catch (err) {
      console.error('刷新疫苗提醒失败:', err);
    } finally {
      try {
        await loadVaccineAlertCount();
      } catch (e) {}
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        petApi.list(),
        boardingApi.list({ status: '已入住' }),
        groomingApi.list({ status: '待服务', start_date: dayjs().format('YYYY-MM-DD') }),
        transactionApi.daily(dayjs().format('YYYY-MM-DD')),
        vaccineApi.alerts().catch(() => [])
      ]);
      const getData = (i, fallback) => results[i].status === 'fulfilled' ? results[i].value : fallback;
      const pets = getData(0, []);
      const boarding = getData(1, []);
      const grooming = getData(2, []);
      const daily = getData(3, { summary: { total_amount: 0 }, transactions: [] });
      const vaccineList = getData(4, []);
      
      setStats({
        pets: pets.length,
        boarding: boarding.length,
        grooming: grooming.length,
        income: daily.summary.total_amount
      });

      let allExpired = 0, allExpiring = 0, inShopExpired = 0, inShopExpiring = 0;
      for (const p of vaccineList) {
        const s = getVaccineStatus(p.vaccine_expiry_date || p.expire_date);
        if (s.status === 'expired') allExpired++;
        else if (s.status === 'expiring') allExpiring++;
      }
      for (const b of boarding) {
        if (b.pet_vaccine_expiry_date) {
          const s = getVaccineStatus(b.pet_vaccine_expiry_date);
          if (s.status === 'expired') inShopExpired++;
          else if (s.status === 'expiring') inShopExpiring++;
        }
      }
      setVaccineStats({ expired: allExpired, expiring: allExpiring, inShopExpired, inShopExpiring });
      setVaccineAlertCount(vaccineList.length);
      
      const results2 = await Promise.allSettled([
        boardingApi.list(),
        groomingApi.list()
      ]);
      const allBoarding = results2[0].status === 'fulfilled' ? results2[0].value : [];
      const allGrooming = results2[1].status === 'fulfilled' ? results2[1].value : [];
      
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
    {
      title: '疫苗',
      key: 'vaccine',
      render: (_, record) => {
        if (!record.pet_vaccine_expiry_date) return <Tag color="default">未设</Tag>;
        const s = getVaccineStatus(record.pet_vaccine_expiry_date);
        if (s.status === 'expired') return <Tag color="red">已过期</Tag>;
        if (s.status === 'expiring') return <Tag color="orange">临期{s.daysRemaining}天</Tag>;
        return <Tag color="green">有效</Tag>;
      }
    },
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
        <Space>
          <Tooltip title={autoRefreshing ? '正在自动检查疫苗到期提醒...' : '每5分钟自动检查疫苗到期提醒'}>
            <Badge dot={autoRefreshing} status="processing">
              <SyncOutlined spin={autoRefreshing} style={{ color: autoRefreshing ? '#1890ff' : '#999' }} />
            </Badge>
          </Tooltip>
          <Button type="primary" onClick={loadData}>刷新数据</Button>
        </Space>
      </div>

      {(vaccineStats.inShopExpired > 0 || vaccineStats.inShopExpiring > 0) && (
        <Alert
          message={
            <Space>
              <ExclamationCircleTwoTone twoToneColor="#f5222d" />
              <span>
                <strong>在店宠物疫苗预警：</strong>
                {vaccineStats.inShopExpired > 0 && (
                  <span style={{ color: '#f5222d', marginLeft: 8 }}>
                    已过期 {vaccineStats.inShopExpired} 只
                  </span>
                )}
                {vaccineStats.inShopExpiring > 0 && (
                  <span style={{ color: '#faad14', marginLeft: 8 }}>
                    临期 {vaccineStats.inShopExpiring} 只
                  </span>
                )}
              </span>
            </Space>
          }
          description="请及时检查并通知主人补种，避免影响寄养安全。"
          type="error"
          showIcon={false}
          action={
            <Button size="small" type="primary" danger onClick={openAllVaccineAlerts}>
              查看详情
            </Button>
          }
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {vaccineAlertCount > 0 && (
        <Alert
          message={
            <Space>
              <WarningTwoTone twoToneColor="#faad14" />
              <span>
                疫苗到期提醒：共 <strong>{vaccineAlertCount}</strong> 只宠物
                {vaccineStats.expired > 0 && (
                  <span style={{ color: '#f5222d', marginLeft: 6 }}>
                    （已过期 {vaccineStats.expired} 只）
                  </span>
                )}
                {vaccineStats.expiring > 0 && (
                  <span style={{ color: '#faad14', marginLeft: 6 }}>
                    （临期 {vaccineStats.expiring} 只）
                  </span>
                )}
              </span>
            </Space>
          }
          description="寄养宠物疫苗临期/过期时入店会自动弹窗提醒；到期前3天系统将再次提醒，可短信通知主人补种。系统每5分钟自动检查一次。"
          type="warning"
          showIcon={false}
          action={
            <Button size="small" type="primary" onClick={openAllVaccineAlerts}>
              查看并通知主人
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="宠物档案" value={stats.pets} suffix="只" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic
              title="在店寄养"
              value={stats.boarding}
              suffix="只"
              valueStyle={{ color: '#52c41a' }}
            />
            {(vaccineStats.inShopExpired > 0 || vaccineStats.inShopExpiring > 0) && (
              <Space size={4} style={{ marginTop: 4 }}>
                {vaccineStats.inShopExpired > 0 && (
                  <Tag color="red" style={{ margin: 0 }}>⚠ {vaccineStats.inShopExpired}过期</Tag>
                )}
                {vaccineStats.inShopExpiring > 0 && (
                  <Tag color="orange" style={{ margin: 0 }}>⏰ {vaccineStats.inShopExpiring}临期</Tag>
                )}
              </Space>
            )}
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

      <VaccineAlertModal
        open={vaccineModalVisible}
        onClose={() => setVaccineModalVisible(false)}
        alerts={vaccineAlerts}
        reminderType={vaccineMode === 'pre_expire' ? 'pre_expire' : undefined}
        getReminderType={vaccineMode === 'all' ? (r) => (r.status === 'expired' ? 'expired' : 'pre_expire') : undefined}
        onSmsSent={refreshVaccineAlerts}
        title={vaccineMode === 'pre_expire' ? '⏰ 疫苗到期前3天提醒' : '⚠️ 疫苗到期提醒'}
        description={
          vaccineMode === 'pre_expire'
            ? '以下宠物疫苗将于3天内到期，请及时短信通知主人安排补种。'
            : '以下宠物疫苗临期或已过期，可对单只或批量发送短信通知主人。'
        }
      />
    </div>
  );
}

export default Dashboard;
