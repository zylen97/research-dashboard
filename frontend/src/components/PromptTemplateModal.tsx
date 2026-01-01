/**
 * 提示词模板编辑弹窗组件
 * 用于创建和编辑提示词模板
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Typography,
  Divider,
  Tag,
  Alert,
} from 'antd';

import { PromptTemplate, PromptTemplateUpdate } from '../types/papers';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface PromptTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (template: PromptTemplateUpdate & { name?: string }) => void;
  template?: PromptTemplate | null; // 编辑时传入
}

// 内置变量列表
const BUILTIN_VARIABLES = [
  { name: 'title', description: '论文标题' },
  { name: 'authors', description: '作者列表' },
  { name: 'abstract', description: '论文摘要' },
  { name: 'keywords', description: '关键词' },
  { name: 'year', description: '发表年份' },
  { name: 'journal_name', description: '期刊名称' },
  { name: 'user_profile', description: '用户研究背景' },
  { name: 'research_fields', description: '研究领域列表' },
];

const PromptTemplateModal: React.FC<PromptTemplateModalProps> = ({
  visible,
  onClose,
  onSave,
  template,
}) => {
  const [form] = Form.useForm();
  const [extractedVars, setExtractedVars] = useState<string[]>([]);

  // 提取变量
  const extractVariables = (content: string) => {
    const pattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const matches = content.match(pattern);
    if (matches) {
      const vars = matches.map(m => m.slice(1, -1)); // 去掉大括号
      // 过滤掉内置变量，只显示自定义变量
      const builtinVarNames = BUILTIN_VARIABLES.map(v => v.name);
      return vars.filter(v => !builtinVarNames.includes(v));
    }
    return [];
  };

  // 编辑时加载数据
  useEffect(() => {
    if (template) {
      form.setFieldsValue({
        name: template.name,
        content: template.content,
        is_default: template.is_default,
      });
      setExtractedVars(template.variables || []);
    } else {
      form.resetFields();
      setExtractedVars([]);
    }
  }, [template, form, visible]);

  // 处理内容变化，实时提取变量
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    const vars = extractVariables(content);
    setExtractedVars(vars);
  };

  // 处理确认保存
  const handleOk = () => {
    form.validateFields().then((values) => {
      const templateData: PromptTemplateUpdate & { name?: string } = {
        content: values.content,
        is_default: values.is_default || false,
      };
      if (!template) {
        // 新建时需要名称
        templateData.name = values.name;
      }
      onSave(templateData);
    });
  };

  // 预览提示词
  const renderPromptPreview = () => {
    const content = form.getFieldValue('content') || '';
    const parts = content.split(/(\{[a-zA-Z_][a-zA-Z0-9_]*\})/g);

    return (
      <Paragraph code style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
        {parts.map((part: string, idx: number) => {
          if (part.startsWith('{') && part.endsWith('}')) {
            const varName = part.slice(1, -1);
            return (
              <Tag key={idx} color="blue" style={{ margin: '0 2px' }}>
                {varName}
              </Tag>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </Paragraph>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            {template ? '编辑提示词模板' : '新建提示词模板'}
          </Title>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      width={700}
      okText="保存"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          is_default: false,
        }}
      >
        {/* 模板名称 */}
        <Form.Item
          label="模板名称"
          name="name"
          rules={[
            { required: true, message: '请输入模板名称' },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: '名称只能包含字母、数字、下划线和连字符',
            },
          ]}
          tooltip="模板的唯一标识，只能包含字母、数字、下划线和连字符"
        >
          <Input
            placeholder="例如: v3_custom_analysis"
            disabled={!!template} // 编辑时不可修改名称
          />
        </Form.Item>

        {/* 提示词内容 */}
        <Form.Item
          label="提示词内容"
          name="content"
          rules={[{ required: true, message: '请输入提示词内容' }]}
          extra={
            <Alert
              message={
                <Space direction="vertical" size={0}>
                  <Text>使用 {'{变量名}'} 格式插入变量</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    内置变量：{BUILTIN_VARIABLES.map(v => v.name).join(', ')}
                  </Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          }
        >
          <TextArea
            rows={10}
            placeholder="请输入提示词内容，使用 {变量名} 插入变量，例如：&#10;&#10;请分析以下论文：&#10;标题：{title}&#10;摘要：{abstract}&#10;&#10;我的研究方向：{research_fields}"
            onChange={handleContentChange}
          />
        </Form.Item>

        {/* 变量预览 */}
        {form.getFieldValue('content') && (
          <Form.Item label="变量检测">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>内置变量：</Text>
                <div style={{ marginTop: 4 }}>
                  {BUILTIN_VARIABLES.map(v => (
                    <Tag key={v.name} style={{ marginBottom: 4 }}>
                      {'{'}{v.name}{'}'} - {v.description}
                    </Tag>
                  ))}
                </div>
              </div>

              {extractedVars.length > 0 && (
                <div>
                  <Text strong>自定义变量：</Text>
                  <div style={{ marginTop: 4 }}>
                    {extractedVars.map(v => (
                      <Tag key={v} color="orange" style={{ marginBottom: 4 }}>
                        {'{'}{v}{'}'}
                      </Tag>
                    ))}
                  </div>
                  <Alert
                    message="这些变量将在分析时要求用户输入具体的值"
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                </div>
              )}

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <Text strong>提示词预览：</Text>
                <div style={{ marginTop: 4 }}>
                  {renderPromptPreview()}
                </div>
              </div>
            </Space>
          </Form.Item>
        )}

        {/* 设为默认 */}
        <Form.Item
          name="is_default"
          valuePropName="checked"
          tooltip="设为默认后，批量分析时会优先使用此模板"
        >
          <Switch
            checkedChildren="默认模板"
            unCheckedChildren="普通模板"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PromptTemplateModal;
