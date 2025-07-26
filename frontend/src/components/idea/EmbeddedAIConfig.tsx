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
      console.log('获取AI配置...');
      const apiSettings = await settingsApi.getSettings();
      console.log('获取到的配置:', { api_key: apiSettings.api_key ? '***已设置***' : '未设置', api_base: apiSettings.api_base, model: apiSettings.model });
      
      const configData: AIConfig = {
        api_key: apiSettings.api_key,
        api_url: apiSettings.api_base,
        model: apiSettings.model,
        is_connected: !!apiSettings.api_key // 如果有API密钥，认为可以使用（后端会自己验证）
      };
      
      setConfig(configData);
      form.setFieldsValue({
        api_key: apiSettings.api_key,
        api_url: apiSettings.api_base,
        model: apiSettings.model
      });
      
      // 如果有完整配置，设为可用状态，允许用户使用
      if (apiSettings.api_key && apiSettings.api_base && apiSettings.model) {
        setConnectionStatus(null); // 设为null表示未测试但可用
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('获取API配置失败:', error);
      // 设置默认值但不自动填充API密钥
      const defaultConfig: AIConfig = {
        api_key: '',
        api_url: 'https://api.chatanywhere.tech/v1',
        model: 'claude-3-7-sonnet-20250219',
        is_connected: false
      };
      setConfig(defaultConfig);
      form.setFieldsValue(defaultConfig);
      setConnectionStatus('error');
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
      console.log('开始保存AI配置...', { api_key: '***', api_url: values.api_url, model: values.model });
      
      const apiSettings: APISettings = {
        api_key: values.api_key,
        api_base: values.api_url,
        model: values.model
      };
      
      const updatedSettings = await settingsApi.updateApiSettings(apiSettings);
      console.log('配置保存成功:', { api_key: '***', api_base: updatedSettings.api_base, model: updatedSettings.model });
      
      // 创建新配置对象
      const newConfig: AIConfig = {
        api_key: updatedSettings.api_key,
        api_url: updatedSettings.api_base,
        model: updatedSettings.model,
        is_connected: false // 保存后需要手动测试连接
      };
      
      setConfig(newConfig);
      setConnectionStatus(null); // 重置连接状态
      message.success('AI配置保存成功！请点击“测试连接”验证配置');
    } catch (error: any) {
      console.error('保存配置失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '保存配置失败';
      message.error('保存配置失败：' + errorMessage);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (configToTest?: AIConfig) => {
    const testConfig = configToTest || config;
    if (!testConfig?.api_key) {
      message.error('请先填写API密钥');
      setConnectionStatus('error');
      return;
    }
    
    setTesting(true);
    console.log('开始测试AI连接...', { 
      api_key: '***', 
      api_base: testConfig.api_url || 'https://api.chatanywhere.tech/v1', 
      model: testConfig.model || 'claude-3-7-sonnet-20250219' 
    });
    
    try {
      const response = await settingsApi.testConnection({
        api_key: testConfig.api_key,
        api_base: testConfig.api_url || 'https://api.chatanywhere.tech/v1',
        model: testConfig.model || 'claude-3-7-sonnet-20250219'
      });
      
      console.log('连接测试响应:', response);
      
      if (response.success) {
        message.success('API连接测试成功');
        setConnectionStatus('success');
        
        // 更新配置状态，设置为已连接
        const updatedConfig = { ...testConfig, is_connected: true };
        setConfig(updatedConfig);
        console.log('配置状态更新为已连接:', updatedConfig);
        
        // 通知父组件配置变化
        if (onConfigChange) {
          onConfigChange(updatedConfig);
        }
        
        // 测试成功，配置已更新
      } else {
        const errorMsg = response.message || '连接测试失败';
        message.error(`连接测试失败：${errorMsg}`);
        setConnectionStatus('error');
        
        // 确保配置状态设为未连接
        const updatedConfig = { ...testConfig, is_connected: false };
        setConfig(updatedConfig);
        if (onConfigChange) {
          onConfigChange(updatedConfig);
        }
      }
    } catch (error: any) {
      console.error('AI连接测试错误:', error);
      const errorMsg = error.response?.data?.detail || error.message || '连接测试失败';
      message.error('连接测试失败：' + errorMsg);
      setConnectionStatus('error');
      
      // 确保配置状态设为未连接
      if (testConfig) {
        const updatedConfig = { ...testConfig, is_connected: false };
        setConfig(updatedConfig);
        if (onConfigChange) {
          onConfigChange(updatedConfig);
        }
      }
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
      status: 'info' as const,
      message: '配置已加载，可以使用（建议测试连接）',
      icon: <ApiOutlined style={{ color: '#1890ff' }} />
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
        <Tag color={connectionStatus === 'success' ? 'green' : connectionStatus === 'error' ? 'red' : 'blue'}>
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
              <Input 
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
                  <Option key={model.id} value={model.id}>{model.id}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading} size="small">
                  保存
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