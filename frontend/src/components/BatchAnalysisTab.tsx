/**
 * 批量分析Tab组件
 * 集成AI配置、提示词管理、文献选择功能
 */
import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Input,
  Form,
  Select,
  Modal,
  message,
  Space,
  Tag,
  Typography,
  Divider,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  PlayCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import {
  paperApi,
  promptApi,
  userConfigApi,
  journalApi,
} from '../services/apiOptimized';
import {
  PromptTemplate,
  PromptTemplateCreate,
  UserConfig,
  Paper,
  PaperStatus,
} from '../types/papers';
import { Journal } from '../types/journals';
import PromptTemplateModal from './PromptTemplateModal';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface BatchAnalysisTabProps {
  initialUserConfig?: UserConfig;
}

const BatchAnalysisTab: React.FC<BatchAnalysisTabProps> = ({
  initialUserConfig,
}) => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  // 状态管理
  const [isPromptModalVisible, setIsPromptModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  const [selectedJournals, setSelectedJournals] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<PaperStatus>('pending');

  // 查询提示词模板
  const { data: templatesResponse, refetch: refetchTemplates } = useQuery({
    queryKey: ['prompt-templates'],
    queryFn: () => promptApi.getTemplates(),
  });

  const templates = templatesResponse?.data || [];

  // 查询用户配置
  const { data: userConfigResponse, refetch: refetchUserConfig } = useQuery({
    queryKey: ['user-config'],
    queryFn: () => userConfigApi.getConfig(),
    initialData: initialUserConfig ? { data: initialUserConfig } : undefined,
  });

  const userConfig = userConfigResponse?.data;

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

  // 保存用户配置
  const saveUserConfigMutation = useMutation({
    mutationFn: (config: UserConfig) => userConfigApi.updateConfig(config),
    onSuccess: () => {
      message.success('用户配置保存成功');
      refetchUserConfig();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '保存失败');
    },
  });

  // 删除提示词模板
  const deletePromptMutation = useMutation({
    mutationFn: (name: string) => promptApi.deleteTemplate(name),
    onSuccess: () => {
      message.success('提示词模板删除成功');
      refetchTemplates();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  // 设置默认模板
  const setDefaultPromptMutation = useMutation({
    mutationFn: (name: string) =>
      promptApi.updateTemplate(name, { is_default: true }),
    onSuccess: () => {
      message.success('默认模板设置成功');
      refetchTemplates();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '设置失败');
    },
  });

  // 批量分析
  const analyzeMutation = useMutation({
    mutationFn: (data: {
      paperIds: number[];
      templateName?: string;
      variables?: { user_profile?: string; research_fields?: string[] };
    }) =>
      paperApi.batchAnalyzeWithPrompt(
        data.paperIds,
        data.templateName,
        data.variables,
        3
      ),
    onSuccess: (response: any) => {
      // 响应结构: { success: true, message: "...", data: { total, success, ... } }
      const result = response?.data || response;
      const successCount = result?.success || 0;
      const totalCount = result?.total || 0;
      message.success(`分析完成：${successCount}/${totalCount} 篇成功`);
      refetchPapers();
      queryClient.invalidateQueries({ queryKey: ['papers-stats'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '分析失败');
    },
  });

  // 处理保存用户配置
  const handleSaveUserConfig = () => {
    const values = form.getFieldsValue();
    saveUserConfigMutation.mutate({
      user_profile: values.user_profile || '',
      research_fields: values.research_fields || [],
    });
  };

  // 处理删除提示词
  const handleDeletePrompt = (name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除提示词模板 "${name}" 吗？`,
      onOk: () => deletePromptMutation.mutate(name),
    });
  };

  // 处理执行批量分析
  const handleRunAnalysis = () => {
    if (filteredPapers.length === 0) {
      message.warning('请先选择要分析的论文');
      return;
    }

    const paperIds = filteredPapers.map(p => p.id);
    const variables: { user_profile?: string; research_fields?: string[] } = {};

    if (userConfig) {
      variables.user_profile = userConfig.user_profile;
      variables.research_fields = userConfig.research_fields;
    }

    const mutationData: { paperIds: number[]; templateName?: string; variables?: { user_profile?: string; research_fields?: string[] } } = { paperIds };
    if (selectedTemplate) mutationData.templateName = selectedTemplate;
    if (Object.keys(variables).length > 0) mutationData.variables = variables;

    analyzeMutation.mutate(mutationData);
  };

  // 提示词模板列配置
  const promptColumns: ColumnsType<PromptTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          {name}
          {record.is_default && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '变量',
      dataIndex: 'variables',
      key: 'variables',
      render: (variables: string[]) => (
        <Space wrap>
          {variables.map(v => (
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
      render: (count: number) => <Tag color="orange">{count}</Tag>,
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
        {/* 左侧栏：配置和提示词管理 */}
        <Col span={12}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 全局用户配置 */}
            <Card
              title={<Text strong>全局用户配置</Text>}
              extra={<SettingOutlined />}
            >
              <Form
                form={form}
                layout="vertical"
                initialValues={userConfig || { user_profile: '', research_fields: [] }}
              >
                <Form.Item
                  label="研究领域"
                  name="research_fields"
                  tooltip="你关注的研究领域，用于AI分析时的上下文"
                >
                  <Select
                    mode="tags"
                    placeholder="输入研究领域，按回车添加"
                    options={[
                      { label: '人工智能', value: '人工智能' },
                      { label: '机器学习', value: '机器学习' },
                      { label: '数据挖掘', value: '数据挖掘' },
                      { label: '自然语言处理', value: '自然语言处理' },
                      { label: '计算机视觉', value: '计算机视觉' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="研究背景"
                  name="user_profile"
                  tooltip="描述你的研究背景，帮助AI更好地理解你的需求"
                >
                  <TextArea
                    rows={3}
                    placeholder="例如：我是一个研究人员，主要关注..."
                  />
                </Form.Item>
                <Button
                  type="primary"
                  onClick={handleSaveUserConfig}
                  loading={saveUserConfigMutation.isPending}
                  block
                >
                  保存配置
                </Button>
              </Form>
            </Card>

            {/* 提示词模板管理 */}
            <Card
              title={
                <Space>
                  <Text strong>提示词模板</Text>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                    ({templates.length})
                  </Text>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingPrompt(null);
                    setIsPromptModalVisible(true);
                  }}
                >
                  新建模板
                </Button>
              }
            >
              <Table
                columns={promptColumns}
                dataSource={templates}
                rowKey="name"
                size="small"
                pagination={false}
                scroll={{ y: 200 }}
              />
            </Card>
          </Space>
        </Col>

        {/* 右侧栏：文献选择和执行 */}
        <Col span={12}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 提示词选择 */}
            <Card title={<Text strong>选择提示词模板</Text>}>
              <Form layout="vertical">
                <Form.Item label="使用模板（可选）">
                  <Select
                    placeholder="选择提示词模板，不选则使用默认配置"
                    allowClear
                    value={selectedTemplate}
                    onChange={setSelectedTemplate}
                    options={templates.map(t => ({
                      label: (
                        <Space>
                          {t.name}
                          {t.is_default && <Tag color="blue">默认</Tag>}
                        </Space>
                      ),
                      value: t.name,
                    }))}
                  />
                </Form.Item>
                {selectedTemplate && (
                  <Form.Item label="模板预览">
                    <Card size="small">
                      <Paragraph
                        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                        style={{ marginBottom: 0, fontSize: 12 }}
                      >
                        {templates.find(t => t.name === selectedTemplate)?.content}
                      </Paragraph>
                    </Card>
                  </Form.Item>
                )}
              </Form>
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
                  scroll={{ y: 200 }}
                />
              </Space>
            </Card>

            {/* 执行分析 */}
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>已选择 {filteredPapers.length} 篇论文</Text>
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
            // 更新现有模板 - 只传递有值的字段
            const updateData: { content?: string; is_default?: boolean } = {};
            if (template.content !== undefined) updateData.content = template.content;
            if (template.is_default !== undefined) updateData.is_default = template.is_default;

            promptApi.updateTemplate(editingPrompt.name, updateData)
              .then(() => {
                message.success('模板更新成功');
                refetchTemplates();
                setIsPromptModalVisible(false);
                setEditingPrompt(null);
              })
              .catch((error) => {
                message.error(error.response?.data?.detail || '操作失败');
              });
          } else {
            // 创建新模板 - 需要提供 name
            const createData: PromptTemplateCreate = {
              name: (template as any).name || '',
              content: template.content || '',
              is_default: template.is_default || false,
            };
            promptApi.createTemplate(createData)
              .then(() => {
                message.success('模板创建成功');
                refetchTemplates();
                setIsPromptModalVisible(false);
                setEditingPrompt(null);
              })
              .catch((error) => {
                message.error(error.response?.data?.detail || '操作失败');
              });
          }
        }}
        template={editingPrompt}
      />
    </div>
  );
};

export default BatchAnalysisTab;
