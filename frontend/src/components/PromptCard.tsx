/**
 * PromptCard 组件（v4.9）
 * 显示单个提示词的卡片 - 紧凑模式
 */
import React from 'react';
import { Card, Button, Typography, message, Popconfirm } from 'antd';
import {
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Prompt } from '../types/prompts';
import { promptsApi } from '../services/apiOptimized';

const { Text } = Typography;

interface PromptCardProps {
  prompt: Prompt;
  onCopy: (id: number) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: number) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onCopy,
  onEdit,
  onDelete,
}) => {
  // 一键复制优化：无变量时直接复制，有变量时弹窗
  const handleCopy = async () => {
    if (!prompt.variables || prompt.variables.length === 0) {
      // 无变量：直接复制到剪贴板
      try {
        await navigator.clipboard.writeText(prompt.content);
        message.success('已复制到剪贴板');
        // 异步更新使用计数
        promptsApi.copy(prompt.id, {});
      } catch {
        message.error('复制失败');
      }
    } else {
      // 有变量：打开填写表单
      onCopy(prompt.id);
    }
  };

  return (
    <Card
      hoverable
      size="small"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      actions={[
        <Button
          size="small"
          type="primary"
          icon={<CopyOutlined />}
          onClick={handleCopy}
        >
          复制
        </Button>,
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => onEdit(prompt)}
        >
          编辑
        </Button>,
        <Popconfirm
          title="确认删除"
          description="删除后不可恢复"
          onConfirm={() => onDelete(prompt.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
          >
            删除
          </Button>
        </Popconfirm>,
      ]}
    >
      {/* 只显示标题 */}
      <Text strong style={{ fontSize: 15 }}>{prompt.title}</Text>

      {/* 内容预览 */}
      <div style={{ marginTop: 8, flex: 1 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {prompt.content.length < 100
            ? prompt.content
            : prompt.content.slice(0, 180) + '...'}
        </Text>
      </div>

      {/* 变量提示（如果有） */}
      {prompt.variables && prompt.variables.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            包含 {prompt.variables.length} 个变量
          </Text>
        </div>
      )}
    </Card>
  );
};

export default PromptCard;
