import React from 'react';
import { Modal, Descriptions, Tag, Space, Typography, Divider } from 'antd';
import { ResearchProject } from '../../types';
import { 
  TeamOutlined, 
  CalendarOutlined, 
  ProjectOutlined,
  FileTextOutlined,
  BulbOutlined,
  LinkOutlined,
  MessageOutlined,
  FlagOutlined
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
    completed: 'default',      // 存档 - 灰色
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
    completed: '存档',
    paused: '暂停',
    reviewing: '审稿中',
    revising: '返修中',
  };
  return statusMap[status] || status;
};

// 判断是否为小组
const isGroupCollaborator = (collaborator: any) => {
  const getLocalGroupMarks = () => {
    try {
      const saved = localStorage.getItem('collaborator-group-marks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };
  
  const localMarks = getLocalGroupMarks();
  
  if (localMarks[collaborator.id] !== undefined) {
    return localMarks[collaborator.id];
  }
  
  if (collaborator.is_group !== undefined) {
    return collaborator.is_group;
  }
  
  const groupIndicators = [
    '小组', '团队', '大创团队', '创新大赛小组', 
    '周佳祺 庄晶涵 范佳伟', '田超 王昊 李思佳 凌文杰'
  ];
  return groupIndicators.some(indicator => 
    collaborator.name.includes(indicator) || 
    (collaborator.class_name && collaborator.class_name.includes(indicator))
  );
};

const ProjectPreviewModal: React.FC<ProjectPreviewModalProps> = ({ 
  visible, 
  project, 
  onClose 
}) => {
  if (!project) {
    return null;
  }

  // 获取最新交流记录
  const getLatestCommunication = () => {
    const logs = project.communication_logs || [];
    if (logs.length === 0) return null;
    
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = new Date(a.communication_date || a.created_at);
      const dateB = new Date(b.communication_date || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sortedLogs[0];
  };

  const latestLog = getLatestCommunication();

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
        <Descriptions.Item label="进度" span={1}>
          <Text>{project.progress}%</Text>
        </Descriptions.Item>
        <Descriptions.Item label="开始时间" span={1}>
          <Space>
            <CalendarOutlined />
            {new Date(project.start_date).toLocaleDateString('zh-CN')}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="预计完成" span={1}>
          {project.expected_completion ? (
            <Space>
              <CalendarOutlined />
              {new Date(project.expected_completion).toLocaleDateString('zh-CN')}
            </Space>
          ) : (
            <Text type="secondary">未设置</Text>
          )}
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

      {/* 来源 */}
      {project.source && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <LinkOutlined /> 来源
          </Title>
          <Text>{project.source}</Text>
        </div>
      )}

      {/* 合作者 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>
          <TeamOutlined /> 合作者 ({project.collaborators.length})
        </Title>
        <Space wrap>
          {project.collaborators
            .sort((a, b) => {
              const aIsGroup = isGroupCollaborator(a);
              const bIsGroup = isGroupCollaborator(b);
              if (aIsGroup && !bIsGroup) return -1;
              if (!aIsGroup && bIsGroup) return 1;
              return (b.is_senior ? 1 : 0) - (a.is_senior ? 1 : 0);
            })
            .map((collaborator) => {
              const isGroup = isGroupCollaborator(collaborator);
              return (
                <Tag 
                  key={collaborator.id} 
                  color={isGroup ? 'purple' : (collaborator.is_senior ? 'gold' : 'default')}
                  style={{ margin: '2px' }}
                >
                  {isGroup && '👥 '}{collaborator.name}
                  {collaborator.is_senior && !isGroup && ' ⭐'}
                </Tag>
              );
            })}
        </Space>
      </div>

      {/* 最新交流进度 */}
      <div>
        <Title level={5}>
          <MessageOutlined /> 最新交流进度
        </Title>
        {latestLog ? (
          <div style={{ 
            padding: '12px', 
            background: '#f5f5f5', 
            borderRadius: '4px',
            marginBottom: 8
          }}>
            <Text strong>
              {new Date(latestLog.communication_date).toLocaleDateString('zh-CN')}
              {' - '}
              {latestLog.title}
            </Text>
            <br />
            <Text type="secondary">
              共 {project.communication_logs.length} 条交流记录
            </Text>
          </div>
        ) : (
          <Text type="secondary">暂无交流记录</Text>
        )}
      </div>

      <Divider />

      {/* 时间信息 */}
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Text type="secondary">
          创建时间：{new Date(project.created_at).toLocaleString('zh-CN')}
        </Text>
        <Text type="secondary">
          更新时间：{new Date(project.updated_at).toLocaleString('zh-CN')}
        </Text>
        {project.todo_marked_at && (
          <Text type="secondary">
            标记待办：{new Date(project.todo_marked_at).toLocaleString('zh-CN')}
          </Text>
        )}
      </Space>
    </Modal>
  );
};

export default ProjectPreviewModal;