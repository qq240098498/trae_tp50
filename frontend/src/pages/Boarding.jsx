import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Space, Modal, Form, Select, DatePicker, 
  message, Popconfirm, Tag, Descriptions, Row, Col, Alert, Tooltip 
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, WarningOutlined } from '@ant-design/icons';
import { boardingApi, petApi, vaccineApi } from '../services/api.js';
import VaccineAlertModal from '../components/VaccineAlertModal.jsx';
import { getVaccineStatus } from '../utils/vaccine.js';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusColors = {
  '待入住': 'warning',
  '已入住': 'processing',
  '已离店': 'success',
  '已取消': 'default'
};

function Boarding() {
  const [bookings, setBookings] = useState([]);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [availableCages, setAvailableCages] = useState([]);
  const [allCages, setAllCages] = useState([]);
  const [conflictCageIds, setConflictCageIds] = useState([]);
  const [selectedDates, setSelectedDates] = useState(null);
  const [vaccineAlerts, setVaccineAlerts] = useState([]);
  const [vaccineModalVisible, setVaccineModalVisible] = useState(false);
  const [vaccineReminderType, setVaccineReminderType] = useState('checkin');
  const [selectedPetVaccine, setSelectedPetVaccine] = useState(null);
  const [pendingCheckinAlerts, setPendingCheckinAlerts] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        boardingApi.list(),
        petApi.list()
      ]);
      const bookingsData = results[0].status === 'fulfilled' ? results[0].value : [];
      const petsData = results[1].status === 'fulfilled' ? results[1].value : [];
      setBookings(bookingsData);
      setPets(petsData);
      checkPendingCheckinVaccine(bookingsData);
      try {
        await checkPreExpireVaccine();
      } catch (e) {}
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const checkPendingCheckinVaccine = (bookingsData) => {
    const pendingPets = bookingsData.filter(b => b.status === '待入住' && b.pet_vaccine_expiry_date);
    const alerts = [];
    for (const booking of pendingPets) {
      const s = getVaccineStatus(booking.pet_vaccine_expiry_date);
      if (s.shouldAlert) {
        alerts.push({
          id: booking.pet_id,
          name: booking.pet_name,
          breed: booking.pet_breed,
          owner_phone: booking.pet_owner_phone,
          vaccine_expiry_date: booking.pet_vaccine_expiry_date,
          expire_date: booking.pet_vaccine_expiry_date,
          ...s,
          _bookingId: booking.id
        });
      }
    }
    setPendingCheckinAlerts(alerts);
  };

  const checkPreExpireVaccine = async () => {
    try {
      const data = await vaccineApi.preExpire();
      if (data.length > 0) {
        setVaccineAlerts(data);
        setVaccineReminderType('pre_expire');
        setVaccineModalVisible(true);
      }
    } catch (err) {
      // 静默处理
    }
  };

  const loadAvailableCages = async (checkIn, checkOut, excludeId = null) => {
    try {
      const data = await boardingApi.availableCages(
        checkIn.format('YYYY-MM-DD'),
        checkOut.format('YYYY-MM-DD'),
        excludeId
      );
      setAvailableCages(data.availableCages);
      setAllCages(data.allCages);
      setConflictCageIds(data.conflictCageIds);
    } catch (err) {
      message.error('加载可用笼位失败');
    }
  };

  const handleDateChange = (dates) => {
    setSelectedDates(dates);
    if (dates && dates.length === 2) {
      loadAvailableCages(dates[0], dates[1], editingBooking?.id);
    } else {
      setAvailableCages([]);
      setConflictCageIds([]);
    }
  };

  const handleAdd = async () => {
    setEditingBooking(null);
    form.resetFields();
    setSelectedDates(null);
    setAvailableCages([]);
    setConflictCageIds([]);
    setSelectedPetVaccine(null);
    
    try {
      const data = await boardingApi.cages();
      setAllCages(data);
    } catch (err) {
      message.error('加载笼位失败');
    }
    
    setModalVisible(true);
  };

  const handlePetSelect = async (petId) => {
    if (!petId) {
      setSelectedPetVaccine(null);
      return;
    }
    try {
      const pet = pets.find(p => p.id === petId);
      if (pet && pet.vaccine_expiry_date) {
        const s = getVaccineStatus(pet.vaccine_expiry_date);
        setSelectedPetVaccine({
          id: pet.id,
          name: pet.name,
          breed: pet.breed,
          owner_phone: pet.owner_phone,
          vaccine_expiry_date: pet.vaccine_expiry_date,
          expire_date: pet.vaccine_expiry_date,
          ...s
        });
      } else {
        setSelectedPetVaccine(null);
      }
    } catch (err) {
      setSelectedPetVaccine(null);
    }
  };

  const handleEdit = async (booking) => {
    setEditingBooking(booking);
    const dates = [dayjs(booking.check_in_date), dayjs(booking.check_out_date)];
    setSelectedDates(dates);
    setSelectedPetVaccine(null);
    
    form.setFieldsValue({
      pet_id: booking.pet_id,
      cage_id: booking.cage_id,
      dates: dates,
      feeding_requirements: booking.feeding_requirements,
      status: booking.status
    });
    
    handlePetSelect(booking.pet_id);
    await loadAvailableCages(dates[0], dates[1], booking.id);
    setModalVisible(true);
  };

  const handleView = async (booking) => {
    try {
      const data = await boardingApi.get(booking.id);
      setViewingBooking(data);
      setDetailVisible(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await boardingApi.cancel(id);
      message.success('取消成功');
      loadData();
    } catch (err) {
      message.error(err.error || '取消失败');
    }
  };

  const handleStatusChange = async (record, status) => {
    try {
      await boardingApi.updateStatus(record.id, status);
      message.success('状态更新成功');
      await loadData();
      if (status === '已入住' && record.pet_id) {
        try {
          await checkVaccineOnCheckin(record.pet_id);
        } catch (e) {}
      }
    } catch (err) {
      message.error(err.error || '状态更新失败');
    }
  };

  const checkVaccineOnCheckin = async (petId) => {
    try {
      const data = await vaccineApi.check(petId);
      if (data.shouldAlert) {
        setVaccineAlerts([data]);
        setVaccineReminderType('checkin');
        setVaccineModalVisible(true);
      }
    } catch (err) {
      console.error('疫苗状态检查失败:', err);
    }
  };

  const refreshVaccineAlert = async () => {
    if (!vaccineAlerts.length) return;
    try {
      const data = await vaccineApi.check(vaccineAlerts[0].id);
      setVaccineAlerts([data]);
    } catch (err) {
      // 静默处理
    }
  };

  const handleSubmit = async (values) => {
    try {
      const [checkIn, checkOut] = values.dates;
      const data = {
        pet_id: values.pet_id,
        cage_id: values.cage_id,
        check_in_date: checkIn.format('YYYY-MM-DD'),
        check_out_date: checkOut.format('YYYY-MM-DD'),
        feeding_requirements: values.feeding_requirements || ''
      };
      
      if (editingBooking) {
        data.status = values.status;
        await boardingApi.update(editingBooking.id, data);
        message.success('更新成功');
      } else {
        await boardingApi.create(data);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error(err.error || '保存失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '宠物名称', dataIndex: 'pet_name', key: 'pet_name', width: 120 },
    { title: '宠物品种', dataIndex: 'pet_breed', key: 'pet_breed', width: 120 },
    {
      title: '疫苗状态',
      key: 'vaccine',
      width: 130,
      render: (_, record) => {
        if (!record.pet_vaccine_expiry_date) {
          return (
            <Tooltip title="未设置疫苗到期日期，入店时需提醒主人完善信息">
              <Tag color="default" icon={<WarningOutlined />}>未设置</Tag>
            </Tooltip>
          );
        }
        const s = getVaccineStatus(record.pet_vaccine_expiry_date);
        const tooltipText = s.status === 'expired'
          ? `疫苗已于${record.pet_vaccine_expiry_date}过期，逾期${Math.abs(s.daysRemaining)}天，需立即通知主人补种`
          : s.status === 'expiring'
          ? `疫苗将于${record.pet_vaccine_expiry_date}到期，剩余${s.daysRemaining}天，建议提前通知主人`
          : `疫苗有效期至${record.pet_vaccine_expiry_date}，剩余${s.daysRemaining}天`;
        const tagContent = s.status === 'expired'
          ? `已过期${Math.abs(s.daysRemaining)}天`
          : s.status === 'expiring'
          ? `临期${s.daysRemaining}天`
          : `有效${s.daysRemaining}天`;
        const showIcon = s.status !== 'valid';
        return (
          <Tooltip title={tooltipText}>
            <Tag color={s.color} icon={showIcon ? <WarningOutlined /> : undefined}>
              {tagContent}
            </Tag>
          </Tooltip>
        );
      }
    },
    { title: '笼位', dataIndex: 'cage_name', key: 'cage_name', width: 100 },
    { title: '笼位尺寸', dataIndex: 'cage_size', key: 'cage_size', width: 80 },
    { title: '入住日期', dataIndex: 'check_in_date', key: 'check_in_date', width: 120 },
    { title: '离店日期', dataIndex: 'check_out_date', key: 'check_out_date', width: 120 },
    { 
      title: '费用', 
      dataIndex: 'total_price', 
      key: 'total_price', 
      width: 100,
      render: p => <strong style={{ color: '#f5222d' }}>¥{p}</strong>
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: s => <Tag color={statusColors[s]}>{s}</Tag>
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          {record.status !== '已离店' && record.status !== '已取消' && (
            <>
              <Button size="small" icon={<EditOutlined />} type="primary" onClick={() => handleEdit(record)}>编辑</Button>
              {record.status === '待入住' && (
                <Button size="small" type="success" onClick={() => handleStatusChange(record, '已入住')}>入住</Button>
              )}
              {record.status === '已入住' && (
                <Button size="small" type="success" onClick={() => handleStatusChange(record, '已离店')}>离店</Button>
              )}
              <Popconfirm title="确定取消该预约吗？" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger>取消</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  const getCageCardClass = (cage) => {
    if (conflictCageIds.includes(cage.id)) return 'cage-card conflict';
    if (!availableCages.find(c => c.id === cage.id)) return 'cage-card disabled';
    return 'cage-card';
  };

  const openPendingVaccineAlerts = () => {
    if (pendingCheckinAlerts.length === 0) return;
    setVaccineAlerts(pendingCheckinAlerts);
    setVaccineReminderType('checkin');
    setVaccineModalVisible(true);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">🏠 寄养预约管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增预约
        </Button>
      </div>

      {pendingCheckinAlerts.length > 0 && (
        <Alert
          message={`⚠️ 待入住疫苗提醒：${pendingCheckinAlerts.length} 只即将入店的宠物疫苗临期或已过期`}
          description="入店时将自动弹窗提醒。可点击下方按钮提前查看并发送短信通知主人补种疫苗。"
          type="warning"
          showIcon
          action={
            <Space>
              <Button size="small" type="primary" onClick={openPendingVaccineAlerts}>
                查看并通知主人
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      <div className="search-bar">
        <Select placeholder="状态筛选" style={{ width: 150 }} allowClear onSelect={s => boardingApi.list({ status: s }).then(setBookings)}>
          <Option value="待入住">待入住</Option>
          <Option value="已入住">已入住</Option>
          <Option value="已离店">已离店</Option>
          <Option value="已取消">已取消</Option>
        </Select>
        <Button onClick={loadData}>刷新</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={bookings} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingBooking ? '编辑寄养预约' : '新增寄养预约'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="pet_id" label="选择宠物" rules={[{ required: true, message: '请选择宠物' }]}>
                <Select 
                  placeholder="请选择宠物" 
                  showSearch 
                  optionFilterProp="children"
                  onChange={handlePetSelect}
                >
                  {pets.map(p => {
                    const vaccineTag = (() => {
                      if (!p.vaccine_expiry_date) return <Tag color="default" style={{ marginLeft: 8 }}>未设疫苗</Tag>;
                      const s = getVaccineStatus(p.vaccine_expiry_date);
                      if (s.status === 'expired') return <Tag color="red" style={{ marginLeft: 8 }}>疫苗已过期</Tag>;
                      if (s.status === 'expiring') return <Tag color="orange" style={{ marginLeft: 8 }}>疫苗临期</Tag>;
                      return null;
                    })();
                    return (
                      <Option key={p.id} value={p.id}>
                        <Space>
                          <span>{p.name} ({p.breed}，{p.age}岁)</span>
                          {vaccineTag}
                        </Space>
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dates" label="入住/离店日期" rules={[{ required: true, message: '请选择日期' }]}>
                <RangePicker 
                  style={{ width: '100%' }} 
                  minDate={dayjs()}
                  onChange={handleDateChange}
                  disabledDate={current => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          {selectedPetVaccine && selectedPetVaccine.shouldAlert && (
            <Alert
              message={
                <Space>
                  <WarningOutlined style={{ color: selectedPetVaccine.status === 'expired' ? '#f5222d' : '#faad14' }} />
                  <span>
                    <strong>{selectedPetVaccine.name}</strong> 的疫苗
                    {selectedPetVaccine.status === 'expired'
                      ? `已于 ${selectedPetVaccine.expire_date} 过期（逾期 ${Math.abs(selectedPetVaccine.daysRemaining)} 天）`
                      : `将于 ${selectedPetVaccine.expire_date} 到期（剩余 ${selectedPetVaccine.daysRemaining} 天）`}
                  </span>
                </Space>
              }
              description={
                <Space>
                  <span>入店时会自动弹窗提醒。建议提前联系主人补种疫苗，避免影响寄养安全。</span>
                  {selectedPetVaccine.owner_phone && (
                    <Button
                      size="small"
                      type="primary"
                      danger={selectedPetVaccine.status === 'expired'}
                      onClick={async () => {
                        try {
                          const res = await vaccineApi.sendSms(
                            selectedPetVaccine.id,
                            selectedPetVaccine.status === 'expired' ? 'expired' : 'pre_expire'
                          );
                          message.success(`短信已发送至 ${res.phone}`);
                        } catch (err) {
                          message.error(err.error || '短信发送失败');
                        }
                      }}
                    >
                      立即短信通知主人
                    </Button>
                  )}
                  {!selectedPetVaccine.owner_phone && (
                    <Tag color="default">主人未登记手机号</Tag>
                  )}
                </Space>
              }
              type={selectedPetVaccine.status === 'expired' ? 'error' : 'warning'}
              showIcon={false}
              style={{ marginBottom: 16 }}
            />
          )}

          {selectedDates && selectedDates.length === 2 && (
            <Alert 
              message={`已选择 ${selectedDates[0].format('YYYY-MM-DD')} 至 ${selectedDates[1].format('YYYY-MM-DD')}，共 ${Math.max(1, selectedDates[1].diff(selectedDates[0], 'day'))} 天`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item label="选择笼位" rules={[{ required: true, message: '请选择笼位' }]}>
            <Form.Item name="cage_id" noStyle>
              <Select placeholder="请先选择日期，再选择笼位" disabled={!selectedDates}>
                {availableCages.map(c => (
                  <Option key={c.id} value={c.id}>
                    {c.name} - {c.size} (¥{c.price_per_day}/天)
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            {selectedDates && allCages.length > 0 && (
              <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                {allCages.map(cage => {
                  const isAvailable = availableCages.find(c => c.id === cage.id);
                  const isConflict = conflictCageIds.includes(cage.id);
                  return (
                    <Col xs={12} sm={6} key={cage.id}>
                      <div className={getCageCardClass(cage)}>
                        <div style={{ fontWeight: 600 }}>{cage.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{cage.size}</div>
                        <div style={{ fontSize: 12, color: '#1890ff' }}>¥{cage.price_per_day}/天</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          {isConflict ? <Tag color="red">已预约</Tag> : 
                           isAvailable ? <Tag color="green">可预约</Tag> : 
                           <Tag color="default">{cage.status}</Tag>}
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Form.Item>

          <Form.Item name="feeding_requirements" label="喂食要求">
            <Input.TextArea rows={3} placeholder="请输入特殊喂食要求，如：每日3餐，少食多餐等" />
          </Form.Item>

          {editingBooking && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="待入住">待入住</Option>
                <Option value="已入住">已入住</Option>
                <Option value="已离店">已离店</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="寄养预约详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {viewingBooking && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="宠物名称">{viewingBooking.pet_name}</Descriptions.Item>
            <Descriptions.Item label="宠物品种">{viewingBooking.pet_breed}</Descriptions.Item>
            <Descriptions.Item label="宠物年龄">{viewingBooking.pet_age} 岁</Descriptions.Item>
            <Descriptions.Item label="主人电话">{viewingBooking.pet_owner_phone || '未填写'}</Descriptions.Item>
            <Descriptions.Item label="疫苗到期">
              {viewingBooking.pet_vaccine_expiry_date ? (
                <Space>
                  <span>{viewingBooking.pet_vaccine_expiry_date}</span>
                  {(() => {
                    const s = getVaccineStatus(viewingBooking.pet_vaccine_expiry_date);
                    const word = s.status === 'expired' ? '已过期' : s.status === 'expiring' ? '临期' : '有效';
                    return <Tag color={s.color}>{word}</Tag>;
                  })()}
                </Space>
              ) : '未设置'}
            </Descriptions.Item>
            <Descriptions.Item label="疫苗记录">{viewingBooking.pet_vaccine_records || '无'}</Descriptions.Item>
            <Descriptions.Item label="习性备注">{viewingBooking.pet_habits || '无'}</Descriptions.Item>
            <Descriptions.Item label="笼位">{viewingBooking.cage_name} ({viewingBooking.cage_size})</Descriptions.Item>
            <Descriptions.Item label="入住日期">{viewingBooking.check_in_date}</Descriptions.Item>
            <Descriptions.Item label="离店日期">{viewingBooking.check_out_date}</Descriptions.Item>
            <Descriptions.Item label="喂食要求">{viewingBooking.feeding_requirements || '无'}</Descriptions.Item>
            <Descriptions.Item label="费用">
              <strong style={{ color: '#f5222d' }}>¥{viewingBooking.total_price}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[viewingBooking.status]}>{viewingBooking.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{viewingBooking.created_at}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <VaccineAlertModal
        open={vaccineModalVisible}
        onClose={() => setVaccineModalVisible(false)}
        alerts={vaccineAlerts}
        reminderType={vaccineReminderType}
        onSmsSent={refreshVaccineAlert}
        title="⚠️ 入店疫苗提醒"
        description="该宠物入店时检测到疫苗临期或已过期，请及时通知主人补种疫苗，避免影响寄养安全。"
      />
    </div>
  );
}

export default Boarding;
