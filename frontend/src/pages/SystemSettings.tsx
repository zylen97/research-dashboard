import React, { useEffect } from 'react';
import { Typography, Space } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import AIConfigPanel from '../components/system/AIConfigPanel';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { withErrorHandler } from '../utils/errorHandlerOptimized';

const { Title, Text } = Typography;

const SystemSettings: React.FC = () => {
  const { user } = useAuth();

  // 使用错误处理包装器检查权限
  const checkPermission = withErrorHandler(
    async () => {
      if (!user || user.username !== 'zl') {
        throw new Error('您没有权限访问系统设置');
      }
    },
    'checkPermission' as any,
    {
      errorMessage: '权限验证失败',
    }
  );

  useEffect(() => {
    checkPermission();
  }, [user]);

  // 只有管理员（zl用户）可以访问系统设置
  if (!user || user.username !== 'zl') {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Space align="center" size="middle">
          <ApiOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <div>
            <Title level={3} style={{ margin: 0 }}>
              AI配置管理
            </Title>
            <Text type="secondary">
              配置AI模型提供商，管理API密钥和参数设置
            </Text>
          </div>
        </Space>
      </div>
      
      <AIConfigPanel />
    </div>
  );
};

export default SystemSettings;