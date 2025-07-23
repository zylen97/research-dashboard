import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Checkbox } from 'antd';
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
  const [isGroup, setIsGroup] = useState(false);

  // 监听表单中is_group字段的变化
  useEffect(() => {
    const isGroupValue = form.getFieldValue('is_group');
    setIsGroup(!!isGroupValue);
  }, [editingCollaborator, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 处理is_group复选框变化
  const handleGroupChange = (e: any) => {
    const checked = e.target.checked;
    setIsGroup(checked);
    
    // 如果勾选了小组成员，清空性别选择
    if (checked) {
      form.setFieldsValue({ gender: undefined });
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
        initialValues={editingCollaborator || { gender: '男', is_senior: false, is_group: false }}
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
          rules={[{ required: !isGroup, message: '请选择性别' }]}
        >
          <Radio.Group disabled={isGroup}>
            <Radio value="男">男</Radio>
            <Radio value="女">女</Radio>
          </Radio.Group>
          {isGroup && (
            <div style={{ marginTop: 4, fontSize: '12px', color: '#999' }}>
              小组成员不需要选择性别
            </div>
          )}
        </Form.Item>

        <Form.Item
          label="班级"
          name="class_name"
        >
          <Input placeholder="请输入班级" />
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
          name="is_senior"
          valuePropName="checked"
          style={{ marginBottom: 16 }}
        >
          <Checkbox>高级合作者</Checkbox>
        </Form.Item>

        <Form.Item
          name="is_group"
          valuePropName="checked"
        >
          <Checkbox onChange={handleGroupChange}>小组成员</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CollaboratorFormModal;