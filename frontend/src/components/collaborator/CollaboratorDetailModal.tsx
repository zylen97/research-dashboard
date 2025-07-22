import React from 'react';
import { Modal, Descriptions, Tag, Avatar, Space } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { Collaborator } from '../../types';
import { formatTextWithLineBreaks } from '../../utils/formatters';

interface CollaboratorDetailModalProps {
  visible: boolean;
  collaborator: Collaborator | null;
  isGroupMember: boolean;
  onClose: () => void;
}

export const CollaboratorDetailModal: React.FC<CollaboratorDetailModalProps> = ({
  visible,
  collaborator,
  isGroupMember,
  onClose,
}) => {
  if (!collaborator) return null;

  return (
    <Modal
      title={
        <Space>
          <Avatar
            style={{
              backgroundColor: collaborator.is_senior ? '#f56a00' : '#87d068',
            }}
            icon={<UserOutlined />}
          />
          <span>{collaborator.name} - 详细信息</span>
          {isGroupMember && (
            <Tag icon={<TeamOutlined />} color="blue">
              小组成员
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Descriptions bordered column={2}>
        <Descriptions.Item label="姓名">{collaborator.name}</Descriptions.Item>
        <Descriptions.Item label="性别">{collaborator.gender}</Descriptions.Item>
        <Descriptions.Item label="班级">{collaborator.class_name}</Descriptions.Item>
        <Descriptions.Item label="学号">{collaborator.student_id}</Descriptions.Item>
        <Descriptions.Item label="电话">{collaborator.phone || '-'}</Descriptions.Item>
        <Descriptions.Item label="邮箱">{collaborator.email || '-'}</Descriptions.Item>
        <Descriptions.Item label="QQ">{collaborator.qq || '-'}</Descriptions.Item>
        <Descriptions.Item label="微信">{collaborator.wechat || '-'}</Descriptions.Item>
        
        <Descriptions.Item label="状态">
          <Tag color={collaborator.is_senior ? 'gold' : 'green'}>
            {collaborator.is_senior ? '高级合作者' : '普通合作者'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="参与项目数">
          <Tag color="blue">{collaborator.project_count || 0} 个</Tag>
        </Descriptions.Item>
        
        {collaborator.skills && (
          <Descriptions.Item label="技能专长" span={2}>
            {collaborator.skills}
          </Descriptions.Item>
        )}
        
        {collaborator.research_interests && (
          <Descriptions.Item label="研究兴趣" span={2}>
            {collaborator.research_interests}
          </Descriptions.Item>
        )}
        
        {collaborator.future_plans && (
          <Descriptions.Item label="未来规划" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {formatTextWithLineBreaks(collaborator.future_plans)}
            </div>
          </Descriptions.Item>
        )}
        
        {collaborator.background && (
          <Descriptions.Item label="背景资料" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {formatTextWithLineBreaks(collaborator.background)}
            </div>
          </Descriptions.Item>
        )}
        
        <Descriptions.Item label="创建时间" span={2}>
          {new Date(collaborator.created_at).toLocaleString('zh-CN')}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default CollaboratorDetailModal;