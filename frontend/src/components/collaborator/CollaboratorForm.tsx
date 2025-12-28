import React from 'react';
import { Form, Input, Switch, FormInstance } from 'antd';

const { TextArea } = Input;

interface CollaboratorFormProps {
  form: FormInstance;
}

/**
 * 合作者表单组件（简化版）
 * 只包含4个字段：姓名、背景信息、联系方式、高级合作者
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

      <Form.Item
        name="contact_info"
        label="联系方式"
      >
        <Input placeholder="请输入联系方式（可选）" />
      </Form.Item>

      <Form.Item
        name="is_senior"
        label="高级合作者"
        valuePropName="checked"
        initialValue={true}
      >
        <Switch />
      </Form.Item>
    </Form>
  );
};
