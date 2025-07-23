import React from 'react';
import {
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  CalendarOutlined,
  TeamOutlined,
  BookOutlined,
  LinkOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  StarOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Literature } from '../../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

interface LiteratureDetailProps {
  literature: Literature | null;
  onEdit?: (literature: Literature) => void;
  onDelete?: (literature: Literature) => void;
  onConvertToIdea?: (literature: Literature) => void;
  loading?: boolean;
}

const LiteratureDetail: React.FC<LiteratureDetailProps> = ({
  literature,
  onEdit,
  onDelete,
  onConvertToIdea,
  loading = false,
}) => {
  // 获取验证状态的显示信息
  const getValidationStatus = (status: string) => {
    switch (status) {
      case 'validated':
        return { color: 'success', icon: <CheckCircleOutlined />, text: '已验证' };
      case 'rejected':
        return { color: 'error', icon: <CloseCircleOutlined />, text: '已拒绝' };
      case 'pending':
        return { color: 'processing', icon: <SyncOutlined />, text: '待验证' };
      default:
        return { color: 'default', icon: null, text: '未知' };
    }
  };

  // 获取状态的显示信息
  const getStatus = (status: string) => {
    switch (status) {
      case 'imported':
        return { color: 'blue', text: '已导入' };
      case 'reviewed':
        return { color: 'green', text: '已阅读' };
      case 'converted_to_idea':
        return { color: 'purple', text: '已转换' };
      default:
        return { color: 'default', text: status };
    }
  };

  if (!literature) {
    return (
      <Card style={{ height: '100%' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请选择一篇文献查看详情"
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            minHeight: 300
          }}
        />
      </Card>
    );
  }

  const validationStatus = getValidationStatus(literature.validation_status);
  const statusInfo = getStatus(literature.status);

  return (
    <Card
      loading={loading}
      style={{ height: '100%', overflow: 'auto' }}
      bodyStyle={{ padding: 16 }}
    >
      {/* 操作按钮 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          {onConvertToIdea && literature.status !== 'converted_to_idea' && (
            <Tooltip title="转换为Idea">
              <Button
                type="primary"
                ghost
                icon={<BulbOutlined />}
                size="small"
                onClick={() => onConvertToIdea(literature)}
              >
                转为Idea
              </Button>
            </Tooltip>
          )}
          
          {onEdit && (
            <Tooltip title="编辑文献">
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => onEdit(literature)}
              >
                编辑
              </Button>
            </Tooltip>
          )}
          
          {onDelete && (
            <Tooltip title="删除文献">
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => onDelete(literature)}
              >
                删除
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* 标题 */}
      <Title level={4} style={{ marginBottom: 16, lineHeight: 1.4 }}>
        {literature.title}
      </Title>

      {/* 状态标签 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Tag 
            color={validationStatus.color} 
            icon={validationStatus.icon}
          >
            {validationStatus.text}
          </Tag>
          <Tag color={statusInfo.color}>
            {statusInfo.text}
          </Tag>
          {literature.group_name && (
            <Tag color="blue">
              {literature.group_name.toUpperCase()}
            </Tag>
          )}
        </Space>
      </div>

      {/* 基本信息 */}
      <Descriptions 
        size="small" 
        column={1}
        style={{ marginBottom: 16 }}
      >
        {literature.authors && (
          <Descriptions.Item 
            label={<><TeamOutlined /> 作者</>}
          >
            <Text copyable>{literature.authors}</Text>
          </Descriptions.Item>
        )}
        
        {literature.journal && (
          <Descriptions.Item 
            label={<><BookOutlined /> 期刊</>}
          >
            <Text copyable>{literature.journal}</Text>
          </Descriptions.Item>
        )}
        
        {literature.year && (
          <Descriptions.Item 
            label={<><CalendarOutlined /> 年份</>}
          >
            {literature.year}
          </Descriptions.Item>
        )}
        
        <Descriptions.Item 
          label={<><FolderOutlined /> 文件夹</>}
        >
          {literature.folder ? (
            <Tag color="blue">{literature.folder.name}</Tag>
          ) : (
            <Text type="secondary">未分类</Text>
          )}
        </Descriptions.Item>
        
        {literature.doi && (
          <Descriptions.Item 
            label={<><LinkOutlined /> DOI</>}
          >
            <Text 
              copyable 
              style={{ fontSize: '12px' }}
            >
              {literature.doi}
            </Text>
          </Descriptions.Item>
        )}
        
        <Descriptions.Item 
          label={<><StarOutlined /> 引用数</>}
        >
          <Badge 
            count={literature.citation_count} 
            style={{ backgroundColor: '#52c41a' }}
            showZero
          />
        </Descriptions.Item>
      </Descriptions>

      {/* 关键词 */}
      {literature.keywords && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>关键词：</Text>
          <div style={{ marginTop: 8 }}>
            {literature.keywords.split(',').map((keyword, index) => (
              <Tag key={index} style={{ marginBottom: 4 }}>
                {keyword.trim()}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* 摘要 */}
      {literature.abstract && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>摘要：</Text>
          <Paragraph 
            ellipsis={{ 
              rows: 6, 
              expandable: true, 
              symbol: '展开' 
            }}
            style={{ 
              marginTop: 8,
              fontSize: '13px',
              lineHeight: '1.6',
              textAlign: 'justify'
            }}
          >
            {literature.abstract}
          </Paragraph>
        </div>
      )}

      {/* AI验证结果 */}
      {literature.validation_reason && (
        <div style={{ marginBottom: 16 }}>
          <Divider orientation="left" style={{ fontSize: '14px' }}>
            AI验证结果
          </Divider>
          
          {literature.validation_score && (
            <div style={{ marginBottom: 8 }}>
              <Text strong>相关性评分：</Text>
              <Badge 
                count={`${Math.round(literature.validation_score * 100)}%`}
                style={{ 
                  backgroundColor: literature.validation_score > 0.7 ? '#52c41a' : 
                                  literature.validation_score > 0.4 ? '#faad14' : '#ff4d4f'
                }}
              />
            </div>
          )}
          
          <div>
            <Text strong>分析原因：</Text>
            <Paragraph 
              ellipsis={{ 
                rows: 4, 
                expandable: true, 
                symbol: '展开' 
              }}
              style={{ 
                marginTop: 8,
                fontSize: '13px',
                lineHeight: '1.5',
                backgroundColor: '#f8f8f8',
                padding: 12,
                borderRadius: 6
              }}
            >
              {literature.validation_reason}
            </Paragraph>
          </div>
        </div>
      )}

      {/* 备注 */}
      {literature.notes && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>备注：</Text>
          <Paragraph 
            style={{ 
              marginTop: 8,
              fontSize: '13px',
              backgroundColor: '#fafafa',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #f0f0f0'
            }}
          >
            {literature.notes}
          </Paragraph>
        </div>
      )}

      {/* 时间信息 */}
      <Divider />
      <div style={{ color: '#999', fontSize: '12px' }}>
        <div>创建时间：{dayjs(literature.created_at).format('YYYY-MM-DD HH:mm')}</div>
        <div>更新时间：{dayjs(literature.updated_at).format('YYYY-MM-DD HH:mm')}</div>
      </div>
    </Card>
  );
};

export default LiteratureDetail;