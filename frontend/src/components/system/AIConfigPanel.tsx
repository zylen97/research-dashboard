import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Row,
  Col,
  Typography,
  Avatar,
  List,
  Alert,
  Select
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  MessageOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Provider和模型配置
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

interface SystemConfig {
  id: number;
  key: string;
  value: string;
  category: string;
  description?: string;
  is_encrypted: boolean;
  is_active: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  responseTime?: number;
  error?: boolean;
}

const AIConfigPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_CONFIG.provider);
  
  // 聊天功能状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/', {
        params: { category: 'ai_config' }
      });
      const configData = response.data.find((c: SystemConfig) => c.key === 'main_ai_config');
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
      }
    } catch (error) {
      console.error('获取AI配置失败:', error);
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

  // 处理发送聊天消息
  const handleSendMessage = async () => {
    if (!chatInput.trim()) {
      message.warning('请输入消息');
      return;
    }

    if (!config?.api_key) {
      message.error('请先配置AI密钥');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    const startTime = Date.now();

    try {
      const response = await api.post('/config/ai/test', {
        provider: config.provider || 'custom',
        api_key: config.api_key,
        api_url: config.api_url,
        test_prompt: chatInput
      });

      const responseTime = Date.now() - startTime;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.data.response_content || response.data.message || '收到回复',
        timestamp: new Date().toLocaleTimeString(),
        provider: 'AI',
        responseTime,
        error: !response.data.success
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      if (!response.data.success) {
        message.error(`AI响应错误: ${response.data.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorResponseMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `连接失败: ${errorMessage}`,
        timestamp: new Date().toLocaleTimeString(),
        provider: 'AI',
        error: true
      };

      setChatMessages(prev => [...prev, errorResponseMessage]);
      message.error('发送失败: ' + errorMessage);
    } finally {
      setChatLoading(false);
    }
  };

  // 清空聊天记录
  const handleClearChat = () => {
    setChatMessages([]);
  };

  // 清空配置
  const handleClearConfig = async () => {
    try {
      form.resetFields();
      setConfig(null);
      setConnectionStatus(null);
      
      await api.delete('/config/', {
        params: { key: 'main_ai_config' }
      });
      
      message.success('配置已清空');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('清空失败：' + errorMessage);
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

  return (
    <div>
      <Row gutter={16}>
        {/* 左侧：AI配置表单 */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <ApiOutlined />
                <span>AI配置</span>
              </Space>
            }
            size="small"
            extra={
              <Space>
                {getConnectionStatus().icon}
                <Text type={connectionStatus === 'success' ? 'success' : connectionStatus === 'error' ? 'danger' : 'warning'}>
                  {getConnectionStatus().message}
                </Text>
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
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={DEFAULT_CONFIG}
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
                  <Button type="primary" htmlType="submit" loading={loading}>
                    保存并测试
                  </Button>
                  <Button onClick={() => testConnection()} loading={testing} disabled={!config}>
                    <ReloadOutlined />
                    测试连接
                  </Button>
                  <Button onClick={handleClearConfig} disabled={!config}>
                    清空配置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右侧：AI聊天测试 */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <MessageOutlined />
                <span>AI聊天测试</span>
              </Space>
            }
            extra={
              <Button size="small" onClick={handleClearChat}>
                清空
              </Button>
            }
          >
            <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
              {/* 聊天消息显示区域 */}
              <div 
                style={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  border: '1px solid #f0f0f0', 
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '12px',
                  backgroundColor: '#fafafa'
                }}
              >
                {chatMessages.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#999', 
                    marginTop: '50px',
                    fontSize: '14px'
                  }}>
                    <RobotOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                    <div>选择AI提供商开始对话测试</div>
                  </div>
                ) : (
                  <List
                    dataSource={chatMessages}
                    renderItem={(message) => (
                      <List.Item style={{ padding: '8px 0', border: 'none' }}>
                        <div style={{ width: '100%' }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start',
                            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                          }}>
                            {message.type === 'assistant' && (
                              <Avatar 
                                size="small" 
                                icon={<RobotOutlined />}
                                style={{ 
                                  backgroundColor: message.error ? '#ff4d4f' : '#1890ff',
                                  marginRight: '8px'
                                }}
                              />
                            )}
                            <div style={{ 
                              maxWidth: '80%',
                              backgroundColor: message.type === 'user' ? '#1890ff' : 
                                             message.error ? '#fff2f0' : '#f6f6f6',
                              color: message.type === 'user' ? 'white' : 
                                     message.error ? '#ff4d4f' : '#333',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '14px',
                              border: message.error ? '1px solid #ffccc7' : 'none'
                            }}>
                              <div>{message.content}</div>
                              <div style={{ 
                                fontSize: '12px', 
                                opacity: 0.7, 
                                marginTop: '4px',
                                textAlign: 'right'
                              }}>
                                {message.timestamp}
                                {message.responseTime && ` · ${message.responseTime}ms`}
                                {message.provider && ` · ${message.provider}`}
                              </div>
                            </div>
                            {message.type === 'user' && (
                              <Avatar 
                                size="small" 
                                icon={<UserOutlined />}
                                style={{ 
                                  backgroundColor: '#52c41a',
                                  marginLeft: '8px'
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </div>

              {/* 输入区域 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <TextArea
                  placeholder="输入消息测试AI响应..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  disabled={!config?.api_key || chatLoading}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={chatLoading}
                  disabled={!config?.api_key || !chatInput.trim()}
                >
                  发送
                </Button>
              </div>

              {!config?.api_key && (
                <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
                  请先配置API密钥后再使用聊天测试
                </Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AIConfigPanel;