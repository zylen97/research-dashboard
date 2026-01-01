import React, { useState } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Table,
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
  GlobalOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  BarChartOutlined,
  SearchOutlined,
  FileTextOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi, tagApi } from '../services/apiOptimized';
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

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const JournalsManagement: React.FC = () => {
  const queryClient = useQueryClient();

  // Tab状态
  const [activeTab, setActiveTab] = useState<string>('journals');

  // 状态管理
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isStatsDrawerVisible, setIsStatsDrawerVisible] = useState(false);
  const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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

  // 表格列定义
  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      fixed: 'left' as const,
      render: (_: any, __: any, index: number) =>
        (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: '期刊名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
      ellipsis: true,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 250,
      render: (tags: JournalTag[]) => (
        <>
          {tags?.map((tag) => (
            <Tag key={tag.id} style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, border: `1px solid ${GRAYSCALE_SYSTEM.border_light}` }}>
              {tag.name}
            </Tag>
          ))}
          {(!tags || tags.length === 0) && '-'}
        </>
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '参考引用',
      dataIndex: 'reference_count',
      key: 'reference_count',
      width: 100,
      render: (count: number) => (
        <Tag
          style={{
            backgroundColor: count > 0 ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
            color: count > 0 ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.tertiary,
            fontWeight: count > 0 ? 600 : 400,
            border: count > 0 ? `1px solid ${GRAYSCALE_SYSTEM.border_strong}` : `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
          }}
        >
          {count}
        </Tag>
      ),
    },
    {
      title: '拟投稿引用',
      dataIndex: 'target_count',
      key: 'target_count',
      width: 110,
      render: (count: number) => (
        <Tag
          style={{
            backgroundColor: count > 0 ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary,
            color: count > 0 ? GRAYSCALE_SYSTEM.primary : GRAYSCALE_SYSTEM.tertiary,
            fontWeight: count > 0 ? 600 : 400,
            border: count > 0 ? `1px solid ${GRAYSCALE_SYSTEM.border_strong}` : `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
          }}
        >
          {count}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Journal) => (
        <Space size="small">
          <Button
            type="link"
            icon={<BarChartOutlined />}
            onClick={() => handleViewStats(record)}
            size="small"
          >
            统计
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该期刊？"
            description="如果期刊被引用，将无法删除"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题和操作栏 */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            期刊库管理
          </Title>
          <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary, fontWeight: 600 }}>
            {journals.length} 个期刊
          </Tag>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            刷新
          </Button>
          {activeTab === 'journals' && (
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
        </div>
      </div>

      {/* Tabs：期刊列表和标签管理 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'journals',
            label: '期刊列表',
            children: (
              <>
                {/* 筛选栏 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space size="middle" wrap>
          <div>
            <Text strong style={{ marginRight: 8 }}>
              标签：
            </Text>
            <Select
              mode="multiple"
              style={{ width: 300 }}
              placeholder="选择标签筛选"
              allowClear
              value={selectedTagIds}
              onChange={setSelectedTagIds}
              maxTagCount={3}
            >
              {tags.map((tag) => (
                <Option key={tag.id} value={tag.id}>
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary }}>{tag.name}</Tag>
                </Option>
              ))}
            </Select>
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
      </Card>

      {/* 期刊列表表格 */}
      <Table
        size="small"
        dataSource={journals}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: journals.length,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          },
        }}
        scroll={{ x: 1200 }}
      />

      {/* 创建/编辑期刊模态框 */}
      <Modal
        title={editingJournal ? '编辑期刊' : '新建期刊'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingJournal(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
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
            <Select
              mode="multiple"
              placeholder="选择标签（可选）"
              allowClear
            >
              {tags.map((tag) => (
                <Option key={tag.id} value={tag.id}>
                  <Tag style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary, color: GRAYSCALE_SYSTEM.primary }}>{tag.name}</Tag>
                </Option>
              ))}
            </Select>
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
              <Row gutter={16}>
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
                    title="拟投稿期刊引用"
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

                {/* 作为拟投稿期刊的Ideas */}
                {journalReferences.references.target_ideas.length > 0 && (
                  <>
                    <Title level={5}>作为拟投稿期刊的Ideas</Title>
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

                {/* 作为拟投稿期刊的Projects */}
                {journalReferences.references.target_projects.length > 0 && (
                  <>
                    <Title level={5}>作为拟投稿期刊的研究项目</Title>
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
    </div>
  );
};

export default JournalsManagement;
