import React from 'react';
import { Space, Tag, Button, Popconfirm, Empty, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import type { QueryTemplate } from '../types/journals';
import { GRAYSCALE_SYSTEM } from '../config/colors';

const { Text } = Typography;

interface TemplateBarProps {
  templates: QueryTemplate[];
  activeTemplateId: string | null;
  onApply: (template: QueryTemplate) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const TemplateBar: React.FC<TemplateBarProps> = ({
  templates,
  activeTemplateId,
  onApply,
  onDelete,
  onNew,
}) => {
  if (templates.length === 0) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          我的模板：
        </Text>
        <div style={{ marginTop: 8, padding: '16px', backgroundColor: '#fafafa', borderRadius: '4px', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12, color: '#999' }}>
                暂无保存的模板
              </span>
            }
          >
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onNew}>
              保存当前选择为模板
            </Button>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          我的模板：
        </Text>
        <Button size="small" icon={<PlusOutlined />} onClick={onNew}>
          新建模板
        </Button>
      </div>
      <Space size={8} wrap>
        {templates.map((template) => {
          const isActive = template.id === activeTemplateId;
          return (
            <Popconfirm
              key={template.id}
              title={isActive ? '确定取消应用此模板？' : `确定应用模板"${template.name}"？`}
              description={
                isActive
                  ? '取消后，当前选择状态将被保留'
                  : `应用模板将选择 ${template.journalIds.length} 个期刊 (${template.queryType})`
              }
              onConfirm={() => onApply(template)}
              onCancel={() => onDelete(template.id)}
              okText={isActive ? '取消应用' : '应用'}
              cancelText="删除"
              cancelButtonProps={{
                danger: true,
                icon: <DeleteOutlined />,
              }}
            >
              <Tag
                color={isActive ? 'blue' : 'default'}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 12,
                  backgroundColor: isActive ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
                  borderColor: isActive ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light,
                }}
              >
                <Space size={4}>
                  {isActive && <CheckOutlined style={{ fontSize: 10 }} />}
                  <span>{template.name}</span>
                  <span style={{ color: '#999', fontSize: 11 }}>
                    ({template.journalIds.length})
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '0 4px',
                    borderRadius: '2px',
                    backgroundColor: template.queryType === 'WoS' ? '#e6f7ff' : '#fff7e6',
                    color: template.queryType === 'WoS' ? '#1890ff' : '#fa8c16'
                  }}>
                    {template.queryType}
                  </span>
                </Space>
              </Tag>
            </Popconfirm>
          );
        })}
      </Space>
    </div>
  );
};

export default TemplateBar;
