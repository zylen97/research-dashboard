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
  InputNumber
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { settingsApi, APISettings, Model } from '../../services/settingsApi';

const { Text } = Typography;
const { Option } = Select;

interface AIConfig {
  api_key: string;
  api_base?: string;
  model?: string;
  is_connected?: boolean;
}

interface ConcurrentConfig {
  max_concurrent: number;
}

// 默认并发数配置
const DEFAULT_CONCURRENT_CONFIG: ConcurrentConfig = {
  max_concurrent: 50
};

interface EmbeddedAIConfigProps {
  onConfigChange?: (config: AIConfig | null) => void;
}

const EmbeddedAIConfig: React.FC<EmbeddedAIConfigProps> = ({ onConfigChange }) => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  
  // 本地并发数配置状态
  const [concurrentConfig, setConcurrentConfig] = useState<ConcurrentConfig>(DEFAULT_CONCURRENT_CONFIG);

  useEffect(() => {
    fetchConfig();
    fetchModels();
    loadConcurrentConfig();
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
      console.log('获取到的配置:', { 
        api_key: apiSettings.api_key ? '***已设置***' : '未设置', 
        api_base: apiSettings.api_base, 
        model: apiSettings.model 
      });
      
      const configData: AIConfig = {
        api_key: apiSettings.api_key,
        api_base: apiSettings.api_base,
        model: apiSettings.model,
        is_connected: false,
      };
      
      setConfig(configData);
      form.setFieldsValue({
        api_key: apiSettings.api_key,
        api_base: apiSettings.api_base,
        model: apiSettings.model
      });
      
      setConnectionStatus(null);
    } catch (error) {
      console.error('获取API配置失败:', error);
      // 设置默认值
      const defaultConfig: AIConfig = {
        api_key: 'sk-LrOwl2ZEbKhZxW4s27EyGdjwnpZ1nDwjVRJk546lSspxHymY',
        api_base: 'https://api.chatanywhere.tech/v1',
        model: 'claude-3-7-sonnet-20250219',
        is_connected: false,
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
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "高性能多模态模型" },
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "最新一代智能模型" },
        { id: "claude-opus-4-20250514-thinking", name: "Claude Opus 4 Thinking", description: "Claude Opus 4思考版本" },
        { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "Claude Opus 4标准版本" },
        { id: "deepseek-v3", name: "DeepSeek V3", description: "DeepSeek第三代模型" },
        { id: "deepseek-r1", name: "DeepSeek R1", description: "DeepSeek推理模型" },
        { id: "gpt", name: "GPT", description: "OpenAI GPT模型" },
        { id: "gpt-4.1", name: "GPT-4.1", description: "OpenAI GPT-4.1" },
        { id: "gpt-4o", name: "GPT-4o", description: "OpenAI最新多模态模型" }
      ]);
    }
  };

  // 加载本地并发数配置
  const loadConcurrentConfig = () => {
    try {
      const saved = localStorage.getItem('ai_concurrent_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setConcurrentConfig(parsed);
      }
    } catch (error) {
      console.warn('加载并发数配置失败，使用默认值:', error);
    }
  };

  // 保存本地并发数配置
  const saveConcurrentConfig = (newConfig: ConcurrentConfig) => {
    try {
      localStorage.setItem('ai_concurrent_config', JSON.stringify(newConfig));
      setConcurrentConfig(newConfig);
    } catch (error) {
      console.error('保存并发数配置失败:', error);
    }
  };

  // 处理并发数变更
  const handleConcurrentChange = (value: number | null) => {
    if (value !== null && value >= 0 && value <= 50) {
      const newConfig = { max_concurrent: value };
      saveConcurrentConfig(newConfig);
      message.success(`并发数已设置为 ${value}，下次处理时生效`);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      console.log('开始保存AI配置...', { 
        api_key: '***', 
        api_base: values.api_base, 
        model: values.model 
      });
      
      const apiSettings: APISettings = {
        api_key: values.api_key,
        api_base: values.api_base,
        model: values.model
      };
      
      const updatedSettings = await settingsApi.updateApiSettings(apiSettings);
      console.log('配置保存成功:', { 
        api_key: '***', 
        api_base: updatedSettings.api_base, 
        model: updatedSettings.model 
      });
      
      // 创建新配置对象
      const newConfig: AIConfig = {
        api_key: updatedSettings.api_key,
        api_base: updatedSettings.api_base,
        model: updatedSettings.model,
        is_connected: false, // 保存后需要重新测试连接
      };
      
      setConfig(newConfig);
      setConnectionStatus(null);
      message.success('AI配置保存成功！请点击"测试连接"验证配置');
    } catch (error: any) {
      console.error('保存配置失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '保存配置失败';
      message.error('保存配置失败：' + errorMessage);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config?.api_key) {
      message.error('请先填写API密钥');
      setConnectionStatus('error');
      return;
    }
    
    // 开始测试时重置连接状态
    if (config) {
      const updatedConfig = { ...config, is_connected: false };
      setConfig(updatedConfig);
    }
    
    setTesting(true);
    console.log('开始测试AI连接...', { 
      api_key: '***', 
      api_base: config.api_base || 'https://api.chatanywhere.tech/v1', 
      model: config.model || 'claude-3-7-sonnet-20250219' 
    });
    
    try {
      const response = await settingsApi.testConnection({
        api_key: config.api_key,
        api_base: config.api_base || 'https://api.chatanywhere.tech/v1',
        model: config.model || 'claude-3-7-sonnet-20250219'
      });
      
      console.log('连接测试响应:', response);
      
      if (response.success) {
        message.success('API连接测试成功');
        setConnectionStatus('success');
        
        // 更新配置状态为已连接
        if (config) {
          const updatedConfig = { ...config, is_connected: true };
          setConfig(updatedConfig);
        }
      } else {
        const errorMsg = response.message || '连接测试失败';
        message.error(`连接测试失败：${errorMsg}`);
        setConnectionStatus('error');
        
        // 更新配置状态为未连接
        if (config) {
          const updatedConfig = { ...config, is_connected: false };
          setConfig(updatedConfig);
        }
      }
    } catch (error: any) {
      console.error('AI连接测试错误:', error);
      const errorMsg = error.response?.data?.detail || error.message || '连接测试失败';
      message.error('连接测试失败：' + errorMsg);
      setConnectionStatus('error');
      
      // 更新配置状态为未连接
      if (config) {
        const updatedConfig = { ...config, is_connected: false };
        setConfig(updatedConfig);
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
      message: '配置已加载，建议测试连接',
      icon: <ApiOutlined style={{ color: '#1890ff' }} />
    };
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
    >
      {connectionStatus && (
        <Alert
          message={getConnectionStatus().message}
          type={getConnectionStatus().status}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* AI配置表单 */}
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
          name="api_base"
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
              <Option key={model.id} value={model.id} title={model.description}>
                {model.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} size="small">
              保存
            </Button>
            <Button onClick={testConnection} loading={testing} disabled={!config} size="small">
              测试连接
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* 独立的并发数配置区域 */}
      <div style={{ 
        marginTop: '16px', 
        padding: '12px', 
        backgroundColor: '#fafafa', 
        borderRadius: '6px', 
        border: '1px solid #f0f0f0' 
      }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
          客户端并发数 (本地配置)
        </div>
        <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666' }}>
          AI请求并发数量，范围0-50，仅在当前浏览器生效
        </div>
        <Space align="center">
          <InputNumber
            min={0}
            max={50}
            value={concurrentConfig.max_concurrent}
            onChange={handleConcurrentChange}
            size="small"
            style={{ width: '80px' }}
          />
          <Text style={{ fontSize: '11px', color: '#52c41a', fontWeight: 'bold' }}>
            当前: {concurrentConfig.max_concurrent}
          </Text>
          <Text style={{ fontSize: '11px', color: '#999' }}>
            (默认: 50)
          </Text>
        </Space>
      </div>
    </Card>
  );
};

export default EmbeddedAIConfig;