import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Space, Modal, Form, InputNumber, DatePicker,
  message, Popconfirm, Tag, Descriptions 
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { petApi } from '../services/api.js';
import { getVaccineStatus } from '../utils/vaccine.js';
import dayjs from 'dayjs';

function Pets() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [viewingPet, setViewingPet] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async (kw = '') => {
    try {
      setLoading(true);
      const data = await petApi.list(kw);
      setPets(data);
    } catch (err) {
      message.error('加载宠物档案失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPets(keyword);
  };

  const handleAdd = () => {
    setEditingPet(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (pet) => {
    setEditingPet(pet);
    form.setFieldsValue({
      ...pet,
      vaccine_expiry_date: pet.vaccine_expiry_date ? dayjs(pet.vaccine_expiry_date) : null
    });
    setModalVisible(true);
  };

  const handleView = async (pet) => {
    try {
      const data = await petApi.get(pet.id);
      setViewingPet(data);
      setDetailVisible(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await petApi.delete(id);
      message.success('删除成功');
      loadPets(keyword);
    } catch (err) {
      message.error(err.error || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        vaccine_expiry_date: values.vaccine_expiry_date
          ? dayjs(values.vaccine_expiry_date).format('YYYY-MM-DD')
          : ''
      };
      if (editingPet) {
        await petApi.update(editingPet.id, payload);
        message.success('更新成功');
      } else {
        await petApi.create(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadPets(keyword);
    } catch (err) {
      message.error(err.error || '保存失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '宠物名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '品种', dataIndex: 'breed', key: 'breed', width: 150 },
    { title: '年龄', dataIndex: 'age', key: 'age', width: 80, render: a => `${a}岁` },
    { 
      title: '疫苗状态', 
      key: 'vaccine',
      width: 120,
      render: (_, record) => {
        if (!record.vaccine_expiry_date && !record.vaccine_records) {
          return <Tag color="default">无记录</Tag>;
        }
        if (!record.vaccine_expiry_date) {
          return <Tag color="green">已接种</Tag>;
        }
        const s = getVaccineStatus(record.vaccine_expiry_date);
        return <Tag color={s.color}>{s.label}</Tag>;
      }
    },
    { 
      title: '疫苗到期', 
      dataIndex: 'vaccine_expiry_date', 
      key: 'vaccine_expiry_date',
      width: 120,
      render: d => d || '-'
    },
    { 
      title: '主人电话', 
      dataIndex: 'owner_phone', 
      key: 'owner_phone', 
      width: 130,
      render: p => p || '-'
    },
    { 
      title: '习性备注', 
      dataIndex: 'habits', 
      key: 'habits', 
      ellipsis: true,
      render: h => h || '-'
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: t => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} type="primary" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该宠物档案吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">🐕 宠物档案管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增宠物
        </Button>
      </div>

      <div className="search-bar">
        <Input 
          placeholder="搜索宠物名称或品种" 
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 300 }}
          suffix={<SearchOutlined onClick={handleSearch} />}
        />
        <Button onClick={handleSearch}>搜索</Button>
        <Button onClick={() => { setKeyword(''); loadPets(''); }}>重置</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={pets} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1300 }}
      />

      <Modal
        title={editingPet ? '编辑宠物档案' : '新增宠物档案'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="宠物名称" rules={[{ required: true, message: '请输入宠物名称' }]}>
            <Input placeholder="请输入宠物名称" />
          </Form.Item>
          <Form.Item name="breed" label="品种" rules={[{ required: true, message: '请输入品种' }]}>
            <Input placeholder="如：金毛、泰迪、布偶等" />
          </Form.Item>
          <Form.Item name="age" label="年龄" rules={[{ required: true, message: '请输入年龄' }]}>
            <InputNumber min={0} max={50} style={{ width: '100%' }} placeholder="请输入年龄" />
          </Form.Item>
          <Form.Item name="owner_phone" label="主人电话" tooltip="用于疫苗到期短信提醒">
            <Input placeholder="请输入主人手机号，如：13800138000" />
          </Form.Item>
          <Form.Item name="vaccine_expiry_date" label="疫苗到期日期" tooltip="设置后系统将在临期/过期时自动提醒">
            <DatePicker style={{ width: '100%' }} placeholder="请选择疫苗到期日期" />
          </Form.Item>
          <Form.Item name="vaccine_records" label="疫苗记录">
            <Input.TextArea rows={3} placeholder="请输入疫苗接种记录，如：2024-01-15 接种狂犬疫苗" />
          </Form.Item>
          <Form.Item name="habits" label="习性备注">
            <Input.TextArea rows={3} placeholder="请输入宠物习性、注意事项等" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="宠物档案详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {viewingPet && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="宠物名称">{viewingPet.name}</Descriptions.Item>
            <Descriptions.Item label="品种">{viewingPet.breed}</Descriptions.Item>
            <Descriptions.Item label="年龄">{viewingPet.age} 岁</Descriptions.Item>
            <Descriptions.Item label="主人电话">{viewingPet.owner_phone || '未填写'}</Descriptions.Item>
            <Descriptions.Item label="疫苗到期日期">
              {viewingPet.vaccine_expiry_date ? (
                <Space>
                  <span>{viewingPet.vaccine_expiry_date}</span>
                  {(() => {
                    const s = getVaccineStatus(viewingPet.vaccine_expiry_date);
                    return <Tag color={s.color}>{s.label}</Tag>;
                  })()}
                </Space>
              ) : '未设置'}
            </Descriptions.Item>
            <Descriptions.Item label="疫苗记录">
              {viewingPet.vaccine_records || '暂无记录'}
            </Descriptions.Item>
            <Descriptions.Item label="习性备注">
              {viewingPet.habits || '暂无备注'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(viewingPet.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(viewingPet.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default Pets;
