import React, { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Dropdown, Button, theme, Space } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BookOutlined,
  BulbOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // 菜单项配置
  const menuItems = [
    {
      key: '/research',
      icon: <DashboardOutlined />,
      label: '研究看板',
      onClick: () => navigate('/research'),
    },
    {
      key: '/collaborators',
      icon: <TeamOutlined />,
      label: '合作者管理',
      onClick: () => navigate('/collaborators'),
    },
    {
      key: '/literature',
      icon: <BookOutlined />,
      label: 'Idea发掘',
      onClick: () => navigate('/literature'),
    },
    {
      key: '/ideas',
      icon: <BulbOutlined />,
      label: 'Idea管理',
      onClick: () => navigate('/ideas'),
    },
  ];

  // 用户菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '/research') return '/research';
    return pathname;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: colorBgContainer,
          boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
        }}
      >
        {/* Logo和标题 */}
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          {!collapsed && (
            <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
              Research Dashboard
            </Title>
          )}
          {collapsed && (
            <BulbOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          )}
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          style={{ 
            border: 'none',
            marginTop: 8
          }}
        />
      </Sider>

      {/* 主要内容区域 */}
      <Layout>
        {/* 顶部导航栏 */}
        <Header
          style={{
            padding: '0 16px',
            background: colorBgContainer,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* 折叠按钮 */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          {/* 工具栏和用户信息 */}
          <Space size="middle">
            {/* 主题切换按钮 */}
            <ThemeToggle />
            
            {/* 用户信息 */}
            <Dropdown
              menu={{ 
                items: userMenuItems,
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    // TODO: 实现退出登录功能
                  }
                }
              }}
              placement="bottomRight"
              arrow
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
              }}>
                <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
                <span style={{ fontSize: '14px' }}>研究员</span>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* 内容区域 */}
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: '8px',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;