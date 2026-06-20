import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  HomeOutlined,
  CustomerServiceOutlined,
  ShopOutlined,
  ScissorOutlined,
  DollarOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard.jsx';
import Pets from './pages/Pets.jsx';
import Boarding from './pages/Boarding.jsx';
import Grooming from './pages/Grooming.jsx';
import Checkout from './pages/Checkout.jsx';
import Transactions from './pages/Transactions.jsx';

const { Header, Content, Sider } = Layout;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/pets', icon: <CustomerServiceOutlined />, label: <Link to="/pets">宠物档案</Link> },
  { key: '/boarding', icon: <ShopOutlined />, label: <Link to="/boarding">寄养预约</Link> },
  { key: '/grooming', icon: <ScissorOutlined />, label: <Link to="/grooming">美容预约</Link> },
  { key: '/checkout', icon: <DollarOutlined />, label: <Link to="/checkout">收银结算</Link> },
  { key: '/transactions', icon: <HistoryOutlined />, label: <Link to="/transactions">交易记录</Link> },
];

function App() {
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout className="app-container">
      <Sider theme="light" width={220}>
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 600,
          color: '#1890ff',
          borderBottom: '1px solid #f0f0f0'
        }}>
          🐾 宠物管理系统
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer, 
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>
            {menuItems.find(m => m.key === location.pathname)?.label?.props?.children || '宠物寄养与美容店管理系统'}
          </span>
        </Header>
        <Content style={{ margin: 0, minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pets" element={<Pets />} />
            <Route path="/boarding" element={<Boarding />} />
            <Route path="/grooming" element={<Grooming />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/transactions" element={<Transactions />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
