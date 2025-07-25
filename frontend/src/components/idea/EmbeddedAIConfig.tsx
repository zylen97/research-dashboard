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
import { settingsApi, APISettings, Model } from '../../services/settingsApi';

const { Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

interface AIConfig {
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    fetchConfig();
    fetchModels();
  }, []);

  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const apiSettings = await settingsApi.getSettings();
      
      const configData: AIConfig = {
        api_key: apiSettings.api_key,
        api_url: apiSettings.api_base,
        model: apiSettings.model
      };
      
      setConfig(configData);
      form.setFieldsValue({
        api_key: apiSettings.api_key,
        api_url: apiSettings.api_base,
        model: apiSettings.model
      });
      
      // 如果有API密钥，显示为已连接
      if (apiSettings.api_key) {
        setConnectionStatus('success');
      }
    } catch (error) {
      console.error('获取API配置失败:', error);
      // 设置默认值
      const defaultConfig = {
        api_key: 'sk-LrOwl2ZEbKhZxW4s27EyGdjwnpZ1nDwjVRJk546lSspxHymY',
        api_url: 'https://api.chatanywhere.tech/v1',
        model: 'claude-3-7-sonnet-20250219'
      };
      setConfig(defaultConfig);
      form.setFieldsValue(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await settingsApi.getModels();
      setModels(response.models || []);
    } catch (error) {
      console.error('获取模型列表失败:', error);
      // 设置默认模型列表
      setModels([
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet",
          description: "高性能多模态模型"
        }
      ]);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const apiSettings: APISettings = {
        api_key: values.api_key,
        api_base: values.api_url,
        model: values.model
      };
      
      const updatedSettings = await settingsApi.updateApiSettings(apiSettings);
      
      const newConfig: AIConfig = {
        api_key: updatedSettings.api_key,
        api_url: updatedSettings.api_base,
        model: updatedSettings.model,
        is_connected: true
      };
      
      setConfig(newConfig);
      message.success('AI配置保存成功');
      
      // 自动测试连接
      await testConnection(newConfig);
    } catch (error: any) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
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
      const response = await settingsApi.testConnection({
        api_key: testConfig.api_key,
        api_base: testConfig.api_url || 'https://api.chatanywhere.tech/v1',
        model: testConfig.model || 'claude-3-7-sonnet-20250219'
      });
      
      if (response.success) {
        message.success('API连接测试成功');
        setConnectionStatus('success');
        
        if (config) {
          setConfig({ ...config, is_connected: true });
        }
      } else {
        message.error(`连接测试失败：${response.message}`);
        setConnectionStatus('error');
      }
    } catch (error: any) {
      console.error('AI连接测试错误:', error);
      message.error('连接测试失败：' + (error.response?.data?.detail || error.message));
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
    
    return (
      <Space>
        <RobotOutlined />
        <Text strong>AI配置</Text>
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
            size="small"
          >
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
              initialValue="https://api.chatanywhere.tech/v1"
            >
              <Input placeholder="https://api.chatanywhere.tech/v1" />
            </Form.Item>

            <Form.Item
              name="model"
              label="默认模型"
              rules={[{ required: true, message: '请选择默认模型' }]}
              initialValue="claude-3-7-sonnet-20250219"
            >
              <Select placeholder="选择模型">
                {models.map(model => (
                  <Option key={model.id} value={model.id}>{model.name}</Option>
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