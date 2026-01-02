/**
 * 批量分析Tab组件（重构版 - API配置内联）
 * 功能：API配置、提示词管理、文献选择、批量分析
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Select,
  Space,
  Tag,
  Typography,
  Divider,
  Checkbox,
  Form,
  Input,
  InputNumber,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import {
  paperApi,
  promptApi,
  journalApi,
  aiConfigApi,
} from '../services/apiOptimized';
import {
  PromptTemplate,
  PromptTemplateCreate,
  Paper,
  PaperStatus,
} from '../types/papers';
import { Journal } from '../types/journals';
import { AIConfig } from '../types/ai';
import PromptTemplateModal from './PromptTemplateModal';

const { Text, Paragraph } = Typography;

interface BatchAnalysisTabProps {
  // 不再需要 initialUserConfig
}

const BatchAnalysisTab: React.FC<BatchAnalysisTabProps> = () => {
  const queryClient = useQueryClient();
  const [aiConfigForm] = Form.useForm();

  // 状态管理
  const [isPromptModalVisible, setIsPromptModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  const [selectedJournals, setSelectedJournals] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<PaperStatus>('pending');
  const [testing, setTesting] = useState(false);

  // 查询提示词模板
  const { data: templatesResponse, refetch: refetchTemplates } = useQuery({
    queryKey: ['prompt-templates'],
    queryFn: () => promptApi.getTemplates(),
  });

  const templates = templatesResponse?.data || [];

  // 查询AI配置
  const { data: aiConfig, refetch: refetchAIConfig } = useQuery<AIConfig>({
    queryKey: ['ai-config'],
    queryFn: () => aiConfigApi.getConfig(),
  });

  // 查询期刊列表
  const { data: journals = [] } = useQuery<Journal[]>({
    queryKey: ['journals'],
    queryFn: () => journalApi.getJournals(),
  });

  // 查询论文列表（用于选择）
  const { data: papersResponse, refetch: refetchPapers } = useQuery<{
    items: Paper[];
    total: number;
  }>({
    queryKey: ['papers', statusFilter],
    queryFn: () => paperApi.getPapers({ status: statusFilter, limit: 1000 }),
  });

  const allPapers = papersResponse?.items || [];

  // 根据期刊筛选论文
  const filteredPapers = useMemo(() => {
    if (selectedJournals.length === 0) return allPapers;
    return allPapers.filter(p => p.journal_id && selectedJournals.includes(p.journal_id));
  }, [allPapers, selectedJournals]);

  // 获取选中期刊的待分析论文数
  const getJournalPendingCount = (journalId: number) => {
    return allPapers.filter(
      p => p.journal_id === journalId && p.status === 'pending'
    ).length;
  };

  // 删除提示词模板
  const deletePromptMutation = useMutation({
    mutationFn: (name: string) => promptApi.deleteTemplate(name),
    onSuccess: () => {
      refetchTemplates();
    },
    onError: (error: any) => {
      console.error('删除模板失败:', error);
    },
  });

  // 设置默认模板
  const setDefaultPromptMutation = useMutation({
    mutationFn: (name: string) =>
      promptApi.updateTemplate(name, { is_default: true }),
    onSuccess: () => {
      refetchTemplates();
    },
  });

  // 更新AI配置
  const updateAIConfigMutation = useMutation({
    mutationFn: (config: Partial<AIConfig>) => aiConfigApi.updateConfig(config),
    onSuccess: () => {
      message.success('AI配置保存成功');
      refetchAIConfig();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '保存失败');
    },
  });

  // 批量分析（不再传递 user_profile 和 research_fields）
  const analyzeMutation = useMutation({
    mutationFn: (data: {
      paperIds: number[];
      templateName?: string;
    }) =>
      paperApi.batchAnalyzeWithPrompt(
        data.paperIds,
        data.templateName,
        undefined, // 不再传递 variables
        3
      ),
    onSuccess: () => {
      refetchPapers();
      queryClient.invalidateQueries({ queryKey: ['papers-stats'] });
    },
    onError: (error: any) => {
      console.error('批量分析失败:', error);
    },
  });

  // 处理删除提示词
  const handleDeletePrompt = (name: string) => {
    deletePromptMutation.mutate(name);
  };

  // 处理执行批量分析
  const handleRunAnalysis = () => {
    if (filteredPapers.length === 0) {
      return;
    }

    const paperIds = filteredPapers.map(p => p.id);
    const mutationData: { paperIds: number[]; templateName?: string } = { paperIds };
    if (selectedTemplate) mutationData.templateName = selectedTemplate;

    analyzeMutation.mutate(mutationData);
  };

  // 处理保存AI配置
  const handleSaveAIConfig = async () => {
    try {
      const values = await aiConfigForm.validateFields();
      updateAIConfigMutation.mutate(values);
    } catch (error) {
      // 表单验证失败
    }
  };

  // 处理测试AI连接
  const handleTestAIConnection = async () => {
    try {
      const values = await aiConfigForm.validateFields();
      setTesting(true);

      const testData = {
        provider: values.provider,
        api_key: values.api_key,
        model: values.model,
        base_url: values.base_url,
        temperature: values.temperature || 0.7,
        max_tokens: values.max_tokens || 500,
      };

      const result = await aiConfigApi.testConnection(testData);

      if (result.success) {
        message.success(`连接测试成功 (${result.response_time_ms}ms)`);
      } else {
        message.error(`连接测试失败: ${result.message}`);
      }
    } catch (error: any) {
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail);
      } else if (error.message) {
        message.error(`测试失败: ${error.message}`);
      } else {
        message.error('测试失败，请检查配置');
      }
    } finally {
      setTesting(false);
    }
  };

  // 处理Provider变化，自动填充默认值
  const handleAIProviderChange = (provider: string) => {
    if (provider === 'openai') {
      aiConfigForm.setFieldsValue({
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
      });
    } else if (provider === 'chatanywhere') {
      aiConfigForm.setFieldsValue({
        base_url: 'https://api.chatanywhere.tech/v1',
        model: 'gpt-3.5-turbo',
      });
    }
  };

  // 当配置加载完成后填充表单
  useEffect(() => {
    if (aiConfig) {
      aiConfigForm.setFieldsValue({
        provider: aiConfig.provider,
        model: aiConfig.model,
        base_url: aiConfig.base_url,
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.max_tokens,
      });
      // API密钥不回填，如果已有密钥则显示占位符
      if (aiConfig.has_api_key) {
        aiConfigForm.setFieldsValue({
          api_key: '******', // 占位符
        });
      }
    }
  }, [aiConfig, aiConfigForm]);

  // 提示词模板列配置
  const promptColumns: ColumnsType<PromptTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          {name}
          {record.is_default && <Tag>默认</Tag>}
        </Space>
      ),
    },
    {
      title: '变量',
      dataIndex: 'variables',
      key: 'variables',
      render: (variables: string[]) => (
        <Space wrap>
          {variables?.map(v => (
            <Tag key={v}>{`{${v}}`}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: PromptTemplate) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPrompt(record);
              setIsPromptModalVisible(true);
            }}
          >
            编辑
          </Button>
          {!record.is_default && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => setDefaultPromptMutation.mutate(record.name)}
            >
              设默认
            </Button>
          )}
          {!record.is_default && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeletePrompt(record.name)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 期刊选择列配置
  const journalColumns: ColumnsType<Journal & { pending_count: number }> = [
    {
      title: '',
      dataIndex: 'selected',
      key: 'selected',
      width: 50,
      render: (_: unknown, record: Journal & { pending_count: number }) => (
        <Checkbox
          checked={selectedJournals.includes(record.id)}
          disabled={record.pending_count === 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedJournals([...selectedJournals, record.id]);
            } else {
              setSelectedJournals(selectedJournals.filter(id => id !== record.id));
            }
          }}
        />
      ),
    },
    {
      title: '期刊名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '待分析论文',
      dataIndex: 'pending_count',
      key: 'pending_count',
      width: 100,
      render: (count: number) => <Tag>{count}</Tag>,
    },
  ];

  // 期刊数据（添加待分析计数）
  const journalsWithCount = useMemo(() => {
    return journals.map(j => ({
      ...j,
      pending_count: getJournalPendingCount(j.id),
    }));
  }, [journals, allPapers]);

  return (
    <div>
      <Row gutter={16}>
        {/* 左侧栏：提示词模板管理 + API配置 */}
        <Col span={12}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 提示词模板卡片 */}
            <Card
              title={
                <Space>
                  <Text strong>提示词模板</Text>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                    ({templates.length})
                  </Text>
                </Space>
              }
            >
              <Table
                columns={promptColumns}
                dataSource={templates}
                rowKey="name"
                size="small"
                pagination={false}
                scroll={{ y: 250 }}
              />
              <Divider style={{ margin: '12px 0' }} />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingPrompt(null);
                  setIsPromptModalVisible(true);
                }}
                block
              >
                新建模板
              </Button>
            </Card>

            {/* API配置卡片 */}
            <Card
              title={
                <Space>
                  <ThunderboltOutlined />
                  <Text strong>API配置</Text>
                </Space>
              }
              bodyStyle={{ padding: '16px' }}
            >
              <Form form={aiConfigForm} layout="vertical">
                <Form.Item
                  label="提供商"
                  name="provider"
                  rules={[{ required: true, message: '请选择提供商' }]}
                >
                  <Select
                    placeholder="选择API提供商"
                    onChange={handleAIProviderChange}
                  >
                    <Select.Option value="openai">OpenAI</Select.Option>
                    <Select.Option value="chatanywhere">ChatAnywhere</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API密钥"
                  name="api_key"
                  rules={[{ required: true, message: '请输入API密钥' }]}
                >
                  <Input.Password placeholder="sk-..." autoComplete="off" />
                </Form.Item>

                <Form.Item
                  label="Base URL"
                  name="base_url"
                  rules={[{ required: true, message: '请输入Base URL' }]}
                >
                  <Input placeholder="https://api.openai.com/v1" autoComplete="off" />
                </Form.Item>

                <Form.Item
                  label="模型"
                  name="model"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                >
                  <Input placeholder="gpt-3.5-turbo" autoComplete="off" />
                </Form.Item>

                <Form.Item label="温度" name="temperature">
                  <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} placeholder="0.7" />
                </Form.Item>

                <Form.Item label="最大Token" name="max_tokens">
                  <InputNumber min={1} max={100000} step={100} style={{ width: '100%' }} placeholder="2000" />
                </Form.Item>

                <Space>
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={handleTestAIConnection}
                    loading={testing}
                  >
                    测试连接
                  </Button>
                  <Button
                    type="primary"
                    onClick={handleSaveAIConfig}
                    loading={updateAIConfigMutation.isPending}
                  >
                    保存配置
                  </Button>
                </Space>
              </Form>
            </Card>
          </Space>
        </Col>

        {/* 右侧栏：文献选择和执行 */}
        <Col span={12}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 提示词选择 */}
            <Card title={<Text strong>选择提示词模板</Text>} size="small">
              <Select
                placeholder="选择提示词模板，不选则使用默认配置"
                allowClear
                value={selectedTemplate}
                onChange={setSelectedTemplate}
                style={{ width: '100%' }}
                options={templates.map(t => ({
                  label: (
                    <Space>
                      {t.name}
                      {t.is_default && <Tag>默认</Tag>}
                    </Space>
                  ),
                  value: t.name,
                }))}
              />
              {selectedTemplate && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Paragraph
                      ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                      style={{ marginBottom: 0, fontSize: 12 }}
                    >
                      {templates.find(t => t.name === selectedTemplate)?.content}
                    </Paragraph>
                  </Card>
                </>
              )}
            </Card>

            {/* 文献选择 */}
            <Card
              title={
                <Space>
                  <Text strong>选择文献</Text>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                    ({filteredPapers.length} 篇)
                  </Text>
                </Space>
              }
              size="small"
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span>筛选状态：</span>
                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 120 }}
                  >
                    <Select.Option value="pending">待分析</Select.Option>
                    <Select.Option value="analyzed">已分析</Select.Option>
                  </Select>
                  <Button
                    size="small"
                    onClick={() => setSelectedJournals(journalsWithCount.map(j => j.id))}
                  >
                    全选
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedJournals([])}
                  >
                    清空
                  </Button>
                </Space>
                <Table
                  columns={journalColumns}
                  dataSource={journalsWithCount}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ y: 180 }}
                />
              </Space>
            </Card>

            {/* 执行分析 */}
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>已选择 {filteredPapers.length} 篇论文</Text>
                  {selectedJournals.length > 0 && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <Row gutter={8}>
                        {journalsWithCount
                          .filter(j => selectedJournals.includes(j.id))
                          .map(j => (
                            <Col key={j.id} span={12}>
                              <Tag style={{ marginBottom: 4 }}>
                                {j.name} ({getJournalPendingCount(j.id)})
                              </Tag>
                            </Col>
                          ))}
                      </Row>
                    </>
                  )}
                </div>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={handleRunAnalysis}
                  loading={analyzeMutation.isPending}
                  disabled={filteredPapers.length === 0}
                  block
                >
                  开始批量分析
                </Button>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* 提示词模板编辑弹窗 */}
      <PromptTemplateModal
        visible={isPromptModalVisible}
        onClose={() => {
          setIsPromptModalVisible(false);
          setEditingPrompt(null);
        }}
        onSave={(template) => {
          if (editingPrompt) {
            const updateData: { content?: string; is_default?: boolean } = {};
            if (template.content !== undefined) updateData.content = template.content;
            if (template.is_default !== undefined) updateData.is_default = template.is_default;

            promptApi.updateTemplate(editingPrompt.name, updateData)
              .then(() => {
                refetchTemplates();
                setIsPromptModalVisible(false);
                setEditingPrompt(null);
              })
              .catch((error) => {
                console.error('更新模板失败:', error);
              });
          } else {
            const createData: PromptTemplateCreate = {
              name: (template as any).name || '',
              content: template.content || '',
              is_default: template.is_default || false,
            };
            promptApi.createTemplate(createData)
              .then(() => {
                refetchTemplates();
                setIsPromptModalVisible(false);
                setEditingPrompt(null);
              })
              .catch((error) => {
                console.error('创建模板失败:', error);
              });
          }
        }}
        template={editingPrompt}
      />
    </div>
  );
};

export default BatchAnalysisTab;
