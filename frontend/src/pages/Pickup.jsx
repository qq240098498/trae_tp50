import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Space, Modal, Form, Select, DatePicker, 
  message, Popconfirm, Tag, Descriptions, Row, Col, Tabs, Card,
  InputNumber, Divider, Statistic, Upload, Image
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, 
  EyeOutlined, CarOutlined, SettingOutlined, CalculatorOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { pickupApi, petApi } from '../services/api.js';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;

const statusColors = {
  '待接送': 'warning',
  '已接走': 'processing',
  '已送回': 'processing',
  '已完成': 'success',
  '已取消': 'default'
};

const serviceTypeOptions = ['上门接送', '寄养接送', '美容接送'];

function Pickup() {
  const [bookings, setBookings] = useState([]);
  const [pets, setPets] = useState([]);
  const [areas, setAreas] = useState([]);
  const [priceTiers, setPriceTiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [routeData, setRouteData] = useState(null);
  const [routeDate, setRouteDate] = useState(dayjs());
  const [feeCalculation, setFeeCalculation] = useState(null);
  const [form] = Form.useForm();
  const [areaForm] = Form.useForm();
  const [tierForm] = Form.useForm();
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [pickupConfirmVisible, setPickupConfirmVisible] = useState(false);
  const [dropoffConfirmVisible, setDropoffConfirmVisible] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(null);
  const [pickupPhotos, setPickupPhotos] = useState([]);
  const [dropoffPhotos, setDropoffPhotos] = useState([]);
  const [pickupForm] = Form.useForm();
  const [dropoffForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'routes') {
      loadRoutes();
    }
  }, [activeTab, routeDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        pickupApi.list(),
        petApi.list(),
        pickupApi.areas('启用'),
        pickupApi.priceTiers()
      ]);
      const bookingsData = results[0].status === 'fulfilled' ? results[0].value : [];
      const petsData = results[1].status === 'fulfilled' ? results[1].value : [];
      const areasData = results[2].status === 'fulfilled' ? results[2].value : [];
      const tiersData = results[3].status === 'fulfilled' ? results[3].value : [];
      setBookings(bookingsData);
      setPets(petsData);
      setAreas(areasData);
      setPriceTiers(tiersData);
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const data = await pickupApi.routes(routeDate.format('YYYY-MM-DD'));
      setRouteData(data);
    } catch (err) {
      message.error('加载路线数据失败');
    }
  };

  const handleAdd = () => {
    setEditingBooking(null);
    form.resetFields();
    setFeeCalculation(null);
    setModalVisible(true);
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setFeeCalculation(null);
    form.setFieldsValue({
      pet_id: booking.pet_id,
      owner_name: booking.owner_name,
      owner_phone: booking.owner_phone,
      pickup_address: booking.pickup_address,
      pickup_area: booking.pickup_area,
      pickup_date: dayjs(booking.pickup_date),
      pickup_time: booking.pickup_time,
      dropoff_address: booking.dropoff_address,
      distance_km: booking.distance_km,
      pickup_fee: booking.pickup_fee,
      service_type: booking.service_type,
      driver_name: booking.driver_name,
      driver_phone: booking.driver_phone,
      remarks: booking.remarks
    });
    setModalVisible(true);
  };

  const handleView = async (booking) => {
    try {
      const data = await pickupApi.get(booking.id);
      setViewingBooking(data);
      setDetailVisible(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await pickupApi.cancel(id);
      message.success('取消成功');
      loadData();
    } catch (err) {
      message.error(err.error || '取消失败');
    }
  };

  const handleStatusChange = async (record, status) => {
    try {
      await pickupApi.updateStatus(record.id, status);
      message.success('状态更新成功');
      loadData();
      if (activeTab === 'routes') {
        loadRoutes();
      }
    } catch (err) {
      message.error(err.error || '状态更新失败');
    }
  };

  const handleCalculateFee = async () => {
    try {
      const distance = form.getFieldValue('distance_km');
      const area = form.getFieldValue('pickup_area');
      if (!distance) {
        message.warning('请先输入距离');
        return;
      }
      const result = await pickupApi.calculateFee(distance, null, area);
      setFeeCalculation(result);
      form.setFieldsValue({ pickup_fee: result.total_fee });
      message.success('费用计算完成');
    } catch (err) {
      message.error(err.error || '计算失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        pet_id: values.pet_id,
        owner_name: values.owner_name,
        owner_phone: values.owner_phone,
        pickup_address: values.pickup_address,
        pickup_area: values.pickup_area,
        pickup_date: values.pickup_date.format('YYYY-MM-DD'),
        pickup_time: values.pickup_time,
        dropoff_address: values.dropoff_address || '',
        distance_km: values.distance_km,
        pickup_fee: values.pickup_fee || 0,
        service_type: values.service_type || '上门接送',
        driver_name: values.driver_name || '',
        driver_phone: values.driver_phone || '',
        remarks: values.remarks || ''
      };
      
      if (editingBooking) {
        await pickupApi.update(editingBooking.id, data);
        message.success('更新成功');
      } else {
        await pickupApi.create(data);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
      if (activeTab === 'routes') {
        loadRoutes();
      }
    } catch (err) {
      message.error(err.error || '保存失败');
    }
  };

  const handleAddArea = () => {
    setEditingArea(null);
    areaForm.resetFields();
    setAreaModalVisible(true);
  };

  const handleEditArea = (area) => {
    setEditingArea(area);
    areaForm.setFieldsValue({
      name: area.name,
      description: area.description,
      base_price: area.base_price,
      sort_order: area.sort_order
    });
    setAreaModalVisible(true);
  };

  const handleDeleteArea = async (id) => {
    try {
      await pickupApi.deleteArea(id);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error(err.error || '删除失败');
    }
  };

  const handleAreaSubmit = async (values) => {
    try {
      if (editingArea) {
        await pickupApi.updateArea(editingArea.id, values);
        message.success('更新成功');
      } else {
        await pickupApi.createArea(values);
        message.success('创建成功');
      }
      setAreaModalVisible(false);
      loadData();
    } catch (err) {
      message.error(err.error || '保存失败');
    }
  };

  const handleAddTier = () => {
    setEditingTier(null);
    tierForm.resetFields();
    setTierModalVisible(true);
  };

  const handleEditTier = (tier) => {
    setEditingTier(tier);
    tierForm.setFieldsValue({
      min_distance: tier.min_distance,
      max_distance: tier.max_distance,
      price: tier.price,
      description: tier.description,
      sort_order: tier.sort_order
    });
    setTierModalVisible(true);
  };

  const handleDeleteTier = async (id) => {
    try {
      await pickupApi.deletePriceTier(id);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error(err.error || '删除失败');
    }
  };

  const handleTierSubmit = async (values) => {
    try {
      if (editingTier) {
        await pickupApi.updatePriceTier(editingTier.id, values);
        message.success('更新成功');
      } else {
        await pickupApi.createPriceTier(values);
        message.success('创建成功');
      }
      setTierModalVisible(false);
      loadData();
    } catch (err) {
      message.error(err.error || '保存失败');
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handlePickupBeforeUpload = async (file) => {
    try {
      const base64 = await fileToBase64(file);
      setPickupPhotos(prev => [...prev, {
        uid: Date.now() + Math.random(),
        name: file.name,
        status: 'done',
        url: base64
      }]);
    } catch (err) {
      message.error('图片处理失败');
    }
    return false;
  };

  const handleDropoffBeforeUpload = async (file) => {
    try {
      const base64 = await fileToBase64(file);
      setDropoffPhotos(prev => [...prev, {
        uid: Date.now() + Math.random(),
        name: file.name,
        status: 'done',
        url: base64
      }]);
    } catch (err) {
      message.error('图片处理失败');
    }
    return false;
  };

  const handlePickupRemove = (file) => {
    setPickupPhotos(prev => prev.filter(p => p.uid !== file.uid));
  };

  const handleDropoffRemove = (file) => {
    setDropoffPhotos(prev => prev.filter(p => p.uid !== file.uid));
  };

  const handlePickupConfirm = (booking) => {
    setConfirmingBooking(booking);
    setPickupPhotos([]);
    pickupForm.resetFields();
    pickupForm.setFieldsValue({
      pet_status: '健康',
      remarks: '',
      confirmed_by: ''
    });
    setPickupConfirmVisible(true);
  };

  const handleDropoffConfirm = (booking) => {
    setConfirmingBooking(booking);
    setDropoffPhotos([]);
    dropoffForm.resetFields();
    dropoffForm.setFieldsValue({
      pet_status: '健康',
      remarks: '',
      confirmed_by: ''
    });
    setDropoffConfirmVisible(true);
  };

  const handlePickupSubmit = async (values) => {
    try {
      const data = {
        pet_condition_pickup: values.pet_status,
        pickup_remark: values.remarks || '',
        confirmed_by: values.confirmed_by || '',
        pickup_photo: pickupPhotos.map(p => p.url).join(',')
      };
      await pickupApi.pickupConfirm(confirmingBooking.id, data);
      message.success('接走确认成功');
      setPickupConfirmVisible(false);
      loadData();
      if (activeTab === 'routes') {
        loadRoutes();
      }
    } catch (err) {
      message.error(err.error || '确认失败');
    }
  };

  const handleDropoffSubmit = async (values) => {
    try {
      const data = {
        pet_condition_dropoff: values.pet_status,
        dropoff_remark: values.remarks || '',
        confirmed_by: values.confirmed_by || '',
        dropoff_photo: dropoffPhotos.map(p => p.url).join(',')
      };
      await pickupApi.dropoffConfirm(confirmingBooking.id, data);
      message.success('送回确认成功');
      setDropoffConfirmVisible(false);
      loadData();
      if (activeTab === 'routes') {
        loadRoutes();
      }
    } catch (err) {
      message.error(err.error || '确认失败');
    }
  };

  const bookingColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '宠物名称', dataIndex: 'pet_name', key: 'pet_name', width: 100, render: (v) => v || '-' },
    { title: '主人姓名', dataIndex: 'owner_name', key: 'owner_name', width: 100 },
    { title: '联系电话', dataIndex: 'owner_phone', key: 'owner_phone', width: 120 },
    { title: '接送区域', dataIndex: 'pickup_area', key: 'pickup_area', width: 100 },
    { title: '接送地址', dataIndex: 'pickup_address', key: 'pickup_address', width: 180, ellipsis: true },
    { title: '接送日期', dataIndex: 'pickup_date', key: 'pickup_date', width: 110 },
    { title: '接送时间', dataIndex: 'pickup_time', key: 'pickup_time', width: 90 },
    { title: '距离(km)', dataIndex: 'distance_km', key: 'distance_km', width: 90, render: (v) => v ? `${v} km` : '-' },
    { 
      title: '接送费', 
      dataIndex: 'pickup_fee', 
      key: 'pickup_fee', 
      width: 90,
      render: p => <strong style={{ color: '#f5222d' }}>¥{p}</strong>
    },
    { title: '服务类型', dataIndex: 'service_type', key: 'service_type', width: 100 },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 90,
      render: s => <Tag color={statusColors[s]}>{s}</Tag>
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          {record.status !== '已完成' && record.status !== '已取消' && (
            <>
              <Button size="small" icon={<EditOutlined />} type="primary" onClick={() => handleEdit(record)}>编辑</Button>
              {record.status === '待接送' && (
                <Button size="small" type="success" onClick={() => handlePickupConfirm(record)}>接走</Button>
              )}
              {record.status === '已接走' && (
                <Button size="small" type="success" onClick={() => handleDropoffConfirm(record)}>送回</Button>
              )}
              {(record.status === '已送回' || record.status === '已接走') && (
                <Button size="small" type="primary" onClick={() => handleStatusChange(record, '已完成')}>完成</Button>
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

  const areaColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '区域名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
    { title: '基础费用', dataIndex: 'base_price', key: 'base_price', width: 100, render: p => `¥${p}` },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: s => <Tag color={s === '启用' ? 'green' : 'default'}>{s}</Tag> },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditArea(record)}>编辑</Button>
          <Popconfirm title="确定删除该区域吗？" onConfirm={() => handleDeleteArea(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const tierColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '最小距离(km)', dataIndex: 'min_distance', key: 'min_distance', width: 120 },
    { title: '最大距离(km)', dataIndex: 'max_distance', key: 'max_distance', width: 120 },
    { title: '价格', dataIndex: 'price', key: 'price', width: 100, render: p => <strong style={{ color: '#f5222d' }}>¥{p}</strong> },
    { title: '描述', dataIndex: 'description', key: 'description', width: 150 },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditTier(record)}>编辑</Button>
          <Popconfirm title="确定删除该价格区间吗？" onConfirm={() => handleDeleteTier(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const renderRouteContent = () => {
    if (!routeData) {
      return <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>;
    }
    
    if (routeData.routes.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <CarOutlined style={{ fontSize: 48, marginBottom: 16, color: '#ddd' }} />
          <div>当日暂无接送预约</div>
        </div>
      );
    }
    
    return (
      <Row gutter={[16, 16]}>
        {routeData.routes.map((route, index) => (
          <Col xs={24} sm={12} lg={8} key={index}>
            <Card 
              title={
                <Space>
                  <CarOutlined />
                  <span>{route.area}</span>
                  <Tag color="blue">{route.booking_count} 单</Tag>
                </Space>
              }
              extra={<strong style={{ color: '#f5222d' }}>¥{route.total_fee}</strong>}
            >
              {route.bookings.map((booking, bIndex) => (
                <div key={booking.id} style={{ 
                  padding: '8px 0', 
                  borderBottom: bIndex < route.bookings.length - 1 ? '1px solid #f0f0f0' : 'none' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>{booking.pickup_time}</strong>
                    <Tag color={statusColors[booking.status]}>{booking.status}</Tag>
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    <div>👤 {booking.owner_name} ({booking.owner_phone})</div>
                    <div>📍 {booking.pickup_address}</div>
                    {booking.pet_name && <div>🐾 {booking.pet_name}</div>}
                  </div>
                </div>
              ))}
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">🚗 接送服务管理</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增接送
          </Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="接送预约" key="list">
          <div className="search-bar">
            <Select 
              placeholder="状态筛选" 
              style={{ width: 130 }} 
              allowClear 
              onSelect={s => pickupApi.list({ status: s }).then(setBookings)}
            >
              <Option value="待接送">待接送</Option>
              <Option value="已接走">已接走</Option>
              <Option value="已送回">已送回</Option>
              <Option value="已完成">已完成</Option>
              <Option value="已取消">已取消</Option>
            </Select>
            <Select 
              placeholder="区域筛选" 
              style={{ width: 130 }} 
              allowClear 
              onSelect={s => pickupApi.list({ area: s }).then(setBookings)}
            >
              {areas.map(a => (
                <Option key={a.id} value={a.name}>{a.name}</Option>
              ))}
            </Select>
            <Input 
              placeholder="搜索姓名/电话/地址" 
              style={{ width: 200 }} 
              allowClear 
              prefix={<SearchOutlined />}
              onPressEnter={e => pickupApi.list({ keyword: e.target.value }).then(setBookings)}
            />
            <Button onClick={loadData}>刷新</Button>
          </div>

          <Table 
            columns={bookingColumns} 
            dataSource={bookings} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1500 }}
          />
        </TabPane>

        <TabPane tab="路线归拢" key="routes">
          <div className="search-bar">
            <span>选择日期：</span>
            <DatePicker 
              value={routeDate} 
              onChange={setRouteDate} 
              allowClear={false}
            />
            <Space>
              <Statistic title="路线数量" value={routeData?.total_routes || 0} style={{ marginLeft: 20 }} />
              <Statistic title="接送单量" value={routeData?.total_bookings || 0} />
              <Statistic 
                title="预估总额" 
                value={routeData?.total_fee || 0} 
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#f5222d' }}
              />
            </Space>
          </div>
          {renderRouteContent()}
        </TabPane>

        <TabPane tab="价格配置" key="settings">
          <Card 
            title={
              <Space>
                <SettingOutlined />
                <span>接送区域配置</span>
              </Space>
            }
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddArea}>
                新增区域
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            <Table 
              columns={areaColumns} 
              dataSource={areas} 
              rowKey="id" 
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>

          <Card 
            title={
              <Space>
                <CalculatorOutlined />
                <span>距离价格区间配置</span>
              </Space>
            }
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddTier}>
                新增价格区间
              </Button>
            }
          >
            <Table 
              columns={tierColumns} 
              dataSource={priceTiers} 
              rowKey="id" 
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingBooking ? '编辑接送预约' : '新增接送预约'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="pet_id" label="关联宠物">
                <Select placeholder="请选择宠物（可选）" showSearch optionFilterProp="children" allowClear>
                  {pets.map(p => (
                    <Option key={p.id} value={p.id}>
                      {p.name} ({p.breed}，{p.age}岁)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="service_type" label="服务类型" initialValue="上门接送">
                <Select>
                  {serviceTypeOptions.map(t => (
                    <Option key={t} value={t}>{t}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="owner_name" label="主人姓名" rules={[{ required: true, message: '请输入主人姓名' }]}>
                <Input placeholder="请输入主人姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="owner_phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="pickup_area" label="接送区域" rules={[{ required: true, message: '请选择接送区域' }]}>
                <Select placeholder="请选择接送区域">
                  {areas.map(a => (
                    <Option key={a.id} value={a.name}>{a.name} (基础费: ¥{a.base_price})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="pickup_date" label="接送日期" rules={[{ required: true, message: '请选择接送日期' }]}>
                <DatePicker style={{ width: '100%' }} minDate={dayjs()} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="pickup_address" label="接送地址" rules={[{ required: true, message: '请输入接送地址' }]}>
                <Input placeholder="请输入详细接送地址" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="pickup_time" label="接送时间" rules={[{ required: true, message: '请选择接送时间' }]}>
                <Select placeholder="请选择时间段">
                  <Option value="08:00-09:00">08:00-09:00</Option>
                  <Option value="09:00-10:00">09:00-10:00</Option>
                  <Option value="10:00-11:00">10:00-11:00</Option>
                  <Option value="14:00-15:00">14:00-15:00</Option>
                  <Option value="15:00-16:00">15:00-16:00</Option>
                  <Option value="16:00-17:00">16:00-17:00</Option>
                  <Option value="17:00-18:00">17:00-18:00</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="distance_km" label="距离(公里)">
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0} 
                  step={0.5} 
                  placeholder="请输入距离" 
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="费用计算">
                <Button icon={<CalculatorOutlined />} onClick={handleCalculateFee}>
                  自动计算费用
                </Button>
              </Form.Item>
            </Col>
          </Row>

          {feeCalculation && (
            <div style={{ 
              padding: 12, 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f', 
              borderRadius: 4, 
              marginBottom: 16 
            }}>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ color: '#666', fontSize: 12 }}>距离</div>
                  <div style={{ fontWeight: 600 }}>{feeCalculation.distance_km} km</div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#666', fontSize: 12 }}>基础费</div>
                  <div style={{ fontWeight: 600 }}>¥{feeCalculation.base_price}</div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#666', fontSize: 12 }}>总计</div>
                  <div style={{ fontWeight: 600, color: '#f5222d' }}>¥{feeCalculation.total_fee}</div>
                </Col>
              </Row>
              {feeCalculation.matched_tier && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  适用区间：{feeCalculation.matched_tier.description}（¥{feeCalculation.distance_price.toFixed(2)}）
                </div>
              )}
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="pickup_fee" label="接送费用">
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0} 
                  prefix="¥"
                  placeholder="手动输入或自动计算" 
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dropoff_address" label="送回地址">
                <Input placeholder="默认为接送地址（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="driver_name" label="司机姓名">
                <Input placeholder="请输入司机姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="driver_phone" label="司机电话">
                <Input placeholder="请输入司机电话" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注信息" />
          </Form.Item>

          {editingBooking && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="待接送">待接送</Option>
                <Option value="已接走">已接走</Option>
                <Option value="已送回">已送回</Option>
                <Option value="已完成">已完成</Option>
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
        title="接走确认"
        open={pickupConfirmVisible}
        onCancel={() => setPickupConfirmVisible(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {confirmingBooking && (
          <Form form={pickupForm} layout="vertical" onFinish={handlePickupSubmit}>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="宠物名称">
                  {confirmingBooking.pet_name || '未关联'}
                </Descriptions.Item>
                <Descriptions.Item label="主人姓名">
                  {confirmingBooking.owner_name}
                </Descriptions.Item>
                <Descriptions.Item label="联系电话">
                  {confirmingBooking.owner_phone}
                </Descriptions.Item>
                <Descriptions.Item label="接送地址">
                  {confirmingBooking.pickup_address}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Form.Item 
              name="pet_status" 
              label="宠物状态" 
              rules={[{ required: true, message: '请选择宠物状态' }]}
            >
              <Select>
                <Option value="健康">健康</Option>
                <Option value="轻微不适">轻微不适</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>

            <Form.Item label="照片上传">
              <Upload
                listType="picture-card"
                fileList={pickupPhotos}
                beforeUpload={handlePickupBeforeUpload}
                onRemove={handlePickupRemove}
                multiple
                accept="image/*"
              >
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              </Upload>
            </Form.Item>

            <Form.Item name="remarks" label="接走备注">
              <Input.TextArea rows={3} placeholder="请输入接走备注信息" />
            </Form.Item>

            <Form.Item 
              name="confirmed_by" 
              label="确认人" 
              rules={[{ required: true, message: '请输入确认人' }]}
            >
              <Input placeholder="请输入确认人姓名" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setPickupConfirmVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">确认接走</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="送回确认"
        open={dropoffConfirmVisible}
        onCancel={() => setDropoffConfirmVisible(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {confirmingBooking && (
          <Form form={dropoffForm} layout="vertical" onFinish={handleDropoffSubmit}>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="宠物名称">
                  {confirmingBooking.pet_name || '未关联'}
                </Descriptions.Item>
                <Descriptions.Item label="主人姓名">
                  {confirmingBooking.owner_name}
                </Descriptions.Item>
                <Descriptions.Item label="联系电话">
                  {confirmingBooking.owner_phone}
                </Descriptions.Item>
                <Descriptions.Item label="送回地址">
                  {confirmingBooking.dropoff_address || confirmingBooking.pickup_address}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Form.Item 
              name="pet_status" 
              label="宠物状态" 
              rules={[{ required: true, message: '请选择宠物状态' }]}
            >
              <Select>
                <Option value="健康">健康</Option>
                <Option value="轻微不适">轻微不适</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>

            <Form.Item label="照片上传">
              <Upload
                listType="picture-card"
                fileList={dropoffPhotos}
                beforeUpload={handleDropoffBeforeUpload}
                onRemove={handleDropoffRemove}
                multiple
                accept="image/*"
              >
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              </Upload>
            </Form.Item>

            <Form.Item name="remarks" label="送回备注">
              <Input.TextArea rows={3} placeholder="请输入送回备注信息" />
            </Form.Item>

            <Form.Item 
              name="confirmed_by" 
              label="确认人" 
              rules={[{ required: true, message: '请输入确认人' }]}
            >
              <Input placeholder="请输入确认人姓名" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setDropoffConfirmVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">确认送回</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="接送预约详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={650}
      >
        {viewingBooking && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="服务类型">{viewingBooking.service_type}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[viewingBooking.status]}>{viewingBooking.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="宠物名称">{viewingBooking.pet_name || '未关联'}</Descriptions.Item>
              <Descriptions.Item label="主人姓名">{viewingBooking.owner_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{viewingBooking.owner_phone}</Descriptions.Item>
              <Descriptions.Item label="接送区域">{viewingBooking.pickup_area}</Descriptions.Item>
              <Descriptions.Item label="接送地址">{viewingBooking.pickup_address}</Descriptions.Item>
              <Descriptions.Item label="送回地址">{viewingBooking.dropoff_address || '同接送地址'}</Descriptions.Item>
              <Descriptions.Item label="接送日期">{viewingBooking.pickup_date}</Descriptions.Item>
              <Descriptions.Item label="接送时间">{viewingBooking.pickup_time}</Descriptions.Item>
              <Descriptions.Item label="距离">{viewingBooking.distance_km ? `${viewingBooking.distance_km} 公里` : '未设置'}</Descriptions.Item>
              <Descriptions.Item label="接送费用">
                <strong style={{ color: '#f5222d' }}>¥{viewingBooking.pickup_fee}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="司机姓名">{viewingBooking.driver_name || '未安排'}</Descriptions.Item>
              <Descriptions.Item label="司机电话">{viewingBooking.driver_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{viewingBooking.remarks || '无'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{viewingBooking.created_at}</Descriptions.Item>
            </Descriptions>

            {viewingBooking.pickup_at && (
              <Card size="small" title="接走信息" style={{ marginBottom: 16 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="接走时间">
                    {viewingBooking.pickup_at || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="宠物状态">
                    {viewingBooking.pet_condition_pickup || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="接走备注">
                    {viewingBooking.pickup_remark || '无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认人">
                    {viewingBooking.pickup_confirmed_by || '-'}
                  </Descriptions.Item>
                  {viewingBooking.pickup_photo && (
                    <Descriptions.Item label="接走照片">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {viewingBooking.pickup_photo.split(',').filter(Boolean).map((photo, index) => (
                          <Image
                            key={index}
                            width={60}
                            height={60}
                            src={photo}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                      </div>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {viewingBooking.dropoff_at && (
              <Card size="small" title="送回信息">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="送回时间">
                    {viewingBooking.dropoff_at || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="宠物状态">
                    {viewingBooking.pet_condition_dropoff || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="送回备注">
                    {viewingBooking.dropoff_remark || '无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认人">
                    {viewingBooking.dropoff_confirmed_by || '-'}
                  </Descriptions.Item>
                  {viewingBooking.dropoff_photo && (
                    <Descriptions.Item label="送回照片">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {viewingBooking.dropoff_photo.split(',').filter(Boolean).map((photo, index) => (
                          <Image
                            key={index}
                            width={60}
                            height={60}
                            src={photo}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                      </div>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={editingArea ? '编辑接送区域' : '新增接送区域'}
        open={areaModalVisible}
        onCancel={() => setAreaModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={areaForm} layout="vertical" onFinish={handleAreaSubmit}>
          <Form.Item name="name" label="区域名称" rules={[{ required: true, message: '请输入区域名称' }]}>
            <Input placeholder="请输入区域名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="请输入区域描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="base_price" label="基础费用" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAreaModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingTier ? '编辑价格区间' : '新增价格区间'}
        open={tierModalVisible}
        onCancel={() => setTierModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={tierForm} layout="vertical" onFinish={handleTierSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="min_distance" label="最小距离(公里)" rules={[{ required: true, message: '请输入最小距离' }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_distance" label="最大距离(公里)" rules={[{ required: true, message: '请输入最大距离' }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="price" label="价格" rules={[{ required: true, message: '请输入价格' }]}>
            <InputNumber style={{ width: '100%' }} min={0} prefix="¥" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="例如：5公里内" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setTierModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Pickup;
