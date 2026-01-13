import React, { useState, useMemo } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Space,
  Drawer,
  Descriptions,
  Tag,
  List,
  Divider,
  message,
  Popconfirm,
  Card,
  Statistic,
  Row,
  Col,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BarChartOutlined,
  SearchOutlined,
  FileTextOutlined,
  BookOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi, tagApi } from '../services/apiOptimized';
import axios from 'axios';
import EnhancedTagSelect from '../components/EnhancedTagSelect';
import {
  Journal,
  JournalCreate,
  JournalUpdate,
  JournalStats,
  JournalReferences,
  Tag as JournalTag,
} from '../types/journals';
import { TagManagementPanel } from '../components/TagManagementPanel';
import { GRAYSCALE_SYSTEM } from '../config/colors';
import { PageContainer, PageHeader, FilterSection, TableContainer } from '../styles/components';
import ValidationPromptModal from '../components/ValidationPromptModal';

const { Title, Text } = Typography;
const { TextArea } = Input;

const JournalsManagement: React.FC = () => {
  const queryClient = useQueryClient();

  // Tab状态
  const [activeTab, setActiveTab] = useState<string>('chinese');

  // 判断期刊名称是否包含中文字符
  const isChineseJournal = (name: string): boolean => {
    return /[\u4e00-\u9fff]/.test(name);
  };

  // 状态管理
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isStatsDrawerVisible, setIsStatsDrawerVisible] = useState(false);
  const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<number | null>(null);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 期卷号相关状态
  const [isIssuesDrawerVisible, setIsIssuesDrawerVisible] = useState(false);
  const [selectedJournalForIssues, setSelectedJournalForIssues] = useState<Journal | null>(null);
  const [journalIssues, setJournalIssues] = useState<any[]>([]);
  const [isIssuesLoading, setIsIssuesLoading] = useState(false);
  const [isIssuesModalVisible, setIsIssuesModalVisible] = useState(false);
  const [editingIssue, setEditingIssue] = useState<any>(null);
  const [issueFormData, setIssueFormData] = useState({
    volume: '',
    issue: '',
    year: new Date().getFullYear(),
    notes: ''
  });

  // 筛选状态
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState<string>('');

  // 排序状态
  type SortOption = 'name' | 'total_count' | 'issues_count';
  type SortOrder = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortOption>('name');  // 默认按名称排序
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');  // 默认升序

  const [form] = Form.useForm();

  // 查询标签列表
  const { data: tags = [] } = useQuery<JournalTag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 数据查询
  const {
    data: journals = [],
  } = useQuery({
    queryKey: ['journals', selectedTagIds, searchText],
    queryFn: () => {
      const params: { tag_ids?: string; search?: string } = {};
      if (selectedTagIds.length > 0) params.tag_ids = selectedTagIds.join(',');
      if (searchText) params.search = searchText;
      return journalApi.getJournals(params);
    },
  });

  // 根据Tab过滤期刊并排序
  const filteredJournals = useMemo(() => {
    if (activeTab === 'tags') return [];

    let result = journals.filter(journal => {
      const isChinese = isChineseJournal(journal.name);
      return activeTab === 'chinese' ? isChinese : !isChinese;
    });

    // 排序逻辑
    result = [...result].sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'total_count':
          const aTotal = (a.reference_count || 0) + (a.target_count || 0);
          const bTotal = (b.reference_count || 0) + (b.target_count || 0);
          compareValue = aTotal - bTotal;
          break;
        case 'issues_count':
          const aIssues = a.issues_count || 0;
          const bIssues = b.issues_count || 0;
          compareValue = aIssues - bIssues;
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return result;
  }, [journals, activeTab, sortBy, sortOrder]);

  // 期刊统计查询
  const { data: journalStats } = useQuery<JournalStats>({
    queryKey: ['journal-stats', selectedJournalId],
    queryFn: () => journalApi.getJournalStats(selectedJournalId!),
    enabled: !!selectedJournalId && isStatsDrawerVisible,
  });

  // 期刊引用详情查询
  const { data: journalReferences } = useQuery<JournalReferences>({
    queryKey: ['journal-references', selectedJournalId],
    queryFn: () => journalApi.getJournalReferences(selectedJournalId!),
    enabled: !!selectedJournalId && isStatsDrawerVisible,
  });

  // 创建期刊
  const createMutation = useMutation({
    mutationFn: (data: JournalCreate) => journalApi.create(data),
    onSuccess: () => {
      message.success('期刊创建成功');
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      queryClient.invalidateQueries({ queryKey: ['journal-categories'] });
      setIsModalVisible(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建期刊失败');
    },
  });

  // 更新期刊
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: JournalUpdate }) =>
      journalApi.update(id, data),
    onSuccess: () => {
      message.success('期刊更新成功');
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      setIsModalVisible(false);
      setEditingJournal(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新期刊失败');
    },
  });

  // 删除期刊
  const deleteMutation = useMutation({
    mutationFn: (id: number) => journalApi.delete(id),
    onSuccess: () => {
      message.success('期刊删除成功');
      queryClient.invalidateQueries({ queryKey: ['journals'] });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object' && detail.error) {
        // 显示详细的引用信息
        Modal.error({
          title: detail.error,
          content: (
            <div>
              <p>{detail.reason}</p>
              <p>
                <strong>引用统计：</strong>
              </p>
              <ul>
                <li>参考Ideas: {detail.references?.reference_ideas_count || 0}</li>
                <li>参考Projects: {detail.references?.reference_projects_count || 0}</li>
                <li>拟投稿Ideas: {detail.references?.target_ideas_count || 0}</li>
                <li>拟投稿Projects: {detail.references?.target_projects_count || 0}</li>
              </ul>
              <p>
                <strong>建议：</strong>
                {detail.suggestion}
              </p>
            </div>
          ),
          width: 600,
        });
      } else {
        message.error(detail || '删除期刊失败');
      }
    },
  });

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    const journalData: JournalCreate = {
      name: values.name.trim(),
      notes: values.notes?.trim() || null,
      tag_ids: values.tag_ids || [],
    };

    if (editingJournal) {
      updateMutation.mutate({ id: editingJournal.id, data: journalData });
    } else {
      createMutation.mutate(journalData);
    }
  };

  // 处理编辑
  const handleEdit = (journal: Journal) => {
    setEditingJournal(journal);
    form.setFieldsValue({
      name: journal.name,
      tag_ids: journal.tags.map((t) => t.id),
      notes: journal.notes,
    });
    setIsModalVisible(true);
  };

  // 处理删除
  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // 处理查看统计
  const handleViewStats = (journal: Journal) => {
    setSelectedJournalId(journal.id);
    setIsStatsDrawerVisible(true);
  };

  // 期卷号相关函数
  const fetchJournalIssues = async (journalId: number) => {
    setIsIssuesLoading(true);
    try {
      const response = await axios.get(`/api/journals/${journalId}/issues`);
      setJournalIssues(response.data.data || []);
    } catch (error) {
      message.error('获取期卷号列表失败');
    } finally {
      setIsIssuesLoading(false);
    }
  };

  const handleViewIssues = (journal: Journal) => {
    setSelectedJournalForIssues(journal);
    setIsIssuesDrawerVisible(true);
    fetchJournalIssues(journal.id);
  };

  const handleCreateIssue = () => {
    setEditingIssue(null);
    setIssueFormData({
      volume: '',
      issue: '',
      year: new Date().getFullYear(),
      notes: ''
    });
    setIsIssuesModalVisible(true);
  };

  const handleEditIssue = (issue: any) => {
    setEditingIssue(issue);
    setIssueFormData({
      volume: issue.volume || '',
      issue: issue.issue,
      year: issue.year,
      notes: issue.notes || ''
    });
    setIsIssuesModalVisible(true);
  };

  const handleDeleteIssue = async (issueId: number) => {
    try {
      await axios.delete(`/api/journals/${selectedJournalForIssues?.id}/issues/${issueId}`);
      message.success('删除成功');
      fetchJournalIssues(selectedJournalForIssues!.id);
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmitIssue = async () => {
    // 中文期刊不需要卷号，只检查期号
    if (!issueFormData.issue) {
      message.warning('请输入期号');
      return;
    }

    try {
      if (editingIssue) {
        await axios.put(`/api/journals/${selectedJournalForIssues?.id}/issues/${editingIssue.id}`, null, {
          params: issueFormData
        });
        message.success('更新成功');
      } else {
        await axios.post(`/api/journals/${selectedJournalForIssues?.id}/issues`, null, {
          params: issueFormData
        });
        message.success('创建成功');
      }
      setIsIssuesModalVisible(false);
      fetchJournalIssues(selectedJournalForIssues!.id);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  // 处理模态框确认按钮点击 - 带验证提示
  const handleOkClick = async () => {
    try {
      // 尝试验证表单
      await form.validateFields();
      // 验证通过，提交表单
      form.submit();
    } catch (error: any) {
      // 验证失败，收集错误信息并显示对话框
      const errorFields = error.errorFields || [];
      const missingFields = errorFields.map((e: any) => {
        return `${e.errors[0]}`;
      });
      setValidationErrors(missingFields);
      setIsValidationModalVisible(true);
    }
  };

  return (
    <PageContainer>
      {/* 页面操作栏 */}
      <PageHeader
        actions={
          <Space>
            <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}>
              {journals.length} 个期刊
            </Tag>
            {activeTab !== 'tags' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingJournal(null);
                  form.resetFields();
                  setIsModalVisible(true);
                }}
              >
                新建期刊
              </Button>
            )}
          </Space>
        }
      />

      {/* Tabs：中文期刊、英文期刊、标签管理 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'chinese',
            label: '中文期刊',
            children: (
              <>
                {/* 筛选栏 */}
                <FilterSection
                  filterControls={
                    <Space size="middle">
                      <div>
                        <Text strong style={{ marginRight: 8 }}>
                          标签：
                        </Text>
                        <Select
                          mode="multiple"
                          style={{ width: 200 }}
                          placeholder="选择标签筛选"
                          allowClear
                          value={selectedTagIds}
                          onChange={setSelectedTagIds}
                          maxTagCount={3}
                          options={tags.map((tag) => ({
                            label: tag.name,
                            value: tag.id,
                          }))}
                        />
                      </div>

                      <div>
                        <Text strong style={{ marginRight: 8 }}>
                          搜索：
                        </Text>
                        <Input
                          style={{ width: 250 }}
                          placeholder="搜索期刊名称"
                          prefix={<SearchOutlined />}
                          allowClear
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                        />
                      </div>

                      <div>
                        <Text strong style={{ marginRight: 8 }}>
                          排序：
                        </Text>
                        <Select
                          style={{ width: 120 }}
                          value={sortBy}
                          onChange={(value) => setSortBy(value)}
                          options={[
                            { label: '名称', value: 'name' },
                            { label: '引用总数', value: 'total_count' },
                            { label: '浏览记录', value: 'issues_count' },
                          ]}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          style={{ marginLeft: 4 }}
                        />
                      </div>
                    </Space>
                  }
                />

                {/* 期刊卡片列表 */}
                <TableContainer>
                  <Row gutter={[16, 16]}>
                    {filteredJournals.map((journal) => (
                      <Col xs={24} sm={12} md={8} lg={6} xl={4} key={journal.id}>
                        <Card
                          size="small"
                          style={{
                            border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
                            backgroundColor: GRAYSCALE_SYSTEM.bg_secondary,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
                          hoverable
                        >
                          {/* 期刊名称 */}
                          <div style={{ marginBottom: '8px' }}>
                            <Text
                              strong
                              style={{
                                fontSize: 13,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {journal.name}
                            </Text>
                          </div>

                          {/* 标签 */}
                          <div style={{ marginBottom: '8px', minHeight: '20px' }}>
                            {(!journal.tags || journal.tags.length === 0) ? (
                              <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>未分类</Tag>
                            ) : (
                              journal.tags.slice(0, 2).map((tag) => (
                                <Tag key={tag.id} style={{ margin: '0 4px 4px 0', fontSize: 11 }}>
                                  {tag.name}
                                </Tag>
                              ))
                            )}
                            {journal.tags.length > 2 && (
                              <Tag style={{ margin: '0 4px 4px 0', fontSize: 11 }}>+{journal.tags.length - 2}</Tag>
                            )}
                          </div>

                          {/* 备注（如果有） */}
                          {journal.notes && (
                            <div style={{ marginBottom: '8px', flex: 1 }}>
                              <Text
                                type="secondary"
                                style={{ fontSize: 11 }}
                                ellipsis={{ tooltip: journal.notes }}
                              >
                                {journal.notes}
                              </Text>
                            </div>
                          )}

                          {/* 底部统计和操作 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                            <Space size={8}>
                              <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary }}>
                                参考{journal.reference_count || 0}
                              </Text>
                              <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary }}>
                                研究{journal.target_count || 0}
                              </Text>
                              <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary }}>
                                浏览{journal.issues_count || 0}
                              </Text>
                            </Space>

                            <Space size={4}>
                              <Button
                                type="link"
                                size="small"
                                icon={<BookOutlined />}
                                onClick={() => handleViewIssues(journal)}
                              />
                              <Button
                                type="link"
                                size="small"
                                icon={<BarChartOutlined />}
                                onClick={() => handleViewStats(journal)}
                              />
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(journal)}
                              />
                              <Popconfirm
                                title="确定删除该期刊？"
                                description="如果期刊被引用，将无法删除"
                                onConfirm={() => handleDelete(journal.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button
                                  type="link"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                />
                              </Popconfirm>
                            </Space>
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </TableContainer>

      {/* 创建/编辑期刊模态框 */}
      <Modal
        title={editingJournal ? '编辑期刊' : '新建期刊'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingJournal(null);
          form.resetFields();
        }}
        onOk={handleOkClick}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="期刊名称"
            rules={[
              { required: true, message: '请输入期刊名称' },
              { max: 200, message: '期刊名称不能超过200字符' },
            ]}
          >
            <Input placeholder="请输入期刊名称（必填）" />
          </Form.Item>

          <Form.Item
            name="tag_ids"
            label="标签"
          >
            <EnhancedTagSelect
              placeholder="选择或创建标签（可选）"
            />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 期刊统计抽屉 */}
      <Drawer
        title="期刊统计详情"
        placement="right"
        width={720}
        open={isStatsDrawerVisible}
        onClose={() => {
          setIsStatsDrawerVisible(false);
          setSelectedJournalId(null);
        }}
      >
        {journalStats && (
          <>
            {/* 期刊基本信息 */}
            <Card
              title={
                <span>
                  <BookOutlined style={{ marginRight: 8 }} />
                  期刊信息
                </span>
              }
              style={{ marginBottom: 16 }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="期刊名称">
                  {journalStats.journal.name}
                </Descriptions.Item>
                <Descriptions.Item label="标签">
                  {journalStats.journal.tags?.map((tag: { id: number; name: string; color: string }) => (
                    <Tag key={tag.id} style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary }}>
                      {tag.name}
                    </Tag>
                  ))}
                  {(!journalStats.journal.tags || journalStats.journal.tags.length === 0) && '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 引用统计 */}
            <Card
              title={
                <span>
                  <BarChartOutlined style={{ marginRight: 8 }} />
                  引用统计
                </span>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic
                    title="参考期刊引用"
                    value={journalStats.stats.reference_count}
                    valueStyle={{ color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}
                    suffix="次"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="投稿期刊引用"
                    value={journalStats.stats.target_count}
                    valueStyle={{ color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}
                    suffix="次"
                  />
                </Col>
              </Row>

              <Divider />

              <Descriptions column={2} size="small">
                <Descriptions.Item label="参考Ideas">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 500 }}>
                    {journalStats.breakdown.reference_ideas_count}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="参考Projects">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_tertiary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}>
                    {journalStats.breakdown.reference_projects_count}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="拟投稿Ideas">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}>
                    {journalStats.breakdown.target_ideas_count}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="拟投稿Projects">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_tertiary, color: GRAYSCALE_SYSTEM.secondary, fontWeight: 600 }}>
                    {journalStats.breakdown.target_projects_count}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 期卷号统计已移除 - 点击"期卷号"按钮查看浏览记录 */}

            {/* 引用详情 */}
            {journalReferences && (
              <Card
                title={
                  <span>
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    引用详情
                  </span>
                }
              >
                {/* 作为参考期刊的Ideas */}
                {journalReferences.references.reference_ideas.length > 0 && (
                  <>
                    <Title level={5}>作为参考期刊的Ideas</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.reference_ideas}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.project_name}
                            description={
                              <Space>
                                <Text type="secondary">合作者: {item.responsible_person || '-'}</Text>
                                <Tag
                                  style={{
                                    backgroundColor: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
                                    color: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.secondary,
                                    fontWeight: item.maturity === 'mature' ? 600 : 400,
                                    border: `1px solid ${item.maturity === 'mature' ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light}`,
                                  }}
                                >
                                  {item.maturity === 'mature' ? '成熟' : '不成熟'}
                                </Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                  </>
                )}

                {/* 作为参考期刊的Projects */}
                {journalReferences.references.reference_projects.length > 0 && (
                  <>
                    <Title level={5}>作为参考期刊的研究项目</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.reference_projects}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.title}
                            description={
                              <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 500 }}>
                                {item.status}
                              </Tag>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                  </>
                )}

                {/* 作为投稿期刊的Ideas */}
                {journalReferences.references.target_ideas.length > 0 && (
                  <>
                    <Title level={5}>作为投稿期刊的Ideas</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.target_ideas}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.project_name}
                            description={
                              <Space>
                                <Text type="secondary">合作者: {item.responsible_person || '-'}</Text>
                                <Tag
                                  style={{
                                    backgroundColor: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
                                    color: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.secondary,
                                    fontWeight: item.maturity === 'mature' ? 600 : 400,
                                    border: `1px solid ${item.maturity === 'mature' ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light}`,
                                  }}
                                >
                                  {item.maturity === 'mature' ? '成熟' : '不成熟'}
                                </Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                  </>
                )}

                {/* 作为投稿期刊的Projects */}
                {journalReferences.references.target_projects.length > 0 && (
                  <>
                    <Title level={5}>作为投稿期刊的研究项目</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.target_projects}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.title}
                            description={
                              <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 500 }}>
                                {item.status}
                              </Tag>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </>
                )}

                {/* 无引用时的提示 */}
                {journalStats.stats.total_count === 0 && (
                  <Text type="secondary">该期刊暂无引用</Text>
                )}
              </Card>
            )}
          </>
        )}
      </Drawer>

      {/* 期卷号浏览记录抽屉 */}
      <Drawer
        title={`浏览记录 - ${selectedJournalForIssues?.name || ''}`}
        placement="right"
        width={800}
        open={isIssuesDrawerVisible}
        onClose={() => {
          setIsIssuesDrawerVisible(false);
          setSelectedJournalForIssues(null);
          setJournalIssues([]);
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateIssue}
          >
            添加记录
          </Button>
        </div>

        {isIssuesLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : journalIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <BookOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: '16px', color: '#999' }}>
              暂无期卷号记录，点击上方按钮添加
            </div>
          </div>
        ) : (
          // 按年份分组显示
          Object.keys(
            journalIssues.reduce((acc, issue) => {
              if (!acc[issue.year]) {
                acc[issue.year] = [];
              }
              acc[issue.year].push(issue);
              return acc;
            }, {} as Record<number, any[]>)
          )
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map((year) => (
              <Card
                key={year}
                title={`${year}年`}
                style={{ marginBottom: 16 }}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {journalIssues
                    .filter((issue) => issue.year === parseInt(year))
                    .sort((a, b) => b.issue.localeCompare(a.issue))
                    .map((issue) => (
                      <Card
                        key={issue.id}
                        size="small"
                        style={{ backgroundColor: '#fafafa' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space size="large">
                            <Text strong>
                              Vol.{issue.volume} No.{issue.issue}
                            </Text>
                            <Tag color="blue">
                              {new Date(issue.marked_date).toLocaleDateString()}
                            </Tag>
                          </Space>
                          <Space>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleEditIssue(issue)}
                            >
                              编辑
                            </Button>
                            <Popconfirm
                              title="确定删除该记录？"
                              onConfirm={() => handleDeleteIssue(issue.id)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button size="small" danger icon={<DeleteOutlined />}>
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        </div>
                        {issue.notes && (
                          <div style={{ marginTop: '8px', color: '#666' }}>
                            <Text type="secondary">{issue.notes}</Text>
                          </div>
                        )}
                      </Card>
                    ))}
                </Space>
              </Card>
            ))
        )}
      </Drawer>

      {/* 期卷号编辑模态框 */}
      <Modal
        title={editingIssue ? '编辑期卷号记录' : '添加期卷号记录'}
        open={isIssuesModalVisible}
        onCancel={() => setIsIssuesModalVisible(false)}
        onOk={handleSubmitIssue}
        width={600}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 卷号字段：中文期刊时隐藏 */}
          {!isChineseJournal(selectedJournalForIssues?.name || '') && (
            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text strong>卷号 *</Text>
                  <Input
                    placeholder="例如: 1"
                    value={issueFormData.volume}
                    onChange={(e) => setIssueFormData({ ...issueFormData, volume: e.target.value })}
                    style={{ marginTop: '8px' }}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>期号 *</Text>
                  <Input
                    placeholder="例如: 1"
                    value={issueFormData.issue}
                    onChange={(e) => setIssueFormData({ ...issueFormData, issue: e.target.value })}
                    style={{ marginTop: '8px' }}
                  />
                </div>
              </Col>
            </Row>
          )}
          {/* 中文期刊只显示期号 */}
          {isChineseJournal(selectedJournalForIssues?.name || '') && (
            <div>
              <Text strong>期号 *</Text>
              <Input
                placeholder="例如: 1"
                value={issueFormData.issue}
                onChange={(e) => setIssueFormData({ ...issueFormData, issue: e.target.value })}
                style={{ marginTop: '8px' }}
              />
            </div>
          )}

          <div>
            <Text strong>年份 *</Text>
            <Input
              type="number"
              placeholder="例如: 2024"
              value={issueFormData.year}
              onChange={(e) => setIssueFormData({ ...issueFormData, year: parseInt(e.target.value) })}
              style={{ marginTop: '8px' }}
            />
          </div>

          <div>
            <Text strong>备注</Text>
            <TextArea
              placeholder="可选：添加备注信息"
              value={issueFormData.notes}
              onChange={(e) => setIssueFormData({ ...issueFormData, notes: e.target.value })}
              style={{ marginTop: '8px' }}
              rows={3}
            />
          </div>
        </Space>
      </Modal>
              </>
            ),
          },
          {
            key: 'english',
            label: '英文期刊',
            children: (
              <>
                {/* 筛选栏 */}
                <FilterSection
                  filterControls={
                    <Space size="middle">
                      <div>
                        <Text strong style={{ marginRight: 8 }}>
                          标签：
                        </Text>
                        <Select
                          mode="multiple"
                          style={{ width: 200 }}
                          placeholder="选择标签筛选"
                          allowClear
                          value={selectedTagIds}
                          onChange={setSelectedTagIds}
                          maxTagCount={3}
                          options={tags.map((tag) => ({
                            label: tag.name,
                            value: tag.id,
                          }))}
                        />
                      </div>

                      <div>
                        <Text strong style={{ marginRight: 8 }}>
                          搜索：
                        </Text>
                        <Input
                          style={{ width: 250 }}
                          placeholder="搜索期刊名称"
                          prefix={<SearchOutlined />}
                          allowClear
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                        />
                      </div>

                      <div>
                        <Text strong style={{ marginRight: 8 }}>
                          排序：
                        </Text>
                        <Select
                          style={{ width: 120 }}
                          value={sortBy}
                          onChange={(value) => setSortBy(value)}
                          options={[
                            { label: '名称', value: 'name' },
                            { label: '引用总数', value: 'total_count' },
                            { label: '浏览记录', value: 'issues_count' },
                          ]}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          style={{ marginLeft: 4 }}
                        />
                      </div>
                    </Space>
                  }
                />

                {/* 期刊卡片列表 */}
                <TableContainer>
                  <Row gutter={[16, 16]}>
                    {filteredJournals.map((journal) => (
                      <Col xs={24} sm={12} md={8} lg={6} xl={4} key={journal.id}>
                        <Card
                          size="small"
                          style={{
                            border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
                            backgroundColor: GRAYSCALE_SYSTEM.bg_secondary,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
                          hoverable
                        >
                          {/* 期刊名称 */}
                          <div style={{ marginBottom: '8px' }}>
                            <Text
                              strong
                              style={{
                                fontSize: 13,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {journal.name}
                            </Text>
                          </div>

                          {/* 标签 */}
                          <div style={{ marginBottom: '8px', minHeight: '20px' }}>
                            {(!journal.tags || journal.tags.length === 0) ? (
                              <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>未分类</Tag>
                            ) : (
                              journal.tags.slice(0, 2).map((tag) => (
                                <Tag key={tag.id} style={{ margin: '0 4px 4px 0', fontSize: 11 }}>
                                  {tag.name}
                                </Tag>
                              ))
                            )}
                            {journal.tags.length > 2 && (
                              <Tag style={{ margin: '0 4px 4px 0', fontSize: 11 }}>+{journal.tags.length - 2}</Tag>
                            )}
                          </div>

                          {/* 备注（如果有） */}
                          {journal.notes && (
                            <div style={{ marginBottom: '8px', flex: 1 }}>
                              <Text
                                type="secondary"
                                style={{ fontSize: 11 }}
                                ellipsis={{ tooltip: journal.notes }}
                              >
                                {journal.notes}
                              </Text>
                            </div>
                          )}

                          {/* 底部统计和操作 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                            <Space size={8}>
                              <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary }}>
                                参考{journal.reference_count || 0}
                              </Text>
                              <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary }}>
                                研究{journal.target_count || 0}
                              </Text>
                              <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary }}>
                                浏览{journal.issues_count || 0}
                              </Text>
                            </Space>

                            <Space size={4}>
                              <Button
                                type="link"
                                size="small"
                                icon={<BookOutlined />}
                                onClick={() => handleViewIssues(journal)}
                              />
                              <Button
                                type="link"
                                size="small"
                                icon={<BarChartOutlined />}
                                onClick={() => handleViewStats(journal)}
                              />
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(journal)}
                              />
                              <Popconfirm
                                title="确定删除该期刊？"
                                description="如果期刊被引用，将无法删除"
                                onConfirm={() => handleDelete(journal.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button
                                  type="link"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                />
                              </Popconfirm>
                            </Space>
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </TableContainer>

      {/* 创建/编辑期刊模态框 */}
      <Modal
        title={editingJournal ? '编辑期刊' : '新建期刊'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingJournal(null);
          form.resetFields();
        }}
        onOk={handleOkClick}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="期刊名称"
            rules={[
              { required: true, message: '请输入期刊名称' },
              { max: 200, message: '期刊名称不能超过200字符' },
            ]}
          >
            <Input placeholder="请输入期刊名称（必填）" />
          </Form.Item>

          <Form.Item
            name="tag_ids"
            label="标签"
          >
            <EnhancedTagSelect
              placeholder="选择或创建标签（可选）"
            />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 期刊统计抽屉 */}
      <Drawer
        title="期刊统计详情"
        placement="right"
        width={720}
        open={isStatsDrawerVisible}
        onClose={() => {
          setIsStatsDrawerVisible(false);
          setSelectedJournalId(null);
        }}
      >
        {journalStats && (
          <>
            {/* 期刊基本信息 */}
            <Card
              title={
                <span>
                  <BookOutlined style={{ marginRight: 8 }} />
                  期刊信息
                </span>
              }
              style={{ marginBottom: 16 }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="期刊名称">
                  {journalStats.journal.name}
                </Descriptions.Item>
                <Descriptions.Item label="标签">
                  {journalStats.journal.tags?.map((tag: { id: number; name: string; color: string }) => (
                    <Tag key={tag.id} style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary }}>
                      {tag.name}
                    </Tag>
                  ))}
                  {(!journalStats.journal.tags || journalStats.journal.tags.length === 0) && '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 引用统计 */}
            <Card
              title={
                <span>
                  <BarChartOutlined style={{ marginRight: 8 }} />
                  引用统计
                </span>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic
                    title="参考期刊引用"
                    value={journalStats.stats.reference_count}
                    valueStyle={{ color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}
                    suffix="次"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="投稿期刊引用"
                    value={journalStats.stats.target_count}
                    valueStyle={{ color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}
                    suffix="次"
                  />
                </Col>
              </Row>

              <Divider />

              <Descriptions column={2} size="small">
                <Descriptions.Item label="参考Ideas">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 500 }}>
                    {journalStats.breakdown.reference_ideas_count}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="参考Projects">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_tertiary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}>
                    {journalStats.breakdown.reference_projects_count}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="拟投稿Ideas">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}>
                    {journalStats.breakdown.target_ideas_count}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="拟投稿Projects">
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_tertiary, color: GRAYSCALE_SYSTEM.secondary, fontWeight: 600 }}>
                    {journalStats.breakdown.target_projects_count}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 期卷号统计已移除 - 点击"期卷号"按钮查看浏览记录 */}

            {/* 引用详情 */}
            {journalReferences && (
              <Card
                title={
                  <span>
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    引用详情
                  </span>
                }
              >
                {/* 作为参考期刊的Ideas */}
                {journalReferences.references.reference_ideas.length > 0 && (
                  <>
                    <Title level={5}>作为参考期刊的Ideas</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.reference_ideas}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.project_name}
                            description={
                              <Space>
                                <Text type="secondary">合作者: {item.responsible_person || '-'}</Text>
                                <Tag
                                  style={{
                                    backgroundColor: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
                                    color: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.secondary,
                                    fontWeight: item.maturity === 'mature' ? 600 : 400,
                                    border: `1px solid ${item.maturity === 'mature' ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light}`,
                                  }}
                                >
                                  {item.maturity === 'mature' ? '成熟' : '不成熟'}
                                </Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                  </>
                )}

                {/* 作为参考期刊的Projects */}
                {journalReferences.references.reference_projects.length > 0 && (
                  <>
                    <Title level={5}>作为参考期刊的研究项目</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.reference_projects}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.title}
                            description={
                              <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 500 }}>
                                {item.status}
                              </Tag>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                  </>
                )}

                {/* 作为投稿期刊的Ideas */}
                {journalReferences.references.target_ideas.length > 0 && (
                  <>
                    <Title level={5}>作为投稿期刊的Ideas</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.target_ideas}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.project_name}
                            description={
                              <Space>
                                <Text type="secondary">合作者: {item.responsible_person || '-'}</Text>
                                <Tag
                                  style={{
                                    backgroundColor: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
                                    color: item.maturity === 'mature' ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.secondary,
                                    fontWeight: item.maturity === 'mature' ? 600 : 400,
                                    border: `1px solid ${item.maturity === 'mature' ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light}`,
                                  }}
                                >
                                  {item.maturity === 'mature' ? '成熟' : '不成熟'}
                                </Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                  </>
                )}

                {/* 作为投稿期刊的Projects */}
                {journalReferences.references.target_projects.length > 0 && (
                  <>
                    <Title level={5}>作为投稿期刊的研究项目</Title>
                    <List
                      size="small"
                      dataSource={journalReferences.references.target_projects}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.title}
                            description={
                              <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 500 }}>
                                {item.status}
                              </Tag>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </>
                )}

                {/* 无引用时的提示 */}
                {journalStats.stats.total_count === 0 && (
                  <Text type="secondary">该期刊暂无引用</Text>
                )}
              </Card>
            )}
          </>
        )}
      </Drawer>
              </>
            ),
          },
          {
            key: 'tags',
            label: '标签管理',
            children: <TagManagementPanel />,
          },
        ]}
      />

      {/* 表单验证提示模态框 */}
      <ValidationPromptModal
        visible={isValidationModalVisible}
        onClose={() => setIsValidationModalVisible(false)}
        missingFields={validationErrors}
      />
    </PageContainer>
  );
};

export default JournalsManagement;
