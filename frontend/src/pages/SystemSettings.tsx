import React, { useState } from 'react';
import { Card, Tabs, message } from 'antd';
import { SettingOutlined, ApiOutlined, SafetyOutlined } from '@ant-design/icons';
import AIConfigPanel from '../components/system/AIConfigPanel';
import GeneralSettings from '../components/system/GeneralSettings';
import SecuritySettings from '../components/system/SecuritySettings';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const { TabPane } = Tabs;

const SystemSettings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ai');

  // 只有管理员（zl用户）可以访问系统设置
  if (!user || user.username !== 'zl') {
    message.error('您没有权限访问系统设置');
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card title="系统设置" className="shadow-sm">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          tabPosition="left"
          style={{ minHeight: '500px' }}
        >
          <TabPane 
            tab={
              <span>
                <ApiOutlined />
                AI配置
              </span>
            } 
            key="ai"
          >
            <AIConfigPanel />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <SettingOutlined />
                通用设置
              </span>
            } 
            key="general"
          >
            <GeneralSettings />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <SafetyOutlined />
                安全设置
              </span>
            } 
            key="security"
          >
            <SecuritySettings />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default SystemSettings;