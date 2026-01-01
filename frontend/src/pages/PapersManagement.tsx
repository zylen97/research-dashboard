/**
 * 论文管理页面
 * 独立的论文库管理界面，支持筛选、批量分析等功能
 */
import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Typography,
  Space,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';

import { userConfigApi } from '../services/apiOptimized';
import PapersListTab from '../components/PapersListTab';
import BatchAnalysisTab from '../components/BatchAnalysisTab';

const { Title } = Typography;

const PapersManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('papers');

  // 获取全局用户配置
  const { data: userConfig } = useQuery({
    queryKey: ['user-config'],
    queryFn: () => userConfigApi.getConfig(),
  });

  return (
    <div style={{ padding: '16px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题 */}
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>论文库</Title>
          <Typography.Text type="secondary">
            管理和分析导入的论文文献，支持批量AI分析
          </Typography.Text>
        </div>

        {/* 主内容区域 */}
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'papers',
                label: (
                  <span>
                    <FileTextOutlined />
                    论文列表
                  </span>
                ),
                children: <PapersListTab />,
              },
              {
                key: 'batch-analysis',
                label: (
                  <span>
                    <ThunderboltOutlined />
                    批量分析
                  </span>
                ),
                children: (
                  <BatchAnalysisTab
                    {...(userConfig?.data && { initialUserConfig: userConfig.data })}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
};

export default PapersManagement;
