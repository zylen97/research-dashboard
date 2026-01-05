/**
 * 论文管理页面
 * 独立的论文库管理界面，支持筛选、批量分析等功能
 */
import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Space,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import PapersListTab from '../components/PapersListTab';
import BatchAnalysisTab from '../components/BatchAnalysisTab';

const PapersManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('papers');

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
                children: <BatchAnalysisTab />,
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
};

export default PapersManagement;
