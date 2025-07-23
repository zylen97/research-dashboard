import React from 'react';
import { Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import IdeasManagement from '../components/IdeasManagement';

const { Title, Paragraph } = Typography;

const IdeasManagementPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2}>
          <BulbOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          Ideas管理
        </Title>
        <Paragraph type="secondary">
          管理研究想法，设置重要性评级和负责人分配
        </Paragraph>
      </div>

      {/* Ideas管理组件 */}
      <IdeasManagement />
    </div>
  );
};

export default IdeasManagementPage;