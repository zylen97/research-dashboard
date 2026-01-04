import React from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  ProjectOutlined,
  TeamOutlined,
  BulbOutlined,
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
      icon: <ProjectOutlined />,
      label: '研究',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: '/ideas-management',
      icon: <BulbOutlined />,
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
          height: 64,
          padding: '0 16px',
          background: colorBgContainer,
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <div style={{ marginRight: 24, fontSize: 18, fontWeight: 600 }}>
          Research Dashboard
        </div>

        {/* 水平菜单 */}
        <Menu
          mode="horizontal"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          style={{
            border: 'none',
            flex: 1,
            lineHeight: '64px',
            fontSize: 16,
          }}
        />
      </Header>

      {/* 内容区域 */}
      <Content
        style={{
          paddingTop: 80,
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