import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Button, theme, Drawer } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BulbOutlined,
  UnorderedListOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // 响应式处理
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobileView(isMobile);
      setCollapsed(isMobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 菜单项配置
  const getMenuItems = () => {
    return [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '研究看板',
        onClick: () => navigate('/dashboard'),
      },
      {
        key: '/ideas-management',
        icon: <UnorderedListOutlined />,
        label: 'Idea面板',
        onClick: () => navigate('/ideas-management'),
      },
      {
        key: '/collaborators',
        icon: <TeamOutlined />,
        label: '合作者管理',
        onClick: () => navigate('/collaborators'),
      },
      {
        key: '/journals',
        icon: <GlobalOutlined />,
        label: '期刊库',
        onClick: () => navigate('/journals'),
      },
      {
        key: '/papers',
        icon: <FileTextOutlined />,
        label: '论文库',
        onClick: () => navigate('/papers'),
      },
      {
        key: '/backup',
        icon: <DatabaseOutlined />,
        label: '数据库备份',
        onClick: () => navigate('/backup'),
      },
    ];
  };


  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '/research') return '/dashboard';
    return pathname;
  };

  // 渲染菜单内容
  const renderMenuContent = () => (
    <>
      {/* Logo和标题 */}
      <div style={{ 
        height: 48, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: collapsed && !mobileView ? 'center' : 'flex-start',
        padding: collapsed && !mobileView ? 0 : '0 16px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        {(!collapsed || mobileView) && (
          <Title level={5} style={{ margin: 0, color: '#333333', fontWeight: 700, letterSpacing: '0.5px' }}>
            Zylen's Research Dashboard
          </Title>
        )}
        {collapsed && !mobileView && (
          <BulbOutlined style={{ fontSize: 20, color: '#333333' }} />
        )}
      </div>

      {/* 菜单 */}
      <Menu
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={getMenuItems()}
        style={{ 
          border: 'none',
          marginTop: 4
        }}
        onClick={() => {
          if (mobileView) {
            setCollapsed(true);
          }
        }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 桌面端侧边栏 */}
      {!mobileView && (
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed}
          style={{
            background: colorBgContainer,
            boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
          }}
        >
          {renderMenuContent()}
        </Sider>
      )}

      {/* 移动端抽屉 */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setCollapsed(true)}
        open={mobileView && !collapsed}
        bodyStyle={{ padding: 0, background: colorBgContainer }}
        width={240}
      >
        {renderMenuContent()}
      </Drawer>

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
            height: 48,
          }}
        >
          {/* 折叠按钮 */}
          <Button
            type="text"
            icon={collapsed || mobileView ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 48,
              height: 48,
            }}
          />
        </Header>

        {/* 内容区域 */}
        <Content
          style={{
            margin: mobileView ? '8px' : '12px',
            padding: mobileView ? 12 : 16,
            minHeight: 'calc(100vh - 64px)',
            background: colorBgContainer,
            borderRadius: mobileView ? '4px' : '8px',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
            overflow: 'auto',
            position: 'relative',
          }}
        >
          <div className="content-wrapper" style={{ width: '100%', maxWidth: 'none' }}>
            {children}
          </div>
          
          {/* 版权信息 */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '12px',
            fontSize: '10px',
            color: '#bfbfbf',
            opacity: 0.6,
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
            Zylen Copyright
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;