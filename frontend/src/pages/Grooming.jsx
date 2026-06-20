import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Space, Modal, Form, Select, DatePicker, 
  message, Popconfirm, Tag, Descriptions, Row, Col, Alert, Radio 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ScissorOutlined } from '@ant-design/icons';
import { groomingApi, petApi } from '../services/api.js';
import dayjs from 'dayjs';

const { Option } = Select;

const statusColors = {
  '待服务': 'warning',
  '服务中': 'processing',
  '已完成': 'success',
  '已取消': 'default'
};

const servicePrices = {
  '洗澡': 80,
  '剪毛': 150,
  'SPA': 200,
  '洁牙': 120
};

const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

function Grooming() {
  const [bookings, setBookings] = useState([]);
  const [pets, setPets] = useState([]);
  const [groomers, setGroomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [availableGroomers, setAvailableGroomers] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        groomingApi.list(),
        petApi.list(),
        groomingApi.groomers()
      ]);
      const bookingsData = results[0].status === 'fulfilled' ? results[0].value : [];
      const petsData = results[1].status === 'fulfilled' ? results[1].value : [];
      const groomersData = results[2].status === 'fulfilled' ? results[2].value : [];
      setBookings(bookingsData);
      setPets(petsData);
      setGroomers(groomersData);
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableGroomers = async (date, excludeId = null) => {
    try {
      const data = await groomingApi.availableGroomers(
        date.format('YYYY-MM-DD'),
        excludeId
      );
      setAvailableGroomers(data.groomers);
    } catch (err) {
      message.error('加载可用美容师失败');
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (date) {
      loadAvailableGroomers(date, editingBooking?.id);
    } else {
      setAvailableGroomers([]);
    }
  };

  const handleAdd = () => {
    setEditingBooking(null);
    form.resetFields();
    setSelectedDate(null);
    setSelectedService(null);
    setAvailableGroomers([]);
    setModalVisible(true);
  };

  const handleEdit = async (booking) => {
    setEditingBooking(booking);
    const date = dayjs(booking.appointment_date);
    setSelectedDate(date);
    setSelectedService(booking.service_type);
    
    form.setFieldsValue({
      pet_id: booking.pet_id,
      groomer_id: booking.groomer_id,
      appointment_date: date,
      appointment_time: booking.appointment_time,
      service_type: booking.service_type,
      status: booking.status
    });
    
    await loadAvailableGroomers(date, booking.id);
    setModalVisible(true);
  };

  const handleView = async (booking) => {
    try {
      const data = await groomingApi.get(booking.id);
      setViewingBooking(data);
      setDetailVisible(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await groomingApi.cancel(id);
      message.success('取消成功');
      loadData();
    } catch (err) {
      message.error(err.error || '取消失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await groomingApi.updateStatus(id, status);
      message.success('状态更新成功');
      loadData();
    } catch (err) {
      message.error(err.error || '状态更新失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        pet_id: values.pet_id,
        groomer_id: values.groomer_id,
        appointment_date: values.appointment_date.format('YYYY-MM-DD'),
        appointment_time: values.appointment_time,
        service_type: values.service_type
      };
      
      if (editingBooking) {
        data.status = values.status;
        await groomingApi.update(editingBooking.id, data);
        message.success('更新成功');
      } else {
        await groomingApi.create(data);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error(err.error || '保存失败');
    }
  };

  const selectedGroomer = availableGroomers.find(
    g => g.id === form.getFieldValue('groomer_id')
  );

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '宠物名称', dataIndex: 'pet_name', key: 'pet_name', width: 120 },
    { title: '宠物品种', dataIndex: 'pet_breed', key: 'pet_breed', width: 120 },
    { title: '服务项目', dataIndex: 'service_type', key: 'service_type', width: 100 },
    { title: '美容师', dataIndex: 'groomer_name', key: 'groomer_name', width: 100 },
    { title: '预约日期', dataIndex: 'appointment_date', key: 'appointment_date', width: 120 },
    { title: '预约时间', dataIndex: 'appointment_time', key: 'appointment_time', width: 100 },
    { 
      title: '费用', 
      dataIndex: 'price', 
      key: 'price', 
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
          {record.status !== '已完成' && record.status !== '已取消' && (
            <>
              <Button size="small" icon={<EditOutlined />} type="primary" onClick={() => handleEdit(record)}>编辑</Button>
              {record.status === '待服务' && (
                <Button size="small" type="success" onClick={() => handleStatusChange(record.id, '服务中')}>开始</Button>
              )}
              {record.status === '服务中' && (
                <Button size="small" type="success" onClick={() => handleStatusChange(record.id, '已完成')}>完成</Button>
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

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">✂️ 美容预约管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增预约
        </Button>
      </div>

      <div className="search-bar">
        <Select placeholder="状态筛选" style={{ width: 150 }} allowClear onSelect={s => groomingApi.list({ status: s }).then(setBookings)}>
          <Option value="待服务">待服务</Option>
          <Option value="服务中">服务中</Option>
          <Option value="已完成">已完成</Option>
          <Option value="已取消">已取消</Option>
        </Select>
        <Select placeholder="服务项目" style={{ width: 150 }} allowClear onSelect={s => groomingApi.list().then(data => setBookings(data.filter(b => b.service_type === s)))}>
          {Object.keys(servicePrices).map(s => (
            <Option key={s} value={s}>{s} (¥{servicePrices[s]})</Option>
          ))}
        </Select>
        <Button onClick={loadData}>刷新</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={bookings} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingBooking ? '编辑美容预约' : '新增美容预约'}
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
                <Select placeholder="请选择宠物" showSearch optionFilterProp="children">
                  {pets.map(p => (
                    <Option key={p.id} value={p.id}>{p.name} ({p.breed}，{p.age}岁)</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="service_type" label="服务项目" rules={[{ required: true, message: '请选择服务项目' }]}>
                <Radio.Group 
                  onChange={e => setSelectedService(e.target.value)}
                  value={selectedService}
                  style={{ width: '100%' }}
                >
                  <Space wrap>
                    {Object.entries(servicePrices).map(([name, price]) => (
                      <Radio.Button key={name} value={name}>
                        {name} ¥{price}
                      </Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="appointment_date" label="预约日期" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker 
                  style={{ width: '100%' }} 
                  minDate={dayjs()}
                  onChange={handleDateChange}
                  disabledDate={current => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="appointment_time" label="预约时间" rules={[{ required: true, message: '请选择时间' }]}>
                <Select placeholder="请先选择日期和美容师" disabled={!selectedDate || !form.getFieldValue('groomer_id')}>
                  {selectedGroomer?.availableTimes?.map(t => (
                    <Option key={t} value={t}>{t}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="groomer_id" label="选择美容师" rules={[{ required: true, message: '请选择美容师' }]}>
            <Select 
              placeholder="请先选择日期" 
              disabled={!selectedDate}
              onChange={() => form.setFieldsValue({ appointment_time: undefined })}
            >
              {availableGroomers.map(g => (
                <Option key={g.id} value={g.id} disabled={g.availableTimes.length === 0}>
                  {g.name} {g.phone ? `(${g.phone})` : ''} - 剩余{g.availableTimes.length}个时段
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedDate && selectedGroomer && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                {selectedGroomer.name} 的可用时段：
              </div>
              <div>
                {timeSlots.map(t => {
                  const isBusy = selectedGroomer.busyTimes.includes(t);
                  const isSelected = form.getFieldValue('appointment_time') === t;
                  return (
                    <span 
                      key={t}
                      className={`time-slot ${isBusy ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (!isBusy) {
                          form.setFieldsValue({ appointment_time: t });
                        }
                      }}
                    >
                      {t} {isBusy ? '(已约)' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {editingBooking && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="待服务">待服务</Option>
                <Option value="服务中">服务中</Option>
                <Option value="已完成">已完成</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            </Form.Item>
          )}

          {selectedService && (
            <Alert 
              message={`服务项目：${selectedService}，费用：¥${servicePrices[selectedService]}`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
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
        title="美容预约详情"
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
            <Descriptions.Item label="疫苗记录">{viewingBooking.pet_vaccine_records || '无'}</Descriptions.Item>
            <Descriptions.Item label="习性备注">{viewingBooking.pet_habits || '无'}</Descriptions.Item>
            <Descriptions.Item label="服务项目">
              <Tag color="blue">{viewingBooking.service_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="美容师">{viewingBooking.groomer_name} ({viewingBooking.groomer_phone || '-'})</Descriptions.Item>
            <Descriptions.Item label="预约日期">{viewingBooking.appointment_date}</Descriptions.Item>
            <Descriptions.Item label="预约时间">{viewingBooking.appointment_time}</Descriptions.Item>
            <Descriptions.Item label="费用">
              <strong style={{ color: '#f5222d' }}>¥{viewingBooking.price}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[viewingBooking.status]}>{viewingBooking.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{viewingBooking.created_at}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default Grooming;
