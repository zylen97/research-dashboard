import React, { useState } from 'react';
import { Modal, Form, Input } from 'antd';
import { Collaborator } from '../../types';
import ValidationPromptModal from '../ValidationPromptModal';

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
 * 只包含2个字段：姓名、背景信息
 */
const CollaboratorFormModal: React.FC<CollaboratorFormModalProps> = ({
  visible,
  onCancel,
  editingCollaborator,
  form,
  onSubmit,
  confirmLoading = false,
}) => {
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error: any) {
      // 表单验证失败 - 显示验证提示对话框
      const errorFields = error.errorFields || [];
      const missingFields = errorFields.map((e: any) => {
        return `${e.errors[0]}`;
      });
      setValidationErrors(missingFields);
      setIsValidationModalVisible(true);
    }
  };

  return (
    <>
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
        </Form>
      </Modal>

      {/* 表单验证提示模态框 */}
      <ValidationPromptModal
        visible={isValidationModalVisible}
        onClose={() => setIsValidationModalVisible(false)}
        missingFields={validationErrors}
      />
    </>
  );
};

export default CollaboratorFormModal;
