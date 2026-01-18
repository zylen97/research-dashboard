import React, { useState } from 'react';
import { Card, Radio, Button, Space, Typography, Alert, message } from 'antd';
import { CopyOutlined, SaveOutlined, FileTextOutlined } from '@ant-design/icons';
import type { QueryType } from '../types/journals';

const { Text, Paragraph } = Typography;

interface QueryPreviewProps {
  query: string;
  queryType: QueryType;
  selectedCount: number;
  totalCount: number;
  onCopy: () => void;
  onSaveTemplate: () => void;
  onQueryTypeChange: (type: QueryType) => void;
}

const QueryPreview: React.FC<QueryPreviewProps> = ({
  query,
  queryType,
  selectedCount,
  totalCount,
  onCopy,
  onSaveTemplate,
  onQueryTypeChange,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
      onCopy();
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  // 判断是否有语言不匹配的情况
  const hasLanguageMismatch = query.includes('当前选择的期刊中没有');

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>检索式预览</span>
        </Space>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={copied ? <CopyOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
            disabled={!query || hasLanguageMismatch}
          >
            {copied ? '已复制' : '复制到剪贴板'}
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={onSaveTemplate}
            disabled={selectedCount === 0 || hasLanguageMismatch}
          >
            保存为模板
          </Button>
        </Space>
      }
      size="small"
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 检索式类型选择 */}
        <div>
          <Text strong>检索式类型：</Text>
          <Radio.Group
            value={queryType}
            onChange={(e) => onQueryTypeChange(e.target.value)}
            style={{ marginLeft: 16 }}
          >
            <Radio value="WoS">Web of Science (WoS)</Radio>
            <Radio value="CNKI">中国知网 (CNKI)</Radio>
          </Radio.Group>
        </div>

        {/* 统计信息 */}
        {totalCount > 0 && (
          <Text type="secondary">
            已选择 {selectedCount} 个期刊
            {totalCount > selectedCount && `（筛选后显示 ${totalCount} 个）`}
          </Text>
        )}

        {/* 检索式展示 */}
        {query ? (
          hasLanguageMismatch ? (
            <Alert
              message={query}
              type="warning"
              showIcon
            />
          ) : (
            <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
              <Paragraph
                copyable={{ text: query, icon: <CopyOutlined /> }}
                style={{
                  margin: 0,
                  fontFamily: 'Monaco, Consolas, monospace',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {query}
              </Paragraph>
            </Card>
          )
        ) : (
          <Alert
            message="请选择期刊"
            description="选择标签或期刊后，系统将自动生成检索式"
            type="info"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

export default QueryPreview;
