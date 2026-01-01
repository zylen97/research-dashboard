import React from 'react';
import { Modal, Descriptions, Tag, Avatar, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Collaborator } from '../../types';

interface CollaboratorDetailModalProps {
  visible: boolean;
  collaborator: Collaborator | null;
  onClose: () => void;
}

/**
 * 合作者详情模态框（简化版）
 * 只显示：姓名、背景信息、参与项目数、创建时间
 */
export const CollaboratorDetailModal: React.FC<CollaboratorDetailModalProps> = ({
  visible,
  collaborator,
  onClose,
}) => {
  if (!collaborator) return null;

  return (
    <Modal
      title={
        <Space>
          <Avatar
            style={{
              backgroundColor: '#BFBFBF',
            }}
            icon={<UserOutlined />}
          />
          <span>{collaborator.name} - 详细信息</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <Descriptions bordered column={2}>
        <Descriptions.Item label="姓名" span={2}>
          {collaborator.name}
        </Descriptions.Item>

        <Descriptions.Item label="背景信息" span={2}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {collaborator.background}
          </div>
        </Descriptions.Item>

        <Descriptions.Item label="参与项目数" span={1}>
          <Tag style={{
            backgroundColor: '#E8E8E8',
            color: '#333333',
            borderColor: '#CCCCCC'
          }}>
            {collaborator.project_count || 0} 个
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="创建时间" span={1}>
          {new Date(collaborator.created_at).toLocaleString('zh-CN')}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default CollaboratorDetailModal;
