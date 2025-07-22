import React from 'react';
import { Modal, Form, Input, Select, Radio } from 'antd';
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
        initialValues={editingCollaborator || { gender: '男', is_senior: false }}
      >
        <Form.Item
          label="姓名"
          name="name"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="请输入合作者姓名" />
        </Form.Item>

        <Form.Item
          label="性别"
          name="gender"
          rules={[{ required: true, message: '请选择性别' }]}
        >
          <Radio.Group>
            <Radio value="男">男</Radio>
            <Radio value="女">女</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label="学校"
          name="school"
        >
          <Input placeholder="请输入学校名称" />
        </Form.Item>

        <Form.Item
          label="专业"
          name="major"
        >
          <Input placeholder="请输入专业" />
        </Form.Item>

        <Form.Item
          label="班级"
          name="class_name"
        >
          <Input placeholder="请输入班级" />
        </Form.Item>

        <Form.Item
          label="联系方式"
          name="contact"
        >
          <Input placeholder="请输入手机号或邮箱" />
        </Form.Item>

        <Form.Item
          label="未来规划"
          name="future_plan"
        >
          <TextArea rows={4} placeholder="请输入未来规划" />
        </Form.Item>

        <Form.Item
          label="背景"
          name="background"
        >
          <TextArea rows={4} placeholder="请输入背景信息" />
        </Form.Item>

        <Form.Item
          label="高级合作者"
          name="is_senior"
          valuePropName="checked"
        >
          <Select>
            <Select.Option value={false}>否</Select.Option>
            <Select.Option value={true}>是</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CollaboratorFormModal;