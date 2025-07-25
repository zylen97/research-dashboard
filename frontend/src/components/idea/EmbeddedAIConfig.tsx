import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Typography,
  Alert,
  Select,
  Spin,
  Collapse,
  Tag
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  RobotOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// Provider配置（从AIConfigPanel复制）
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']
  },
  anthropic: {
    name: 'Anthropic',
    url: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-7-sonnet-20250219',
      'claude-sonnet-4-20250514', 
      'claude-opus-4-20250514-thinking',
      'claude-opus-4-20250514'
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1',
    models: ['deepseek-v3', 'deepseek-r1']
  },
  custom: {
    name: '自定义',
    url: 'https://api.chatanywhere.tech/v1',
    models: [
      'claude-3-7-sonnet-20250219',
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514-thinking', 
      'claude-opus-4-20250514',
      'deepseek-v3',
      'deepseek-r1',
      'gpt-4.1',
      'gpt-4o',
      'gpt-4o-mini'
    ]
  }
};

// 默认配置
const DEFAULT_CONFIG = {
  provider: 'custom',
  api_key: 'sk-LrOwl2ZEbKhZxW4s27EyGdjwnpZ1nDwjVRJk546lSspxHymY',
  api_url: 'https://api.chatanywhere.tech/v1',
  model: 'claude-3-7-sonnet-20250219'
};

interface AIConfig {
  provider: string;
  api_key: string;
  api_url?: string;
  model?: string;
  is_connected?: boolean;
}

interface EmbeddedAIConfigProps {
  onConfigChange?: (config: AIConfig | null) => void;
}

const EmbeddedAIConfig: React.FC<EmbeddedAIConfigProps> = ({ onConfigChange }) => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_CONFIG.provider);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/', {
        params: { category: 'ai_config' }
      });
      const configData = response.data?.find((c: any) => c.key === 'main_ai_config');
      if (configData) {
        const parsedConfig = JSON.parse(configData.value);
        setConfig(parsedConfig);
        form.setFieldsValue(parsedConfig);
        setSelectedProvider(parsedConfig.provider || DEFAULT_CONFIG.provider);
        setConnectionStatus(parsedConfig.is_connected ? 'success' : null);
      } else {
        // 设置默认值
        form.setFieldsValue(DEFAULT_CONFIG);
        setSelectedProvider(DEFAULT_CONFIG.provider);
        setConfig(DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error('获取AI配置失败:', error);
      // 如果获取失败，使用默认配置
      form.setFieldsValue(DEFAULT_CONFIG);
      setSelectedProvider(DEFAULT_CONFIG.provider);
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: AIConfig) => {
    try {
      // 保存配置
      await api.post('/config/', {
        key: 'main_ai_config',
        value: JSON.stringify(values),
        category: 'ai_config',
        description: 'Main AI Configuration',
        is_active: true
      });
      
      setConfig(values);
      message.success('AI配置保存成功');
      
      // 自动测试连接
      await testConnection(values);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('保存配置失败：' + errorMessage);
    }
  };

  const testConnection = async (configToTest?: AIConfig) => {
    const testConfig = configToTest || config;
    if (!testConfig?.api_key) {
      message.error('请先填写API密钥');
      return;
    }
    
    setTesting(true);
    try {
      const response = await api.post('/config/ai/test', {
        provider: testConfig.provider || 'custom',
        api_key: testConfig.api_key,
        api_url: testConfig.api_url,
        test_prompt: '你好，请回复"API连接成功"'
      });
      
      if (response.data.success) {
        message.success('API连接测试成功');
        setConnectionStatus('success');
        
        // 更新配置状态
        const updatedConfig = { ...testConfig, is_connected: true };
        await api.put('/config/', {
          key: 'main_ai_config',
          value: JSON.stringify(updatedConfig)
        });
        setConfig(updatedConfig);
      } else {
        message.error(`连接测试失败：${response.data.message}`);
        setConnectionStatus('error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('连接测试失败：' + errorMessage);
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  // 获取连接状态显示
  const getConnectionStatus = () => {
    if (connectionStatus === 'success') {
      return {
        status: 'success' as const,
        message: 'API连接正常',
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      };
    }
    if (connectionStatus === 'error') {
      return {
        status: 'error' as const,
        message: 'API连接失败',
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      };
    }
    return {
      status: 'warning' as const,
      message: '请配置并测试API连接',
      icon: <ApiOutlined style={{ color: '#faad14' }} />
    };
  };

  const getCurrentConfigDisplay = () => {
    if (!config) return null;
    
    const providerName = PROVIDERS[config.provider as keyof typeof PROVIDERS]?.name || config.provider;
    return (
      <Space>
        <RobotOutlined />
        <Text strong>{providerName}</Text>
        <Text type="secondary">•</Text>
        <Text>{config.model}</Text>
        <Tag color={connectionStatus === 'success' ? 'green' : connectionStatus === 'error' ? 'red' : 'orange'}>
          {getConnectionStatus().message}
        </Tag>
      </Space>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
          <div style={{ marginTop: '8px' }}>
            <Text type="secondary">加载AI配置...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space>
          <ApiOutlined />
          <span>AI配置管理</span>
        </Space>
      } 
      size="small"
    >
      {/* 当前配置状态显示 */}
      <div style={{ marginBottom: '16px' }}>
        <Text type="secondary">当前AI配置：</Text>
        <div style={{ marginTop: '8px' }}>
          {getCurrentConfigDisplay() || <Text type="secondary">暂未配置</Text>}
        </div>
      </div>

      {connectionStatus && (
        <Alert
          message={getConnectionStatus().message}
          type={getConnectionStatus().status}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* 可折叠的配置表单 */}
      <Collapse 
        size="small"
        activeKey={isExpanded ? ['config'] : []}
        onChange={(keys) => setIsExpanded(keys.includes('config'))}
      >
        <Panel 
          header="AI配置" 
          key="config"
          extra={<SettingOutlined />}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={DEFAULT_CONFIG}
            size="small"
          >
            <Form.Item
              name="provider"
              label="AI提供商"
              rules={[{ required: true, message: '请选择AI提供商' }]}
            >
              <Select 
                placeholder="选择AI提供商"
                onChange={(value) => {
                  setSelectedProvider(value);
                  const provider = PROVIDERS[value as keyof typeof PROVIDERS];
                  if (provider) {
                    form.setFieldsValue({
                      api_url: provider.url,
                      model: provider.models[0]
                    });
                  }
                }}
              >
                {Object.entries(PROVIDERS).map(([key, provider]) => (
                  <Option key={key} value={key}>{provider.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="api_key"
              label="API密钥"
              rules={[{ required: true, message: '请输入API密钥' }]}
              tooltip="请输入你的API密钥"
            >
              <Input.Password 
                placeholder="sk-xxxxxxxxxxxxxxxxxxxx" 
                autoComplete="off"
              />
            </Form.Item>

            <Form.Item
              name="api_url"
              label="API地址"
              rules={[{ required: true, message: '请输入API地址' }]}
              tooltip="API请求地址"
            >
              <Input placeholder="https://api.chatanywhere.tech/v1" />
            </Form.Item>

            <Form.Item
              name="model"
              label="默认模型"
              rules={[{ required: true, message: '请选择默认模型' }]}
            >
              <Select placeholder="选择模型">
                {selectedProvider && PROVIDERS[selectedProvider as keyof typeof PROVIDERS]?.models.map(model => (
                  <Option key={model} value={model}>{model}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading} size="small">
                  保存并测试
                </Button>
                <Button onClick={() => testConnection()} loading={testing} disabled={!config} size="small">
                  测试连接
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Panel>
      </Collapse>
    </Card>
  );
};

export default EmbeddedAIConfig;