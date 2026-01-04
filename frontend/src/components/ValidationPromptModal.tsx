import React from 'react';
import { Modal, List, Alert } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ValidationPromptModalProps {
  visible: boolean;
  onClose: () => void;
  missingFields: string[];
}

/**
 * 表单验证提示对话框
 * 当用户提交表单但必填项未填写时显示
 */
export const ValidationPromptModal: React.FC<ValidationPromptModalProps> = ({
  visible,
  onClose,
  missingFields
}) => (
  <Modal
    title={
      <span>
        <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
        请填写必填项
      </span>
    }
    open={visible}
    onOk={onClose}
    onCancel={onClose}
    okText="知道了"
    centered
  >
    <Alert
      message="以下项目为必填项，请填写后再提交"
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
    <List
      dataSource={missingFields}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            avatar={<ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />}
            title={item}
          />
        </List.Item>
      )}
    />
  </Modal>
);

export default ValidationPromptModal;
