import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Table,
  Space,
  message,
  Spin,
  Tag,
  Popconfirm,
  InputNumber,
  Switch,
  Tooltip,
  Row,
  Col,
  Typography,
  Avatar,
  List
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeInvisibleOutlined,
  SendOutlined,
  MessageOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

interface AIProvider {
  id?: number;
  provider: string;
  api_key: string;
  api_url?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  is_active?: boolean;
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
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  
  // 聊天功能状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatProvider, setSelectedChatProvider] = useState<string>('');

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/ai/providers');
      setProviders(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('获取AI提供商配置失败：' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: AIProvider) => {
    try {
      if (editingProvider) {
        // 更新现有配置
        await api.put(`/config/${editingProvider.id}`, {
          value: JSON.stringify(values),
          is_active: values.is_active
        });
        message.success('AI配置更新成功');
      } else {
        // 创建新配置
        await api.post('/config/ai/providers', values);
        message.success('AI配置创建成功');
      }
      form.resetFields();
      setEditingProvider(null);
      fetchProviders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('操作失败：' + errorMessage);
    }
  };

  const handleTest = async (provider: AIProvider) => {
    setTestingProvider(provider.provider);
    try {
      const response = await api.post('/config/ai/test', {
        provider: provider.provider,
        api_key: provider.api_key,
        api_url: provider.api_url,
        test_prompt: '你好，请回复"API连接成功"'
      });
      
      if (response.data.success) {
        message.success(`${provider.provider} API连接测试成功`);
      } else {
        message.error(`测试失败：${response.data.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('测试失败：' + errorMessage);
    } finally {
      setTestingProvider(null);
    }
  };

  // 处理发送聊天消息
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedChatProvider) {
      message.warning('请输入消息并选择AI提供商');
      return;
    }

    const selectedProvider = (providers || []).find(p => p.provider === selectedChatProvider);
    if (!selectedProvider) {
      message.error('请先配置并启用AI提供商');
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
        provider: selectedProvider.provider,
        api_key: selectedProvider.api_key,
        api_url: selectedProvider.api_url,
        test_prompt: chatInput
      });

      const responseTime = Date.now() - startTime;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.data.response_content || response.data.message || '收到回复',
        timestamp: new Date().toLocaleTimeString(),
        provider: selectedProvider.provider,
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
        provider: selectedProvider.provider,
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

  const handleDelete = async (provider: AIProvider) => {
    try {
      // 这里需要先获取配置的ID
      const configsResponse = await api.get('/config/', {
        params: { category: 'ai_api' }
      });
      const config = configsResponse.data.find((c: SystemConfig) => 
        c.key === `ai_provider_${provider.provider}`
      );
      
      if (config) {
        await api.delete(`/config/${config.id}`);
        message.success('删除成功');
        fetchProviders();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error('删除失败：' + errorMessage);
    }
  };

  const columns = [
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (text: string) => (
        <Space>
          <ApiOutlined />
          <span style={{ fontWeight: 'bold' }}>{text}</span>
        </Space>
      )
    },
    {
      title: 'API密钥',
      dataIndex: 'api_key',
      key: 'api_key',
      render: (text: string) => (
        <Space>
          <EyeInvisibleOutlined />
          <span style={{ fontFamily: 'monospace' }}>{text}</span>
        </Space>
      )
    },
    {
      title: 'API地址',
      dataIndex: 'api_url',
      key: 'api_url',
      render: (text: string) => text || '默认'
    },
    {
      title: '默认模型',
      dataIndex: 'model',
      key: 'model',
      render: (text: string) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        active ? 
          <Tag color="success" icon={<CheckCircleOutlined />}>启用</Tag> :
          <Tag color="default" icon={<CloseCircleOutlined />}>禁用</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AIProvider) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              type="link"
              icon={<ReloadOutlined spin={testingProvider === record.provider} />}
              onClick={() => handleTest(record)}
              loading={testingProvider === record.provider}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingProvider(record);
                form.setFieldsValue(record);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个配置吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Row gutter={16}>
        {/* 左侧：AI配置表单 */}
        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <ApiOutlined />
                <span>{editingProvider ? '编辑AI配置' : '添加AI配置'}</span>
              </Space>
            }
            size="small"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                is_active: true,
                temperature: 0.7,
                max_tokens: 2000
              }}
            >
              <Form.Item
                name="provider"
                label="提供商"
                rules={[{ required: true, message: '请选择提供商' }]}
              >
                <Select placeholder="选择AI提供商" disabled={!!editingProvider}>
                  <Option value="openai">OpenAI</Option>
                  <Option value="anthropic">Anthropic</Option>
                  <Option value="deepseek">DeepSeek</Option>
                  <Option value="qwen">通义千问</Option>
                  <Option value="custom">自定义</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="api_key"
                label="API密钥"
                rules={[{ required: true, message: '请输入API密钥' }]}
              >
                <Input.Password 
                  placeholder="输入API密钥" 
                  autoComplete="off"
                />
              </Form.Item>

              <Form.Item
                name="api_url"
                label="API地址（可选）"
                tooltip="留空使用默认地址"
              >
                <Input placeholder="https://api.example.com/v1" />
              </Form.Item>

              <Form.Item
                name="model"
                label="默认模型（可选）"
              >
                <Input placeholder="例如：gpt-4, claude-3-opus" />
              </Form.Item>

              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    name="max_tokens"
                    label="最大Token"
                  >
                    <InputNumber
                      min={100}
                      max={32000}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="temperature"
                    label="温度参数"
                  >
                    <InputNumber
                      min={0}
                      max={2}
                      step={0.1}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="is_active"
                label="启用状态"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%' }}>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    {editingProvider ? '更新' : '创建'}
                  </Button>
                  {editingProvider && (
                    <Button onClick={() => {
                      setEditingProvider(null);
                      form.resetFields();
                    }}>
                      取消编辑
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 中间：当前配置列表 */}
        <Col xs={24} md={8}>
          <Card
            title="当前配置"
            size="small"
          >
            <Spin spinning={loading}>
              <Table
                dataSource={providers}
                columns={columns}
                rowKey="provider"
                pagination={false}
                size="small"
                scroll={{ y: 400 }}
              />
            </Spin>
          </Card>
        </Col>

        {/* 右侧：AI聊天测试 */}
        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <MessageOutlined />
                <span>AI聊天测试</span>
              </Space>
            }
            extra={
              <Space>
                <Select
                  placeholder="选择AI提供商"
                  value={selectedChatProvider}
                  onChange={setSelectedChatProvider}
                  style={{ width: 120 }}
                  size="small"
                >
                  {(providers || []).filter(p => p.is_active).map(provider => (
                    <Option key={provider.provider} value={provider.provider}>
                      {provider.provider}
                    </Option>
                  ))}
                </Select>
                <Button size="small" onClick={handleClearChat}>
                  清空
                </Button>
              </Space>
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
                  disabled={!selectedChatProvider || chatLoading}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={chatLoading}
                  disabled={!selectedChatProvider || !chatInput.trim()}
                >
                  发送
                </Button>
              </div>

              {!selectedChatProvider && (providers || []).filter(p => p.is_active).length === 0 && (
                <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
                  请先配置并启用至少一个AI提供商
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