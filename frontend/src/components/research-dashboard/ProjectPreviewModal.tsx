import React from 'react';
import { Modal, Descriptions, Space, Typography } from 'antd';
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
import { GRAYSCALE_SYSTEM } from '../../config/colors';
import { STATUS_VISUAL_SYSTEM } from '../../config/statusStyles';
import { ROLE_VISUAL_SYSTEM } from '../../config/roleStyles';
import { COLLABORATOR_VISUAL_SYSTEM } from '../../config/collaboratorStyles';

const { Title, Text } = Typography;

interface ProjectPreviewModalProps {
  visible: boolean;
  project: ResearchProject | null;
  onClose: () => void;
}

// 包豪斯：删除彩色映射，使用STATUS_VISUAL_SYSTEM

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
        {project.is_todo && <FlagOutlined style={{ color: GRAYSCALE_SYSTEM.primary, fontWeight: 700, marginRight: 8 }} />}
        {project.title}
      </Title>

      {/* 基本信息 */}
      <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="状态" span={1}>
          {(() => {
            const config = STATUS_VISUAL_SYSTEM[project.status as keyof typeof STATUS_VISUAL_SYSTEM];
            if (!config) {
              return <span style={{ color: GRAYSCALE_SYSTEM.tertiary }}>未知状态</span>;
            }
            return (
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: config.textWeight,
                  border: `${config.borderWidth} ${config.borderStyle} ${config.borderColor}`,
                  borderRadius: '2px',
                  backgroundColor: config.backgroundColor,
                  color: GRAYSCALE_SYSTEM.primary,
                }}
              >
                {config.icon} {config.label}
              </span>
            );
          })()}
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

      {/* 投稿期刊 */}
      {project.target_journal && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <FileTextOutlined /> 投稿期刊
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
          const config = ROLE_VISUAL_SYSTEM[project.my_role as keyof typeof ROLE_VISUAL_SYSTEM] || ROLE_VISUAL_SYSTEM.other_author;

          return (
            <span
              style={{
                fontSize: config.fontSize,
                fontWeight: config.fontWeight,
                textTransform: config.textTransform,
                letterSpacing: config.letterSpacing,
                borderBottom: config.borderBottom,
                color: config.color,
                display: 'inline-block',
                padding: '4px 12px',
              }}
            >
              {config.icon} {config.label}
            </span>
          );
        })()}
      </div>

      {/* 合作者 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>
          <TeamOutlined /> 合作者 ({project.collaborators?.length || 0})
        </Title>
        <Space wrap>
          {(project.collaborators || [])
            .filter(c => c != null)
            .map((collaborator) => {
              const visualConfig = COLLABORATOR_VISUAL_SYSTEM.regular;

              return (
                <span
                  key={collaborator.id}
                  style={{
                    fontWeight: visualConfig.fontWeight,
                    fontSize: visualConfig.fontSize,
                    color: visualConfig.color,
                    backgroundColor: visualConfig.backgroundColor,
                    padding: visualConfig.padding,
                    borderRadius: visualConfig.borderRadius,
                    margin: '2px',
                    display: 'inline-block',
                  }}
                >
                  {visualConfig.icon && `${visualConfig.icon} `}
                  {collaborator.name}
                </span>
              );
            })}
        </Space>
      </div>

    </Modal>
  );
};

export default ProjectPreviewModal;