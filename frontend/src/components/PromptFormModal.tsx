/**
 * PromptFormModal 组件（v4.8）
 * 创建/编辑提示词的表单模态框
 */
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message, Alert } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';

import { promptsApi, tagApi } from '../services/apiOptimized';
import { Prompt, PromptCreate, PromptCategory, PROMPT_CATEGORY_LABELS, extractVariables } from '../types/prompts';
import { Tag as TagType } from '../types/journals';

const { TextArea } = Input;
const { Option } = Select;

interface PromptFormModalProps {
  visible: boolean;
  prompt: Prompt | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const PromptFormModal: React.FC<PromptFormModalProps> = ({
  visible,
  prompt,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const isEditing = !!prompt;

  // 获取标签列表
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 创建提示词
  const createMutation = useMutation({
    mutationFn: (data: PromptCreate) => promptsApi.create(data),
    onSuccess: () => {
      message.success('提示词创建成功');
      form.resetFields();
      onSuccess();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新提示词
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PromptCreate }) =>
      promptsApi.update(id, data),
    onSuccess: () => {
      message.success('提示词更新成功');
      form.resetFields();
      onSuccess();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 当编辑时，回填表单
  useEffect(() => {
    if (prompt) {
      form.setFieldsValue({
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
        description: prompt.description || '',
        tag_ids: prompt.tags?.map((tag) => tag.id) || [],
      });
    } else {
      form.resetFields();
    }
  }, [prompt, form]);

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const data: PromptCreate = {
        title: values.title,
        content: values.content,
        category: values.category,
        description: values.description || undefined,
        tag_ids: values.tag_ids || [],
      };

      if (isEditing) {
        updateMutation.mutate({ id: prompt.id, data });
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  // 检测变量
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    extractVariables(content);
    // 可以在这里实时显示检测到的变量
  };

  return (
    <Modal
      title={isEditing ? '编辑提示词' : '新增提示词'}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          category: 'writing' as PromptCategory,
          tag_ids: [],
        }}
      >
        {/* 标题 */}
        <Form.Item
          name="title"
          label="提示词标题"
          rules={[{ required: true, message: '请输入提示词标题' }]}
        >
          <Input placeholder="例如：GEMINI精读论文" />
        </Form.Item>

        {/* 分类 */}
        <Form.Item
          name="category"
          label="分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select placeholder="请选择分类">
            {Object.entries(PROMPT_CATEGORY_LABELS).map(([value, label]) => (
              <Option key={value} value={value}>
                {label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* 内容 */}
        <Form.Item
          name="content"
          label="提示词内容"
          rules={[{ required: true, message: '请输入提示词内容' }]}
          extra={
            <Alert
              message="变量提示"
              description="使用 {变量名} 格式标记可替换的变量，例如：{title}、{abstract} 等"
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          }
        >
          <TextArea
            placeholder="请输入提示词内容，支持 {变量名} 格式的变量替换..."
            autoSize={{ minRows: 8, maxRows: 20 }}
            onChange={handleContentChange}
          />
        </Form.Item>

        {/* 描述 */}
        <Form.Item name="description" label="详细说明（可选）">
          <TextArea
            placeholder="简要说明这个提示词的用途和使用场景..."
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </Form.Item>

        {/* 标签 */}
        <Form.Item name="tag_ids" label="标签（可选）">
          <Select mode="multiple" placeholder="选择标签" allowClear>
            {tags.map((tag: TagType) => (
              <Option key={tag.id} value={tag.id}>
                {tag.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PromptFormModal;
