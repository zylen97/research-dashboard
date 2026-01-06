/**
 * PromptCard 组件（v4.8）
 * 显示单个提示词的卡片
 */
import React from 'react';
import { Card, Tag, Space, Button, Tooltip, Typography } from 'antd';
import {
  CopyOutlined,
  StarFilled,
  StarOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { Prompt, PROMPT_CATEGORY_LABELS } from '../types/prompts';

const { Text, Paragraph } = Typography;

interface PromptCardProps {
  prompt: Prompt;
  onCopy: (id: number) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onCopy,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  // 获取分类颜色
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      reading: 'blue',
      writing: 'green',
      polishing: 'orange',
      reviewer: 'purple',
      horizontal: 'red',
    };
    return colors[category] || 'default';
  };

  // 预览内容（截取前200字符）
  const contentPreview = prompt.content.length > 200
    ? prompt.content.slice(0, 200) + '...'
    : prompt.content;

  return (
    <Card
      hoverable
      style={{ marginBottom: 16 }}
      actions={[
        <Tooltip title="快速复制">
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => onCopy(prompt.id)}
          >
            复制
          </Button>
        </Tooltip>,
        <Tooltip title={prompt.is_favorite ? '取消收藏' : '收藏'}>
          <Button
            type="text"
            icon={prompt.is_favorite ? <StarFilled /> : <StarOutlined />}
            onClick={() => onToggleFavorite(prompt.id)}
            style={{ color: prompt.is_favorite ? '#faad14' : undefined }}
          >
            {prompt.is_favorite ? '已收藏' : '收藏'}
          </Button>
        </Tooltip>,
        <Tooltip title="编辑">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onEdit(prompt)}
          >
            编辑
          </Button>
        </Tooltip>,
        <Tooltip title="删除">
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(prompt.id)}
          >
            删除
          </Button>
        </Tooltip>,
      ]}
    >
      {/* 标题和收藏标记 */}
      <div style={{ marginBottom: 12 }}>
        <Space size="middle">
          <Text strong style={{ fontSize: 16 }}>
            {prompt.is_favorite && <StarFilled style={{ color: '#faad14', marginRight: 8 }} />}
            {prompt.title}
          </Text>
          <Tag color={getCategoryColor(prompt.category)}>
            {PROMPT_CATEGORY_LABELS[prompt.category]}
          </Tag>
          {prompt.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {prompt.description}
            </Text>
          )}
        </Space>
      </div>

      {/* 内容预览 */}
      <Paragraph
        ellipsis={{ rows: 3 }}
        style={{ marginBottom: 12, color: '#666' }}
      >
        {contentPreview}
      </Paragraph>

      {/* 标签列表 */}
      {prompt.tags && prompt.tags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            {prompt.tags.map((tag) => (
              <Tag key={tag.id} color={tag.color || 'default'}>
                {tag.name}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* 变量列表 */}
      {prompt.variables && prompt.variables.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            {prompt.variables.map((variable) => (
              <Tag key={variable} color="cyan">
                {'{' + variable + '}'}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* 使用统计 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="large">
          <Text type="secondary" style={{ fontSize: 12 }}>
            <EyeOutlined /> {prompt.usage_count} 次使用
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            创建于 {new Date(prompt.created_at).toLocaleDateString()}
          </Text>
        </Space>
      </div>
    </Card>
  );
};

export default PromptCard;
