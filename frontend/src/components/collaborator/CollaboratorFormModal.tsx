import React from 'react';
import { Modal, Form, Input, Checkbox } from 'antd';
import { Collaborator } from '../../types';

const { TextArea } = Input;

interface CollaboratorFormModalProps {
  visible: boolean;
  onCancel: () => void;
  editingCollaborator: Collaborator | null;
  form: any;
  onSubmit: (values: any) => void;
  confirmLoading?: boolean;
}

/**
 * 合作者表单模态框（极简版）
 * 只包含3个字段：姓名、背景信息、高级合作者
 */
const CollaboratorFormModal: React.FC<CollaboratorFormModalProps> = ({
  visible,
  onCancel,
  editingCollaborator,
  form,
  onSubmit,
  confirmLoading = false,
}) => {
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Modal
      title={editingCollaborator ? '编辑合作者' : '添加合作者'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ is_senior: true }}
      >
        {/* 1. 姓名（必填） */}
        <Form.Item
          label="姓名"
          name="name"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="请输入合作者姓名" />
        </Form.Item>

        {/* 2. 背景信息（必填） */}
        <Form.Item
          label="背景信息"
          name="background"
          rules={[{ required: true, message: '请输入背景信息' }]}
        >
          <TextArea
            rows={4}
            placeholder="请输入合作者的背景信息（如：专业、研究方向、特长等）"
          />
        </Form.Item>

        {/* 3. 高级合作者（可选） */}
        <Form.Item
          name="is_senior"
          valuePropName="checked"
        >
          <Checkbox>高级合作者</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CollaboratorFormModal;
