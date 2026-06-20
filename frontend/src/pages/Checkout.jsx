import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Select, Form, Radio, Space, message, Divider, 
  Descriptions, Tag, Modal, Table, InputNumber, Row, Col, Alert 
} from 'antd';
import { DollarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { transactionApi, petApi, boardingApi } from '../services/api.js';
import dayjs from 'dayjs';

const { Option } = Select;

function Checkout() {
  const [pets, setPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [boardingBookings, setBoardingBookings] = useState([]);
  const [selectedBoarding, setSelectedBoarding] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('微信');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async () => {
    try {
      const data = await petApi.list();
      setPets(data);
    } catch (err) {
      message.error('加载宠物列表失败');
    }
  };

  const handlePetChange = async (petId) => {
    setSelectedPet(petId);
    setCheckoutData(null);
    setSelectedBoarding(null);
    
    try {
      const data = await boardingApi.list({ pet_id: petId, status: '已入住' });
      setBoardingBookings(data);
      
      if (data.length > 0) {
        setSelectedBoarding(data[0].id);
        previewCheckout(petId, data[0].id);
      } else {
        previewCheckout(petId);
      }
    } catch (err) {
      message.error('获取寄养预约失败');
    }
  };

  const previewCheckout = async (petId, boardingId = null) => {
    try {
      setLoading(true);
      const data = await transactionApi.checkoutPreview(petId, boardingId);
      setCheckoutData(data);
    } catch (err) {
      message.error('获取结算信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBoardingChange = (boardingId) => {
    setSelectedBoarding(boardingId);
    if (selectedPet) {
      previewCheckout(selectedPet, boardingId);
    }
  };

  const handleCheckout = async () => {
    if (!checkoutData) return;
    
    try {
      setLoading(true);
      const finalAmount = checkoutData.summary.grand_total - discount;
      
      const data = {
        pet_id: selectedPet,
        boarding_booking_id: selectedBoarding,
        payment_method: paymentMethod,
        amount: finalAmount,
        details: checkoutData.details
      };
      
      const result = await transactionApi.checkout(data);
      setReceipt(result.receipt);
      setSuccessModal(true);
      
      setSelectedPet(null);
      setSelectedBoarding(null);
      setCheckoutData(null);
      setDiscount(0);
      form.resetFields();
      loadPets();
    } catch (err) {
      message.error(err.error || '结算失败');
    } finally {
      setLoading(false);
    }
  };

  const finalAmount = checkoutData ? checkoutData.summary.grand_total - discount : 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">💰 收银结算</h2>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title="选择结算宠物" style={{ marginBottom: 24 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="选择宠物" rules={[{ required: true, message: '请选择宠物' }]}>
                    <Select 
                      placeholder="请选择要结算的宠物" 
                      showSearch 
                      optionFilterProp="children"
                      value={selectedPet}
                      onChange={handlePetChange}
                    >
                      {pets.map(p => (
                        <Option key={p.id} value={p.id}>
                          {p.name} ({p.breed}，{p.age}岁)
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                {boardingBookings.length > 0 && (
                  <Col xs={24} sm={12}>
                    <Form.Item label="关联寄养预约">
                      <Select 
                        placeholder="选择关联的寄养预约"
                        value={selectedBoarding}
                        onChange={handleBoardingChange}
                      >
                        {boardingBookings.map(b => (
                          <Option key={b.id} value={b.id}>
                            {b.cage_name} | {b.check_in_date} 至 {b.check_out_date}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
              </Row>
            </Form>
          </Card>

          {checkoutData && (
            <>
              {checkoutData.boarding && (
                <Card title="🏠 寄养费用" style={{ marginBottom: 24 }}>
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="笼位">{checkoutData.boarding.cage_name} ({checkoutData.boarding.cage_size})</Descriptions.Item>
                    <Descriptions.Item label="入住日期">{checkoutData.boarding.check_in_date}</Descriptions.Item>
                    <Descriptions.Item label="离店日期">{checkoutData.boarding.check_out_date}</Descriptions.Item>
                    <Descriptions.Item label="寄养天数">{checkoutData.boarding.days} 天</Descriptions.Item>
                    <Descriptions.Item label="日租费用">¥{checkoutData.boarding.price_per_day}/天</Descriptions.Item>
                    <Descriptions.Item label="寄养小计">¥{checkoutData.boarding.subtotal}</Descriptions.Item>
                    {checkoutData.boarding.feeding_fee && (
                      <Descriptions.Item label="喂食服务费" span={2}>
                        ¥{checkoutData.boarding.feeding_fee} (有特殊喂食要求)
                      </Descriptions.Item>
                    )}
                    {checkoutData.boarding.feeding_requirements && (
                      <Descriptions.Item label="喂食要求" span={2}>
                        {checkoutData.boarding.feeding_requirements}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              )}

              {checkoutData.grooming && checkoutData.grooming.length > 0 && (
                <Card title="✂️ 美容费用" style={{ marginBottom: 24 }}>
                  <Table 
                    columns={[
                      { title: '服务项目', dataIndex: 'service_type', key: 'service_type' },
                      { title: '美容师', dataIndex: 'groomer_name', key: 'groomer_name' },
                      { title: '预约时间', key: 'time', render: r => `${r.appointment_date} ${r.appointment_time}` },
                      { title: '费用', dataIndex: 'price', key: 'price', render: p => <strong>¥{p}</strong> }
                    ]}
                    dataSource={checkoutData.grooming}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    summary={pageData => {
                      const total = pageData.reduce((sum, item) => sum + item.price, 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>美容小计：</Table.Summary.Cell>
                          <Table.Summary.Cell style={{ fontWeight: 600, color: '#f5222d' }}>¥{total}</Table.Summary.Cell>
                        </Table.Summary.Row>
                      );
                    }}
                  />
                </Card>
              )}

              {(!checkoutData.boarding && (!checkoutData.grooming || checkoutData.grooming.length === 0)) && (
                <Alert 
                  message="该宠物当前没有寄养或美容消费记录" 
                  type="warning" 
                  showIcon 
                  style={{ marginBottom: 24 }}
                />
              )}
            </>
          )}
        </Col>

        <Col xs={24} lg={10}>
          <Card 
            title={<span><DollarOutlined /> 结算信息</span>}
            style={{ position: 'sticky', top: 24 }}
          >
            {checkoutData ? (
              <>
                <div className="checkout-summary">
                  <div className="checkout-summary-row">
                    <span>寄养费用</span>
                    <span>¥{checkoutData.summary.boarding_total}</span>
                  </div>
                  <div className="checkout-summary-row">
                    <span>美容费用</span>
                    <span>¥{checkoutData.summary.grooming_total}</span>
                  </div>
                  <div className="checkout-summary-row">
                    <span>合计</span>
                    <span>¥{checkoutData.summary.grand_total}</span>
                  </div>
                  <div className="checkout-summary-row">
                    <span>优惠折扣</span>
                    <span>
                      <InputNumber 
                        size="small"
                        min={0} 
                        max={checkoutData.summary.grand_total}
                        value={discount}
                        onChange={setDiscount}
                        style={{ width: 120 }}
                        prefix="¥"
                      />
                    </span>
                  </div>
                  <div className="checkout-summary-row total">
                    <span>应收金额</span>
                    <span>¥{finalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Divider />

                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>支付方式：</div>
                  <Radio.Group 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Radio.Button value="微信" style={{ width: '100%', textAlign: 'center', padding: '12px 0' }}>💳 微信支付</Radio.Button>
                      <Radio.Button value="支付宝" style={{ width: '100%', textAlign: 'center', padding: '12px 0' }}>📱 支付宝</Radio.Button>
                      <Radio.Button value="现金" style={{ width: '100%', textAlign: 'center', padding: '12px 0' }}>💵 现金</Radio.Button>
                      <Radio.Button value="银行卡" style={{ width: '100%', textAlign: 'center', padding: '12px 0' }}>🏦 银行卡</Radio.Button>
                    </Space>
                  </Radio.Group>
                </div>

                <Button 
                  type="primary" 
                  size="large" 
                  icon={<CheckCircleOutlined />}
                  onClick={handleCheckout}
                  loading={loading}
                  disabled={finalAmount <= 0}
                  style={{ width: '100%', height: 48, fontSize: 16 }}
                >
                  确认收款 ¥{finalAmount.toFixed(2)}
                </Button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <DollarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>请先选择宠物查看结算信息</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="🎉 结算成功"
        open={successModal}
        onCancel={() => setSuccessModal(false)}
        footer={[
          <Button key="close" onClick={() => setSuccessModal(false)}>关闭</Button>
        ]}
        width={500}
      >
        {receipt && (
          <div>
            <Alert 
              message="收款成功！" 
              description={`已收到 ${receipt.pet_name} 的 ${receipt.type} 费用 ¥${receipt.amount}`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="交易单号">#{receipt.id}</Descriptions.Item>
              <Descriptions.Item label="宠物名称">{receipt.pet_name}</Descriptions.Item>
              <Descriptions.Item label="交易类型">
                <Tag color="blue">{receipt.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">{receipt.payment_method}</Descriptions.Item>
              <Descriptions.Item label="收款金额">
                <strong style={{ color: '#f5222d', fontSize: 18 }}>¥{receipt.amount}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="交易时间">{receipt.created_at}</Descriptions.Item>
            </Descriptions>
            
            {receipt.details && receipt.details.boarding && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left">寄养明细</Divider>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="笼位">{receipt.details.boarding.cage_name}</Descriptions.Item>
                  <Descriptions.Item label="天数">{receipt.details.boarding.days}天</Descriptions.Item>
                  <Descriptions.Item label="费用" span={2}>¥{receipt.details.boarding.subtotal}</Descriptions.Item>
                </Descriptions>
              </div>
            )}
            
            {receipt.details && receipt.details.grooming && receipt.details.grooming.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left">美容明细</Divider>
                {receipt.details.grooming.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{g.service_type} ({g.groomer_name})</span>
                    <span>¥{g.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Checkout;
