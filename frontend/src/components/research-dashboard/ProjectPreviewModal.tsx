import React from 'react';
import { Modal, Descriptions, Tag, Space, Typography } from 'antd';
import { ResearchProject } from '../../types';
import {
  TeamOutlined,
  CalendarOutlined,
  ProjectOutlined,
  FileTextOutlined,
  BulbOutlined,
  LinkOutlined,
  FlagOutlined,
  UserOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface ProjectPreviewModalProps {
  visible: boolean;
  project: ResearchProject | null;
  onClose: () => void;
}

// 状态颜色映射
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: 'processing',      // 撰写中 - 蓝色
    completed: 'default',      // 已发表 - 灰色
    paused: 'warning',         // 暂停 - 黄色
    reviewing: 'purple',       // 审稿中 - 紫色
    revising: 'error',         // 返修中 - 红色
  };
  return colors[status] || 'default';
};

// 状态文本映射
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    active: '撰写中',
    completed: '已发表',
    paused: '暂停',
    reviewing: '审稿中',
    revising: '返修中',
  };
  return statusMap[status] || status;
};


const ProjectPreviewModal: React.FC<ProjectPreviewModalProps> = ({ 
  visible, 
  project, 
  onClose 
}) => {
  if (!project) {
    return null;
  }

  return (
    <Modal
      title={
        <Space>
          <ProjectOutlined />
          <span>项目详情预览</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      {/* 项目标题 */}
      <Title level={3} style={{ marginBottom: 16 }}>
        {project.is_todo && <FlagOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />}
        {project.title}
      </Title>

      {/* 基本信息 */}
      <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="状态" span={1}>
          <Tag color={getStatusColor(project.status)}>
            {getStatusText(project.status)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="开始时间" span={1}>
          <Space>
            <CalendarOutlined />
            {new Date(project.start_date).toLocaleDateString('zh-CN')}
          </Space>
        </Descriptions.Item>
      </Descriptions>

      {/* 项目描述 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>
          <FileTextOutlined /> 项目描述
        </Title>
        <Text style={{ whiteSpace: 'pre-wrap' }}>
          {project.idea_description || '暂无描述'}
        </Text>
      </div>

      {/* 研究方法 */}
      {project.research_method && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <BulbOutlined /> 研究方法
          </Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>
            {project.research_method}
          </Text>
        </div>
      )}

      {/* 参考论文 */}
      {project.reference_paper && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <FileTextOutlined /> 参考论文
          </Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>
            {project.reference_paper}
          </Text>
        </div>
      )}

      {/* 参考期刊 */}
      {project.reference_journal && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <LinkOutlined /> 参考期刊
          </Title>
          <Text>{project.reference_journal}</Text>
        </div>
      )}

      {/* (拟)投稿期刊 */}
      {project.target_journal && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <FileTextOutlined /> (拟)投稿期刊
          </Title>
          <Text>{project.target_journal}</Text>
        </div>
      )}

      {/* 🆕 我的身份 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>
          <UserOutlined /> 我的身份
        </Title>
        {(() => {
          const roleConfig = {
            first_author: { text: '第一作者', color: 'red', icon: '🥇' },
            corresponding_author: { text: '通讯作者', color: 'blue', icon: '✉️' },
            other_author: { text: '其他作者', color: 'default', icon: '👥' },
          };
          const config = roleConfig[project.my_role as keyof typeof roleConfig] || roleConfig.other_author;

          return (
            <Tag color={config.color} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {config.icon} {config.text}
            </Tag>
          );
        })()}
      </div>

      {/* 合作者 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>
          <TeamOutlined /> 合作者 ({project.collaborators.length})
        </Title>
        <Space wrap>
          {project.collaborators
            .sort((a, b) => (b.is_senior ? 1 : 0) - (a.is_senior ? 1 : 0))
            .map((collaborator) => (
              <Tag
                key={collaborator.id}
                color={collaborator.is_senior ? 'gold' : 'default'}
                style={{ margin: '2px' }}
              >
                {collaborator.name}
                {collaborator.is_senior && ' ⭐'}
              </Tag>
            ))}
        </Space>
      </div>

    </Modal>
  );
};

export default ProjectPreviewModal;