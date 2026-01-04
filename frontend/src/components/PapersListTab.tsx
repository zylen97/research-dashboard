/**
 * 论文列表Tab组件
 * 显示所有论文，支持按期刊、标签、状态筛选，支持排序
 */
import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Card,
  Modal,
  Popconfirm,
  message,
  Divider,
  Descriptions,
  Typography,
  Upload,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  RocketOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType, TableProps } from 'antd/es/table';

import { paperApi, journalApi } from '../services/apiOptimized';
import EnhancedTagSelect from './EnhancedTagSelect';
import { Paper, PaperStatus, PaperSortField, SortOrder } from '../types/papers';
import { Journal } from '../types/journals';
import {
  AVAILABLE_COLUMNS,
  COLUMN_VISIBILITY_KEYS,
  createOptionalColumnDefinitions,
  useColumnVisibility,
} from './papers';
import PaperStatsCards from './papers/PaperStatsCards';
import ColumnFilter from './papers/ColumnFilter';

const { Text, Paragraph } = Typography;
const { Search } = Input;

interface PapersListTabProps {
  // 可选的筛选器初始值
  initialJournalIds?: number[];
  initialStatus?: PaperStatus;
}

const PapersListTab: React.FC<PapersListTabProps> = ({
  initialJournalIds = [],
  initialStatus,
}) => {
  const queryClient = useQueryClient();

  // 状态管理
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaperStatus | undefined>(initialStatus);
  const [journalFilter, setJournalFilter] = useState<number[]>(initialJournalIds);
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<PaperSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(undefined);

  // 列可见性管理
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    COLUMN_VISIBILITY_KEYS.PAPERS_LIST,
    true
  );
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  // 查询期刊列表（用于筛选）
  const { data: journals = [] } = useQuery<Journal[]>({
    queryKey: ['journals'],
    queryFn: () => journalApi.getJournals(),
  });

  // 查询论文列表
  const {
    data: papersResponse,
    isLoading,
    refetch,
  } = useQuery<{ items: Paper[]; total: number; page: number; page_size: number }>({
    queryKey: ['papers', searchText, currentPage, pageSize, statusFilter, journalFilter, tagFilter, sortBy, sortOrder],
    queryFn: () => {
      const params: {
        skip?: number;
        limit?: number;
        search?: string;
        status?: PaperStatus;
        tag_ids?: string;
        journal_id?: number;
        sort_by?: PaperSortField;
        sort_order?: SortOrder;
      } = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (tagFilter.length > 0) params.tag_ids = tagFilter.join(',');
      // 单选期刊时使用后端筛选，多选时保留前端兼容
      if (journalFilter.length === 1) {
        params.journal_id = journalFilter[0] as number;
      }
      if (sortBy) params.sort_by = sortBy;
      if (sortOrder) params.sort_order = sortOrder;
      return paperApi.getPapers(params);
    },
  });

  const papers = papersResponse?.items || [];
  const totalPapers = papersResponse?.total || 0;

  // 后端已处理单选筛选，前端仅作多选兼容
  const filteredPapers = useMemo(() => {
    // 单选时后端已筛选，直接返回
    if (journalFilter.length <= 1) return papers;
    // 多选时前端筛选（保留兼容性）
    return papers.filter(p => p.journal_id && journalFilter.includes(p.journal_id));
  }, [papers, journalFilter]);

  // 查询论文统计（全局）
  const { data: stats } = useQuery({
    queryKey: ['papers-stats'],
    queryFn: () => paperApi.getStats(),
  });

  // 计算筛选后的统计（当有筛选条件时使用）
  const filteredStats = useMemo(() => {
    // 无筛选时使用全局统计
    if (journalFilter.length === 0 && !statusFilter && tagFilter.length === 0) {
      return stats;
    }

    // 计算筛选后的统计数据
    const filteredPapersList = journalFilter.length <= 1
      ? papers  // 后端已筛选（单选或无筛选）
      : papers.filter(p => p.journal_id && journalFilter.includes(p.journal_id));  // 多选时前端筛选

    return {
      total: filteredPapersList.length,
      by_status: {
        pending: filteredPapersList.filter(p => p.status === 'pending').length,
        analyzed: filteredPapersList.filter(p => p.status === 'analyzed').length,
      },
    };
  }, [papers, journalFilter, statusFilter, tagFilter, stats]);

  // 删除论文
  const deleteMutation = useMutation({
    mutationFn: (id: number) => paperApi.deletePaper(id),
    onSuccess: () => {
      message.success('论文删除成功');
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['papers-stats'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  // 转换为Idea
  const convertMutation = useMutation({
    mutationFn: (id: number) => paperApi.convertToIdea(id),
    onSuccess: (data) => {
      message.success(`已转换为Idea (ID: ${data.idea_id})`);
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['papers-stats'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '转换失败');
    },
  });

  // 批量删除论文
  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => paperApi.batchDelete(ids),
    onSuccess: (data) => {
      message.success(`已删除 ${data.deleted_count} 篇论文`);
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['papers-stats'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '批量删除失败');
    },
  });

  // Excel导入
  const uploadMutation = useMutation({
    mutationFn: (file: File) => paperApi.importFromExcel(file),
    onSuccess: (data) => {
      const importedCount = data?.imported_count || 0;
      message.success(`成功导入 ${importedCount} 篇论文`);
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['papers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      setIsImportModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '导入失败');
    },
  });

  // 解析AI分析结果
  const parseAIAnalysis = (paper: Paper) => {
    if (!paper.ai_analysis_result) return null;
    try {
      return JSON.parse(paper.ai_analysis_result);
    } catch {
      return null;
    }
  };

  // 获取可选列定义
  const optionalColumnDefs = useMemo(() => createOptionalColumnDefinitions(), []);

  // 处理Table排序变化
  const handleTableChange: TableProps<Paper>['onChange'] = (_pagination, _filters, sorter) => {
    if (sorter && !Array.isArray(sorter)) {
      const field = sorter.field as PaperSortField;
      const order = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined;
      setSortBy(field);
      setSortOrder(order);
    } else {
      setSortBy(undefined);
      setSortOrder(undefined);
    }
  };

  // 动态列配置
  const columns: ColumnsType<Paper> = useMemo(() => {
    const result: ColumnsType<Paper> = [];

    // 核心列 - 始终显示
    result.push({
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    });

    result.push({
      title: '期刊',
      dataIndex: ['journal', 'name'],
      key: 'journal',
      ellipsis: true,
      render: (name: string) => name || '-',
    });

    result.push({
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      sorter: true,
      render: (year: number | null) => year ?? '-',
    });

    result.push({
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: '待分析', color: '#999' },
          analyzed: { text: '已分析', color: '#333' },
          converted: { text: '已转换', color: '#1890ff' },
        };
        const config = statusMap[status] || { text: status, color: '#999' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    });

    // 导入日期列 - 始终显示
    result.push({
      title: '导入日期',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      render: (date: string) => {
        if (!date) return '-';
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      },
    });

    // PapersListTab 特有列
    if (visibleColumns.includes('migration_potential')) {
      result.push(optionalColumnDefs.migration_potential);
    }

    if (visibleColumns.includes('link')) {
      result.push(optionalColumnDefs.link);
    }

    // 可选列
    if (visibleColumns.includes('authors')) {
      result.push(optionalColumnDefs.authors);
    }

    if (visibleColumns.includes('volume')) {
      result.push(optionalColumnDefs.volume);
    }

    if (visibleColumns.includes('issue')) {
      result.push(optionalColumnDefs.issue);
    }

    if (visibleColumns.includes('abstract')) {
      result.push(optionalColumnDefs.abstract);
    }

    if (visibleColumns.includes('abstract_summary')) {
      result.push(optionalColumnDefs.abstract_summary);
    }

    if (visibleColumns.includes('ai_analysis')) {
      result.push(optionalColumnDefs.ai_analysis);
    }

    // 操作列 - 始终显示
    result.push({
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: unknown, record: Paper) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPaper(record);
              setIsDetailModalVisible(true);
            }}
          >
            详情
          </Button>
          <Popconfirm
            title="确认转换？"
            description={record.status === 'analyzed'
              ? "将此论文转换为Idea"
              : "论文尚未分析，确定要转换吗？转换后描述可能不完整"}
            onConfirm={() => convertMutation.mutate(record.id)}
          >
            <Button type="link" size="small" icon={<RocketOutlined />}>
              转换
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认删除？"
            description="删除后无法恢复"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    });

    return result;
  }, [visibleColumns, optionalColumnDefs, convertMutation, deleteMutation]);

  return (
    <div>
      {/* 统计卡片 */}
      <PaperStatsCards stats={filteredStats} loading={isLoading} />

      {/* 筛选和操作栏 */}
      <div style={{ padding: '8px 0', marginBottom: 16 }}>
        <Space size="middle" style={{ width: '100%' }}>
          {/* 左侧操作按钮 */}
          <Space size="small">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setIsImportModalVisible(true)}
            >
              导入
            </Button>
            {selectedRowKeys.length > 0 && (
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={batchDeleteMutation.isPending}
                onClick={() => {
                  Modal.confirm({
                    title: '确认批量删除',
                    content: `确定要删除选中的 ${selectedRowKeys.length} 篇论文吗？删除后无法恢复。`,
                    onOk: () => batchDeleteMutation.mutate(selectedRowKeys),
                  });
                }}
              >
                删除 ({selectedRowKeys.length})
              </Button>
            )}
          </Space>

          <Divider type="vertical" style={{ margin: 0 }} />

          {/* 右侧筛选控件 */}
          <Space size="small" style={{ flex: 1 }}>
            <Select
              mode="multiple"
              placeholder="期刊"
              allowClear
              style={{ width: 120 }}
              onChange={setJournalFilter}
              value={journalFilter}
              options={journals.map(j => ({ label: j.name, value: j.id }))}
            />
            <EnhancedTagSelect
              placeholder="标签"
              allowClear
              style={{ width: 120 }}
              onChange={setTagFilter}
              value={tagFilter}
            />
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 100 }}
              onChange={(value) => setStatusFilter(value as PaperStatus | undefined)}
              value={statusFilter}
            >
              <Select.Option value="pending">待分析</Select.Option>
              <Select.Option value="analyzed">已分析</Select.Option>
            </Select>
            <Search
              placeholder="搜索"
              allowClear
              style={{ width: 160 }}
              onSearch={(value) => {
                setSearchText(value);
                setCurrentPage(1);
              }}
            />
            <ColumnFilter
              availableColumns={AVAILABLE_COLUMNS}
              visibleColumns={visibleColumns}
              onChange={setVisibleColumns}
              storageKey={COLUMN_VISIBILITY_KEYS.PAPERS_LIST}
            />
          </Space>
        </Space>
      </div>

      {/* 论文列表 */}
      <Table
        columns={columns}
        dataSource={filteredPapers}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1200 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys as number[]),
        }}
        onChange={handleTableChange}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: journalFilter.length <= 1 ? totalPapers : filteredPapers.length,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size || 20);
          },
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 论文详情弹窗 */}
      <Modal
        title="论文详情"
        open={isDetailModalVisible}
        onCancel={() => {
          setIsDetailModalVisible(false);
          setSelectedPaper(null);
        }}
        width={800}
        footer={null}
      >
        {selectedPaper && (
          <div>
            <Divider orientation="left">基本信息</Divider>
            <Descriptions title="" bordered column={2}>
              <Descriptions.Item label="标题" span={2}>
                {selectedPaper.title}
              </Descriptions.Item>
              <Descriptions.Item label="期刊">
                {selectedPaper.journal?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="年份">
                {selectedPaper.year || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="作者" span={2}>
                {selectedPaper.authors || '-'}
              </Descriptions.Item>
              {selectedPaper.link && (
                <Descriptions.Item label="预览链接" span={2}>
                  <a href={selectedPaper.link} target="_blank" rel="noopener noreferrer">
                    {selectedPaper.link}
                  </a>
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedPaper.abstract && (
              <>
                <Divider orientation="left">论文内容</Divider>
                <Paragraph>{selectedPaper.abstract}</Paragraph>
              </>
            )}

            {selectedPaper.status === 'analyzed' && selectedPaper.ai_analysis_result && (
              <>
                <Divider orientation="left">AI分析结果</Divider>
                {(() => {
                  const analysis = parseAIAnalysis(selectedPaper);
                  return analysis ? (
                    <div>
                      <Card size="small" style={{ marginBottom: 12 }}>
                        <Text strong>核心idea：</Text>
                        <Paragraph>{analysis.core_idea}</Paragraph>
                      </Card>
                      <Card size="small" style={{ marginBottom: 12 }}>
                        <Text strong>迁移潜力：</Text>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              analysis.migration_potential === 'high'
                                ? '#f6ffed'
                                : analysis.migration_potential === 'medium'
                                  ? '#fffbe6'
                                  : '#fafafa',
                            color:
                              analysis.migration_potential === 'high'
                                ? '#52c41a'
                                : analysis.migration_potential === 'medium'
                                  ? '#faad14'
                                  : '#999',
                          }}
                        >
                          {analysis.migration_potential === 'high'
                            ? '高'
                            : analysis.migration_potential === 'medium'
                              ? '中'
                              : '低'}
                        </span>
                      </Card>
                      <Card size="small">
                        <Text strong>判断理由：</Text>
                        <Paragraph>{analysis.reason}</Paragraph>
                      </Card>
                      {analysis.innovation_points && analysis.innovation_points.length > 0 && (
                        <Card size="small">
                          <Text strong>创新点：</Text>
                          <ul>
                            {analysis.innovation_points.map((point: string, idx: number) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  ) : null;
                })()}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Excel导入弹窗 */}
      <Modal
        title="导入论文"
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Upload.Dragger
          accept=".xlsx,.xls"
          beforeUpload={(file) => {
            uploadMutation.mutate(file);
            return false;
          }}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48 }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .xlsx 和 .xls 格式的Excel文件</p>
        </Upload.Dragger>
        <Divider />
        <Alert
          message="Excel格式要求"
          description={
            <div>
              <p>必填列：标题（或题名/Title）</p>
              <p>可选列：作者、摘要、年份、期刊、卷、期、页码、预览链接</p>
              <p>翻译字段：标题翻译、摘要翻译、摘要总结</p>
              <p style={{ marginTop: 8, color: '#666' }}>
                注：导入后会自动根据期刊名称归类，不存在的期刊将自动创建
              </p>
            </div>
          }
          type="info"
        />
      </Modal>

    </div>
  );
};

export default PapersListTab;
