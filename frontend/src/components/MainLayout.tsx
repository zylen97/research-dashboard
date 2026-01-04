import React from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BulbOutlined,
  UnorderedListOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // 菜单项配置
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '研究',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: '/ideas-management',
      icon: <UnorderedListOutlined />,
      label: 'Idea',
      onClick: () => navigate('/ideas-management'),
    },
    {
      key: '/collaborators',
      icon: <TeamOutlined />,
      label: '合作者',
      onClick: () => navigate('/collaborators'),
    },
    {
      key: '/journals',
      icon: <GlobalOutlined />,
      label: '期刊',
      onClick: () => navigate('/journals'),
    },
    {
      key: '/papers',
      icon: <FileTextOutlined />,
      label: '论文',
      onClick: () => navigate('/papers'),
    },
    {
      key: '/backup',
      icon: <DatabaseOutlined />,
      label: '备份',
      onClick: () => navigate('/backup'),
    },
  ];

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '/research') return '/dashboard';
    return pathname;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 固定顶部菜单栏 */}
      <Header
        style={{
          position: 'fixed',
          zIndex: 999,
          width: '100%',
          height: 48,
          padding: '0 16px',
          background: colorBgContainer,
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <div style={{ marginRight: 24 }}>
          <BulbOutlined style={{ fontSize: 18, color: '#333333' }} />
        </div>

        {/* 水平菜单 */}
        <Menu
          mode="horizontal"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          style={{
            border: 'none',
            flex: 1,
            lineHeight: '48px',
          }}
        />
      </Header>

      {/* 内容区域 */}
      <Content
        style={{
          paddingTop: 64,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          minHeight: '100vh',
          background: colorBgContainer,
        }}
      >
        {children}
      </Content>
    </Layout>
  );
};

export default MainLayout;