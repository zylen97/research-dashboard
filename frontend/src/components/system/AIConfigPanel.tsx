import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Table,
  Space,
  Modal,
  message,
  Spin,
  Tag,
  Popconfirm,
  InputNumber,
  Switch,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;

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

const AIConfigPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/ai/providers');
      setProviders(response.data);
    } catch (error: any) {
      message.error('获取AI提供商配置失败：' + (error.response?.data?.detail || error.message));
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
      setModalVisible(false);
      form.resetFields();
      setEditingProvider(null);
      fetchProviders();
    } catch (error: any) {
      message.error('操作失败：' + (error.response?.data?.detail || error.message));
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
    } catch (error: any) {
      message.error('测试失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setTestingProvider(null);
    }
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
    } catch (error: any) {
      message.error('删除失败：' + (error.response?.data?.detail || error.message));
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
      render: (_: any, record: AIProvider) => (
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
                setModalVisible(true);
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
      <Card
        title="AI模型配置"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingProvider(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            添加配置
          </Button>
        }
      >
        <Spin spinning={loading}>
          <Table
            dataSource={providers}
            columns={columns}
            rowKey="provider"
            pagination={false}
          />
        </Spin>
      </Card>

      <Modal
        title={editingProvider ? '编辑AI配置' : '添加AI配置'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingProvider(null);
        }}
        footer={null}
        width={600}
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

          <Form.Item
            name="max_tokens"
            label="最大Token数"
          >
            <InputNumber
              min={100}
              max={32000}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="temperature"
            label="温度参数"
            tooltip="控制输出的随机性，0-2之间"
          >
            <InputNumber
              min={0}
              max={2}
              step={0.1}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingProvider(null);
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingProvider ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIConfigPanel;