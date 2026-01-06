/**
 * PromptCopyModal 组件（v4.8）
 * 复制提示词模态框 - 支持变量替换
 */
import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, message, Space, Typography, Alert, Button, Divider } from 'antd';
import { CopyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';

import { promptsApi } from '../services/apiOptimized';
import { extractVariables } from '../types/prompts';

const { TextArea } = Input;
const { Text } = Typography;

interface PromptCopyModalProps {
  visible: boolean;
  promptId: number | null;
  onCancel: () => void;
}

const PromptCopyModal: React.FC<PromptCopyModalProps> = ({
  visible,
  promptId,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [copied, setCopied] = useState(false);
  const [finalContent, setFinalContent] = useState<string>('');

  // 获取提示词详情
  const { data: prompt, isLoading } = useQuery({
    queryKey: ['prompt', promptId],
    queryFn: () => promptsApi.getById(promptId!),
    enabled: visible && promptId !== null,
  });

  // 当提示词加载完成时，提取变量并设置表单
  useEffect(() => {
    if (prompt) {
      const variables = extractVariables(prompt.content);
      if (variables.length > 0) {
        // 设置表单初始值（如果提示词有默认变量值，可以在这里设置）
        form.setFieldsValue(
          variables.reduce((acc, variable) => {
            acc[variable] = '';
            return acc;
          }, {} as Record<string, string>)
        );
      }
    }
  }, [prompt, form]);

  // 重置状态
  useEffect(() => {
    if (!visible) {
      setCopied(false);
      setFinalContent('');
      form.resetFields();
    }
  }, [visible, form]);

  // 处理复制
  const handleCopy = async () => {
    if (!prompt) return;

    try {
      // 获取表单值
      const values = form.getFieldsValue();

      // 调用复制API
      const response = await promptsApi.copy(prompt.id, {
        variables: Object.keys(values).length > 0 ? values : undefined,
      });

      setFinalContent(response.content);

      // 复制到剪贴板
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(response.content);
        message.success('提示词已复制到剪贴板！');
      } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = response.content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        if (successful) {
          message.success('提示词已复制到剪贴板！');
        } else {
          message.warning('自动复制失败，请手动复制下方内容');
        }
      }

      setCopied(true);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '复制失败');
    }
  };

  // 获取变量列表
  const getVariables = (): string[] => {
    if (!prompt) return [];
    return extractVariables(prompt.content);
  };

  const variables = getVariables();

  return (
    <Modal
      title={
        <Space>
          <CopyOutlined />
          复制提示词
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        copied ? (
          <Button key="close" type="primary" icon={<CheckCircleOutlined />} onClick={onCancel}>
            完成
          </Button>
        ) : (
          <>
            <Button key="cancel" onClick={onCancel}>
              取消
            </Button>
            <Button key="copy" type="primary" onClick={handleCopy} loading={isLoading}>
              复制到剪贴板
            </Button>
          </>
        ),
      ]}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
      ) : prompt ? (
        <div>
          {/* 提示词标题 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>
              {prompt.title}
            </Text>
          </div>

          {/* 变量填写表单 */}
          {variables.length > 0 && !copied && (
            <>
              <Alert
                message="检测到变量，请填写以下内容"
                description="提示词中包含用 {变量名} 标记的占位符，填写后将自动替换"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form form={form} layout="vertical">
                {variables.map((variable) => (
                  <Form.Item
                    key={variable}
                    name={variable}
                    label={variable.toUpperCase()}
                    rules={[{ required: true, message: `请输入${variable}` }]}
                  >
                    <TextArea
                      placeholder={`请输入 ${variable} 的值...`}
                      autoSize={{ minRows: 1, maxRows: 4 }}
                    />
                  </Form.Item>
                ))}
              </Form>
              <Divider />
            </>
          )}

          {/* 提示词预览 */}
          <div style={{ marginBottom: 8 }}>
            <Text strong>提示词内容：</Text>
          </div>
          <div
            style={{
              padding: 12,
              background: '#f5f5f5',
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {copied ? finalContent : prompt.content}
          </div>

          {/* 复制成功提示 */}
          {copied && (
            <Alert
              message="复制成功！"
              description="提示词已复制到剪贴板，可以粘贴到 ChatGPT、Claude 等 AI 工具中使用"
              type="success"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default PromptCopyModal;
