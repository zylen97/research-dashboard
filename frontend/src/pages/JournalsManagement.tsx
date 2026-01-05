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
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  BarChartOutlined,
  SearchOutlined,
  FileTextOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi, tagApi, volumeStatsApi } from '../services/apiOptimized';
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
import JournalPapersTab from '../components/JournalPapersTab';
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

  // 筛选状态
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState<string>('');

  const [form] = Form.useForm();

  // 查询标签列表
  const { data: tags = [] } = useQuery<JournalTag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 数据查询
  const {
    data: journals = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['journals', selectedTagIds, searchText],
    queryFn: () => {
      const params: { tag_ids?: string; search?: string } = {};
      if (selectedTagIds.length > 0) params.tag_ids = selectedTagIds.join(',');
      if (searchText) params.search = searchText;
      return journalApi.getJournals(params);
    },
  });

  // 根据Tab过滤期刊
  const filteredJournals = useMemo(() => {
    if (activeTab === 'tags') return [];
    return journals.filter(journal => {
      const isChinese = isChineseJournal(journal.name);
      return activeTab === 'chinese' ? isChinese : !isChinese;
    });
  }, [journals, activeTab]);

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

  // 期刊期卷号统计查询（v3.6）
  const { data: volumeStats } = useQuery({
    queryKey: ['volume-stats', selectedJournalId],
    queryFn: () => volumeStatsApi.getVolumeStats(selectedJournalId!),
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
      // 刷新引用该期刊的论文列表
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['journal-papers'] });
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
      // 刷新引用该期刊的论文列表
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['journal-papers'] });
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
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              刷新
            </Button>
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
                    </Space>
                  }
                />

                {/* 期刊卡片列表（可展开查看论文） */}
                <TableContainer>
                  <Collapse
                    accordion={false}
                    style={{ backgroundColor: 'transparent' }}
                    items={filteredJournals.map((journal) => ({
                    key: journal.id,
                    label: (
                      <Card
                        size="small"
                        style={{ border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`, backgroundColor: GRAYSCALE_SYSTEM.bg_secondary }}
                        bodyStyle={{ padding: '8px 12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {/* 期刊名称 */}
                          <Text strong style={{ fontSize: 14, flexShrink: 0 }}>
                            {journal.name}
                          </Text>

                          {/* 分隔符 */}
                          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>|</Text>

                          {/* 备注（如果有） */}
                          {journal.notes && (
                            <Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                              ellipsis={{ tooltip: journal.notes }}
                            >
                              {journal.notes}
                            </Text>
                          )}

                          {/* 分隔符 */}
                          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>|</Text>

                          {/* 标签 */}
                          {(!journal.tags || journal.tags.length === 0) ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>未分类</Tag>
                          ) : (
                            journal.tags.map((tag) => (
                              <Tag key={tag.id} style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
                                {tag.name}
                              </Tag>
                            ))
                          )}

                          {/* 统计信息 */}
                          <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary, marginLeft: 'auto', flexShrink: 0 }}>
                            参考{journal.reference_count || 0} · 论文{journal.paper_count || 0}
                          </Text>

                          {/* 操作按钮 */}
                          <Space size={4} style={{ flexShrink: 0 }}>
                            <Button
                              type="link"
                              size="small"
                              icon={<BarChartOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewStats(journal);
                              }}
                            />
                            <Button
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(journal);
                              }}
                            />
                            <Popconfirm
                              title="确定删除该期刊？"
                              description="如果期刊被引用，将无法删除"
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                handleDelete(journal.id);
                              }}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Popconfirm>
                          </Space>
                        </div>
                      </Card>
                    ),
          children: <JournalPapersTab journalId={journal.id} journalName={journal.name} />,
        }))}
      />
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

            {/* 期卷号统计（v3.6） */}
            {volumeStats && (
              <Card
                title={
                  <span>
                    <BookOutlined style={{ marginRight: 8 }} />
                    期卷号统计
                  </span>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={12}>
                  <Col span={8}>
                    <Statistic
                      title="总论文数"
                      value={volumeStats.total_papers}
                      valueStyle={{ color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="总卷数"
                      value={volumeStats.total_volumes}
                      valueStyle={{ color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="总期数"
                      value={volumeStats.total_issues}
                      valueStyle={{ color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}
                    />
                  </Col>
                </Row>

                <Divider />

                <Descriptions column={2} size="small">
                  <Descriptions.Item label="最新卷期">
                    <Text strong>
                      Vol.{volumeStats.latest_volume || '-'} No.{volumeStats.latest_issue || '-'}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="数据库记录">
                    <Text type="secondary">
                      Vol.{volumeStats.db_latest_volume || '-'} No.{volumeStats.db_latest_issue || '-'}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>

                {/* 卷期覆盖可视化 */}
                {Object.keys(volumeStats.coverage_by_year || {}).length > 0 && (
                  <>
                    <Divider orientation="left">卷期覆盖情况</Divider>
                    <div style={{ maxHeight: 400, overflow: 'auto' }}>
                      {Object.entries(volumeStats.coverage_by_year || {})
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, items]) => (
                          <div key={year} style={{ marginBottom: 16 }}>
                            <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
                              {year}年
                            </Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {items.map((item) => (
                                <Tag
                                  key={`${item.volume}-${item.issue}`}
                                  style={{
                                    backgroundColor: item.count > 0 ? GRAYSCALE_SYSTEM.bg_secondary : '#FAFAFA',
                                    color: item.count > 0 ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.disabled,
                                    border: `1px solid ${item.count > 0 ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light}`,
                                    fontSize: 12,
                                    padding: '4px 8px',
                                    opacity: item.count > 0 ? 1 : 0.5,
                                  }}
                                >
                                  No.{item.issue}: {item.count > 0 ? `${item.count}篇` : '无'}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}

                {/* 卷号分布 */}
                {volumeStats.volumes && volumeStats.volumes.length > 0 && (
                  <>
                    <Divider orientation="left">卷号分布</Divider>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {volumeStats.volumes
                        .sort((a, b) => {
                          // 尝试数字排序
                          const aNum = parseInt(a.volume);
                          const bNum = parseInt(b.volume);
                          if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
                          return a.volume.localeCompare(b.volume);
                        })
                        .map((vol) => (
                          <Tag
                            key={vol.volume}
                            style={{
                              backgroundColor: GRAYSCALE_SYSTEM.bg_secondary,
                              color: GRAYSCALE_SYSTEM.primary,
                              border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
                              fontSize: 12,
                              padding: '4px 8px',
                            }}
                          >
                            Vol.{vol.volume}: {vol.count} 篇
                          </Tag>
                        ))}
                    </div>
                  </>
                )}

                {/* 期号分布 */}
                {volumeStats.issues && volumeStats.issues.length > 0 && (
                  <>
                    <Divider orientation="left">期号分布</Divider>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {volumeStats.issues
                        .sort((a, b) => {
                          // 尝试数字排序
                          const aNum = parseInt(a.issue);
                          const bNum = parseInt(b.issue);
                          if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
                          return a.issue.localeCompare(b.issue);
                        })
                        .map((item) => (
                          <Tag
                            key={item.issue}
                            style={{
                              backgroundColor: GRAYSCALE_SYSTEM.bg_tertiary,
                              color: GRAYSCALE_SYSTEM.primary,
                              border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
                              fontSize: 12,
                              padding: '4px 8px',
                            }}
                          >
                            No.{item.issue}: {item.count} 篇
                          </Tag>
                        ))}
                    </div>
                  </>
                )}
              </Card>
            )}

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
                                <Text type="secondary">负责人: {item.responsible_person || '-'}</Text>
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
                                <Text type="secondary">负责人: {item.responsible_person || '-'}</Text>
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
                    </Space>
                  }
                />

                {/* 期刊卡片列表（可展开查看论文） */}
                <TableContainer>
                  <Collapse
                    accordion={false}
                    style={{ backgroundColor: 'transparent' }}
                    items={filteredJournals.map((journal) => ({
                    key: journal.id,
                    label: (
                      <Card
                        size="small"
                        style={{ border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`, backgroundColor: GRAYSCALE_SYSTEM.bg_secondary }}
                        bodyStyle={{ padding: '8px 12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {/* 期刊名称 */}
                          <Text strong style={{ fontSize: 14, flexShrink: 0 }}>
                            {journal.name}
                          </Text>

                          {/* 分隔符 */}
                          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>|</Text>

                          {/* 备注（如果有） */}
                          {journal.notes && (
                            <Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                              ellipsis={{ tooltip: journal.notes }}
                            >
                              {journal.notes}
                            </Text>
                          )}

                          {/* 分隔符 */}
                          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>|</Text>

                          {/* 标签 */}
                          {(!journal.tags || journal.tags.length === 0) ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>未分类</Tag>
                          ) : (
                            journal.tags.map((tag) => (
                              <Tag key={tag.id} style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
                                {tag.name}
                              </Tag>
                            ))
                          )}

                          {/* 统计信息 */}
                          <Text style={{ fontSize: 11, color: GRAYSCALE_SYSTEM.tertiary, marginLeft: 'auto', flexShrink: 0 }}>
                            参考{journal.reference_count || 0} · 论文{journal.paper_count || 0}
                          </Text>

                          {/* 操作按钮 */}
                          <Space size={4} style={{ flexShrink: 0 }}>
                            <Button
                              type="link"
                              size="small"
                              icon={<BarChartOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewStats(journal);
                              }}
                            />
                            <Button
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(journal);
                              }}
                            />
                            <Popconfirm
                              title="确定删除该期刊？"
                              description="如果期刊被引用，将无法删除"
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                handleDelete(journal.id);
                              }}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Popconfirm>
                          </Space>
                        </div>
                      </Card>
                    ),
          children: <JournalPapersTab journalId={journal.id} journalName={journal.name} />,
        }))}
      />
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

            {/* 期卷号统计（v3.6） */}
            {volumeStats && (
              <Card
                title={
                  <span>
                    <BookOutlined style={{ marginRight: 8 }} />
                    期卷号统计
                  </span>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={12}>
                  <Col span={8}>
                    <Statistic
                      title="总论文数"
                      value={volumeStats.total_papers}
                      valueStyle={{ color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="总卷数"
                      value={volumeStats.total_volumes}
                      valueStyle={{ color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="总期数"
                      value={volumeStats.total_issues}
                      valueStyle={{ color: GRAYSCALE_SYSTEM.secondary, fontWeight: 500 }}
                    />
                  </Col>
                </Row>

                <Divider />

                <Descriptions column={2} size="small">
                  <Descriptions.Item label="最新卷期">
                    <Text strong>
                      Vol.{volumeStats.latest_volume || '-'} No.{volumeStats.latest_issue || '-'}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="数据库记录">
                    <Text type="secondary">
                      Vol.{volumeStats.db_latest_volume || '-'} No.{volumeStats.db_latest_issue || '-'}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>

                {/* 卷期覆盖可视化 */}
                {Object.keys(volumeStats.coverage_by_year || {}).length > 0 && (
                  <>
                    <Divider orientation="left">卷期覆盖情况</Divider>
                    <div style={{ maxHeight: 400, overflow: 'auto' }}>
                      {Object.entries(volumeStats.coverage_by_year || {})
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([year, items]) => (
                          <div key={year} style={{ marginBottom: 16 }}>
                            <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
                              {year}年
                            </Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {items.map((item) => (
                                <Tag
                                  key={`${item.volume}-${item.issue}`}
                                  style={{
                                    backgroundColor: item.count > 0 ? GRAYSCALE_SYSTEM.bg_secondary : '#FAFAFA',
                                    color: item.count > 0 ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.disabled,
                                    border: `1px solid ${item.count > 0 ? GRAYSCALE_SYSTEM.border_strong : GRAYSCALE_SYSTEM.border_light}`,
                                    fontSize: 12,
                                    padding: '4px 8px',
                                    opacity: item.count > 0 ? 1 : 0.5,
                                  }}
                                >
                                  No.{item.issue}: {item.count > 0 ? `${item.count}篇` : '无'}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}

                {/* 卷号分布 */}
                {volumeStats.volumes && volumeStats.volumes.length > 0 && (
                  <>
                    <Divider orientation="left">卷号分布</Divider>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {volumeStats.volumes
                        .sort((a, b) => {
                          // 尝试数字排序
                          const aNum = parseInt(a.volume);
                          const bNum = parseInt(b.volume);
                          if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
                          return a.volume.localeCompare(b.volume);
                        })
                        .map((vol) => (
                          <Tag
                            key={vol.volume}
                            style={{
                              backgroundColor: GRAYSCALE_SYSTEM.bg_secondary,
                              color: GRAYSCALE_SYSTEM.primary,
                              border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
                              fontSize: 12,
                              padding: '4px 8px',
                            }}
                          >
                            Vol.{vol.volume}: {vol.count} 篇
                          </Tag>
                        ))}
                    </div>
                  </>
                )}

                {/* 期号分布 */}
                {volumeStats.issues && volumeStats.issues.length > 0 && (
                  <>
                    <Divider orientation="left">期号分布</Divider>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {volumeStats.issues
                        .sort((a, b) => {
                          // 尝试数字排序
                          const aNum = parseInt(a.issue);
                          const bNum = parseInt(b.issue);
                          if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
                          return a.issue.localeCompare(b.issue);
                        })
                        .map((item) => (
                          <Tag
                            key={item.issue}
                            style={{
                              backgroundColor: GRAYSCALE_SYSTEM.bg_tertiary,
                              color: GRAYSCALE_SYSTEM.primary,
                              border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
                              fontSize: 12,
                              padding: '4px 8px',
                            }}
                          >
                            No.{item.issue}: {item.count} 篇
                          </Tag>
                        ))}
                    </div>
                  </>
                )}
              </Card>
            )}

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
                                <Text type="secondary">负责人: {item.responsible_person || '-'}</Text>
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
                                <Text type="secondary">负责人: {item.responsible_person || '-'}</Text>
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
