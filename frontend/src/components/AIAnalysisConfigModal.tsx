/**
 * AI分析配置弹窗组件
 * 用于在批量分析前配置和测试AI连接
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
  Spin,
  message,
  Descriptions,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';

import { aiConfigApi } from '../services/apiOptimized';
import {
  AIConfig,
  AIConfigUpdate,
  AITestRequest,
  AITestResponse,
  AIProvider,
  AI_PRESETS,
  MODEL_OPTIONS,
} from '../types/ai';

const { Title, Text } = Typography;
const { Option } = Select;
const { Password } = Input;

interface AIAnalysisConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (config: AIConfigUpdate) => void;
  paperCount: number; // 待分析论文数量
}

const AIAnalysisConfigModal: React.FC<AIAnalysisConfigModalProps> = ({
  visible,
  onClose,
  onConfirm,
  paperCount,
}) => {
  const [form] = Form.useForm();

  // 状态管理
  const [testResult, setTestResult] = useState<AITestResponse | null>(null);
  const [hasTested, setHasTested] = useState(false);

  // 获取当前AI配置
  const { data: currentConfig, isLoading: isLoadingConfig } = useQuery<AIConfig>({
    queryKey: ['ai-config'],
    queryFn: () => aiConfigApi.getConfig(),
    enabled: visible,
  });

  // 加载当前配置到表单
  useEffect(() => {
    if (currentConfig) {
      form.setFieldsValue({
        provider: currentConfig.provider,
        api_key: '', // 不预填充API密钥
        model: currentConfig.model,
        base_url: currentConfig.base_url || AI_PRESETS[currentConfig.provider].default_base_url,
        temperature: currentConfig.temperature,
        max_tokens: currentConfig.max_tokens,
      });
    }
  }, [currentConfig, form]);

  // 测试连接
  const testMutation = useMutation({
    mutationFn: (request: AITestRequest) => aiConfigApi.testConnection(request),
  });

  // 处理提供商选择
  const handleProviderChange = (value: AIProvider) => {
    const preset = AI_PRESETS[value];
    form.setFieldsValue({
      base_url: preset.default_base_url,
      model: preset.default_model,
    });
    setTestResult(null);
    setHasTested(false);
  };

  // 处理测试连接
  const handleTest = async () => {
    const values = await form.validateFields();
    setTestResult(null);
    setHasTested(false);

    try {
      const result = await testMutation.mutateAsync({
        provider: values.provider,
        api_key: values.api_key,
        model: values.model,
        base_url: values.base_url,
        temperature: values.temperature,
        max_tokens: values.max_tokens,
      });
      setTestResult(result);
      setHasTested(true);
      if (result.success) {
        message.success('连接测试成功！');
      } else {
        message.error(`连接测试失败：${result.message}`);
      }
    } catch (error: any) {
      message.error('测试请求失败：' + (error.message || '未知错误'));
      setTestResult({
        success: false,
        message: '测试请求失败',
        error: error.message || '未知错误',
      });
      setHasTested(true);
    }
  };

  // 处理确认分析
  const handleConfirm = () => {
    const values = form.getFieldsValue();

    // 构建配置对象（排除未填写的字段）
    const config: AIConfigUpdate = {};
    if (values.provider) config.provider = values.provider;
    if (values.api_key) config.api_key = values.api_key;
    if (values.model) config.model = values.model;
    if (values.base_url) config.base_url = values.base_url;
    if (values.temperature !== undefined) config.temperature = values.temperature;
    if (values.max_tokens !== undefined) config.max_tokens = values.max_tokens;

    onConfirm(config);
    handleClose();
  };

  // 处理关闭
  const handleClose = () => {
    setTestResult(null);
    setHasTested(false);
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <ApiOutlined />
          <span>AI分析配置</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            disabled={!hasTested || !testResult?.success}
          >
            确认分析 ({paperCount} 篇)
          </Button>
        </Space>
      }
    >
      <Spin spinning={isLoadingConfig}>
        <Alert
          message="配置AI分析参数"
          description={
            <div>
              <p>本次批量分析将对 <strong>{paperCount}</strong> 篇论文进行AI分析。</p>
              <p>请配置AI参数并测试连接后再开始分析。</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            provider: 'chatanywhere',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 2000,
          }}
        >
          {/* API提供商 */}
          <Form.Item
            label="API提供商"
            name="provider"
            rules={[{ required: true, message: '请选择API提供商' }]}
          >
            <Select onChange={handleProviderChange}>
              {Object.entries(AI_PRESETS).map(([key, preset]) => (
                <Option key={key} value={key}>
                  {preset.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* API密钥 */}
          <Form.Item
            label="API密钥"
            name="api_key"
            rules={[{ required: true, message: '请输入API密钥' }]}
            extra={currentConfig?.has_api_key && !form.getFieldValue('api_key') ? '已保存的密钥将被使用，如需更改请输入新密钥' : undefined}
          >
            <Password
              placeholder={currentConfig?.has_api_key ? '留空使用已保存的密钥' : '请输入API密钥'}
              prefix={<ApiOutlined />}
            />
          </Form.Item>

          {/* 模型选择 */}
          <Form.Item
            label="模型"
            name="model"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select>
              {MODEL_OPTIONS.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* API基础URL */}
          <Form.Item
            label="API基础URL"
            name="base_url"
            rules={[{ required: true, message: '请输入API基础URL' }]}
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          {/* 温度和Token数 */}
          <Form.Item label="参数配置">
            <Space style={{ width: '100%' }}>
              <Form.Item
                name="temperature"
                label="温度"
                style={{ marginBottom: 0, width: 200 }}
                rules={[
                  { required: true, message: '请输入温度参数' },
                  { type: 'number', min: 0, max: 2, message: '温度范围：0-2' },
                ]}
              >
                <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="max_tokens"
                label="最大Token数"
                style={{ marginBottom: 0, width: 200 }}
                rules={[
                  { required: true, message: '请输入最大Token数' },
                  { type: 'number', min: 100, max: 8000, message: 'Token范围：100-8000' },
                ]}
              >
                <InputNumber min={100} max={8000} step={100} style={{ width: '100%' }} />
              </Form.Item>
            </Space>
          </Form.Item>

          {/* 测试连接按钮 */}
          <Form.Item>
            <Button
              type="default"
              icon={<ApiOutlined />}
              onClick={handleTest}
              loading={testMutation.isPending}
              block
            >
              测试连接
            </Button>
          </Form.Item>

          {/* 测试结果 */}
          {testResult && (
            <>
              <Divider />
              <Title level={5}>测试结果</Title>
              {testResult.success ? (
                <Alert
                  type="success"
                  icon={<CheckCircleOutlined />}
                  message={testResult.message}
                  description={
                    <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                      {testResult.response_time_ms && (
                        <Descriptions.Item label="响应时间">
                          {testResult.response_time_ms} ms
                        </Descriptions.Item>
                      )}
                      {testResult.sample_response && (
                        <Descriptions.Item label="示例响应">
                          <Text ellipsis={{ tooltip: testResult.sample_response }}>
                            {testResult.sample_response}
                          </Text>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  }
                  showIcon
                />
              ) : (
                <Alert
                  type="error"
                  icon={<CloseCircleOutlined />}
                  message={testResult.message}
                  description={testResult.error && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {testResult.error}
                    </Text>
                  )}
                  showIcon
                  action={
                    <Button size="small" danger icon={<ReloadOutlined />} onClick={handleTest}>
                      重试
                    </Button>
                  }
                />
              )}
            </>
          )}
        </Form>
      </Spin>
    </Modal>
  );
};

export default AIAnalysisConfigModal;
