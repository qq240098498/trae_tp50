import React, { useState, useMemo } from 'react';
import { Modal, Table, Tag, Button, Space, Alert, message, Badge, Statistic, Row, Col, Divider, Tooltip, Card } from 'antd';
import { MessageOutlined, CheckCircleTwoTone, ExclamationCircleTwoTone, WarningTwoTone } from '@ant-design/icons';
import { vaccineApi } from '../services/api.js';
import { getVaccineStatus } from '../utils/vaccine.js';

function VaccineAlertModal({ open, onClose, alerts = [], reminderType = 'checkin', getReminderType, onSmsSent, title, description }) {
  const [sendingIds, setSendingIds] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const resolveType = (record) => (getReminderType ? getReminderType(record) : reminderType);

  const stats = useMemo(() => {
    let expired = 0, expiring = 0, notified = 0, hasPhone = 0;
    for (const a of alerts) {
      const expireDate = a.expire_date || a.vaccine_expiry_date;
      const s = expireDate ? getVaccineStatus(expireDate) : { status: 'unknown' };
      if (s.status === 'expired') expired++;
      else if (s.status === 'expiring') expiring++;
      const rt = resolveType(a);
      if (a.reminded && a.reminded[rt]) notified++;
      if (a.owner_phone) hasPhone++;
    }
    return { expired, expiring, notified, hasPhone, total: alerts.length };
  }, [alerts, getReminderType, reminderType]);

  const sendSms = async (petId, type) => {
    setSendingIds(prev => new Set(prev).add(petId));
    try {
      const res = await vaccineApi.sendSms(petId, type);
      message.success(`短信已发送至 ${res.phone}`);
      if (onSmsSent) onSmsSent(petId);
    } catch (err) {
      message.error(err.error || '短信发送失败');
    } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(petId);
        return next;
      });
    }
  };

  const sendAll = async () => {
    const targets = alerts.filter(a => a.owner_phone);
    if (targets.length === 0) {
      message.warning('暂无可发送短信的宠物（未登记主人手机号）');
      return;
    }
    setBatchLoading(true);
    let ok = 0;
    for (const a of targets) {
      try {
        await vaccineApi.sendSms(a.id, resolveType(a));
        ok++;
      } catch (err) {
        // 忽略单条失败，继续发送
      }
    }
    setBatchLoading(false);
    message.success(`已批量发送 ${ok} 条短信`);
    if (onSmsSent) onSmsSent(null);
  };

  const columns = [
    {
      title: '宠物信息',
      key: 'pet',
      width: 200,
      render: r => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>{r.breed}</span>
        </Space>
      )
    },
    {
      title: '疫苗到期日',
      key: 'expire',
      width: 120,
      render: r => {
        const d = r.expire_date || r.vaccine_expiry_date;
        return d ? <span style={{ fontFamily: 'monospace' }}>{d}</span> : <Tag color="default">未设置</Tag>;
      }
    },
    {
      title: '剩余/逾期',
      key: 'days',
      width: 100,
      render: record => {
        const expireDate = record.expire_date || record.vaccine_expiry_date;
        if (!expireDate) return '-';
        const s = getVaccineStatus(expireDate);
        if (s.status === 'expired') {
          return (
            <Badge status="error" text={
              <span style={{ color: '#f5222d', fontWeight: 600 }}>
                逾期{Math.abs(s.daysRemaining)}天
              </span>
            } />
          );
        }
        if (s.status === 'expiring') {
          return (
            <Badge status="warning" text={
              <span style={{ color: '#faad14', fontWeight: 600 }}>
                剩{s.daysRemaining}天
              </span>
            } />
          );
        }
        return <Badge status="success" text={`剩${s.daysRemaining}天`} />;
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: record => {
        const expireDate = record.expire_date || record.vaccine_expiry_date;
        if (!expireDate) return <Tag color="default">未设置</Tag>;
        const s = getVaccineStatus(expireDate);
        const icon = s.status === 'expired'
          ? <ExclamationCircleTwoTone twoToneColor="#f5222d" />
          : s.status === 'expiring'
          ? <WarningTwoTone twoToneColor="#faad14" />
          : <CheckCircleTwoTone twoToneColor="#52c41a" />;
        const label = s.status === 'expired' ? '已过期' : s.status === 'expiring' ? '临期' : '有效';
        return (
          <Tag color={s.color} icon={icon}>
            {label}
          </Tag>
        );
      }
    },
    {
      title: '主人电话',
      dataIndex: 'owner_phone',
      key: 'owner_phone',
      width: 130,
      render: p => p
        ? <span style={{ fontFamily: 'monospace' }}>{p}</span>
        : <Tag color="default">未登记</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_, record) => {
        const rt = resolveType(record);
        const reminded = record.reminded && record.reminded[rt];
        return (
          <Space>
            <Button
              size="small"
              type={reminded ? 'default' : 'primary'}
              icon={<MessageOutlined />}
              loading={sendingIds.has(record.id)}
              disabled={!record.owner_phone}
              onClick={() => sendSms(record.id, rt)}
            >
              {reminded ? '重发短信' : '发送短信'}
            </Button>
            {reminded && (
              <Tooltip title="已通知主人">
                <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 18 }} />
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  const hasPhone = alerts.some(a => a.owner_phone);

  return (
    <Modal
      title={title || '⚠️ 疫苗到期提醒'}
      open={open}
      onCancel={onClose}
      width={820}
      footer={[
        <Button
          key="sendAll"
          type="primary"
          icon={<MessageOutlined />}
          loading={batchLoading}
          onClick={sendAll}
          disabled={!hasPhone}
        >
          全部发送短信 ({stats.hasPhone})
        </Button>,
        <Button key="close" onClick={onClose}>知道了</Button>
      ]}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ border: '1px solid #ffccc7' }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>疫苗已过期</span>}
              value={stats.expired}
              suffix="只"
              valueStyle={{ color: '#f5222d', fontSize: 20 }}
              prefix={<ExclamationCircleTwoTone twoToneColor="#f5222d" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ border: '1px solid #ffe58f' }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>疫苗即将临期</span>}
              value={stats.expiring}
              suffix="只"
              valueStyle={{ color: '#faad14', fontSize: 20 }}
              prefix={<WarningTwoTone twoToneColor="#faad14" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 12 }}>已短信通知</span>}
              value={stats.notified}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
              prefix={<CheckCircleTwoTone twoToneColor="#52c41a" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 12 }}>可发送短信</span>}
              value={stats.hasPhone}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#1890ff', fontSize: 20 }}
              prefix={<MessageOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Alert
        message="检测到疫苗临期或已过期的寄养宠物"
        description={description || '请及时通知主人带宠物补种疫苗。可对单只宠物发送短信，或点击「全部发送短信」批量通知主人。'}
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Divider style={{ margin: '8px 0 16px 0' }} orientation="left" plain>
        <span style={{ fontSize: 13, color: '#666' }}>详细列表</span>
      </Divider>
      <Table
        columns={columns}
        dataSource={alerts}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ y: 280 }}
      />
    </Modal>
  );
}

export default VaccineAlertModal;
