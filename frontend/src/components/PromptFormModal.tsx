/**
 * PromptFormModal 组件（v4.9）
 * 创建/编辑提示词的表单模态框
 */
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message, Alert } from 'antd';
import { useMutation } from '@tanstack/react-query';

import { promptsApi } from '../services/apiOptimized';
import { Prompt, PromptCreate, PromptCategory, PROMPT_CATEGORY_LABELS } from '../types/prompts';

const { TextArea } = Input;
const { Option } = Select;

// 变量说明列表
const VARIABLE_HELP = [
  { name: '{journals}', desc: '期刊选择器（手动选择或点击标签快捷填充）' },
  { name: '{text}', desc: '文本（无字数限制，多个text自动编号为text1、text2等）' },
];

interface PromptFormModalProps {
  visible: boolean;
  prompt: Prompt | null;
  onCancel: () => void;
  onSuccess: () => void;
  defaultCategory?: PromptCategory;
}

const PromptFormModal: React.FC<PromptFormModalProps> = ({
  visible,
  prompt,
  onCancel,
  onSuccess,
  defaultCategory = 'writing' as PromptCategory,
}) => {
  const [form] = Form.useForm();
  const isEditing = !!prompt;

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

  // 当编辑时，回填表单；新建时重置为默认分类
  useEffect(() => {
    if (prompt) {
      form.setFieldsValue({
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
      });
    } else {
      form.setFieldsValue({
        category: defaultCategory,
      });
    }
  }, [prompt, form, defaultCategory]);

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const data: PromptCreate = {
        title: values.title,
        content: values.content,
        category: values.category,
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
              description={
                <div>
                  <div>使用以下变量格式标记可替换的内容：</div>
                  <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                    {VARIABLE_HELP.map((v, i) => (
                      <li key={i}>
                        <code>{v.name}</code> - {v.desc}
                      </li>
                    ))}
                  </ul>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          }
        >
          <TextArea
            placeholder="请输入提示词内容，支持 {变量名} 格式的变量替换..."
            autoSize={{ minRows: 8, maxRows: 20 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PromptFormModal;
