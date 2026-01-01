import React from 'react';
import { Form, Input, FormInstance } from 'antd';

const { TextArea } = Input;

interface CollaboratorFormProps {
  form: FormInstance;
}

/**
 * 合作者表单组件（简化版）
 * 只包含2个字段：姓名、背景信息
 */
export const CollaboratorForm: React.FC<CollaboratorFormProps> = ({ form }) => {
  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="姓名"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input placeholder="请输入合作者姓名" />
      </Form.Item>

      <Form.Item
        name="background"
        label="背景信息"
        rules={[{ required: true, message: '请输入背景信息' }]}
      >
        <TextArea
          rows={4}
          placeholder="请输入合作者的背景信息（如：专业、研究方向、特长等）"
        />
      </Form.Item>
    </Form>
  );
};
