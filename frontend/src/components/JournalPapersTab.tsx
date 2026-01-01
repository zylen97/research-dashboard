/**
 * 期刊论文Tab组件
 * 显示期刊下的论文列表
 */
import React, { useState, useMemo } from 'react';
import {
  Button,
  Table,
  Space,
  Modal,
  Input,
  Typography,
  Card,
  message,
  Popconfirm,
  Divider,
  Select,
  Descriptions,
} from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import { journalApi, paperApi } from '../services/apiOptimized';
import { Paper } from '../types/papers';
import {
  AVAILABLE_COLUMNS,
  COLUMN_VISIBILITY_KEYS,
  createOptionalColumnDefinitions,
  useColumnVisibility,
} from './papers';
import PaperStatsCards from './papers/PaperStatsCards';
import ColumnFilter from './papers/ColumnFilter';

const { Text, Paragraph } = Typography;

interface JournalPapersTabProps {
  journalId: number;
  journalName: string;
}

const JournalPapersTab: React.FC<JournalPapersTabProps> = ({ journalId, journalName: _journalName }) => {
  const queryClient = useQueryClient();

  // 状态管理
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  // 列可见性管理
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    COLUMN_VISIBILITY_KEYS.JOURNAL_PAPERS,
    false
  );

  // 查询论文列表
  const {
    data: papersResponse,
    isLoading,
    refetch,
  } = useQuery<{ items: Paper[]; total: number; page: number; page_size: number }>({
    queryKey: ['journal-papers', journalId, searchText, currentPage, pageSize, statusFilter],
    queryFn: () => {
      const params: { skip?: number; limit?: number; search?: string; status?: string } = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      return journalApi.getJournalPapers(journalId, params);
    },
  });

  const papers = papersResponse?.items || [];
  const totalPapers = papersResponse?.total || 0;

  // 查询期刊统计（包含论文统计）
  const { data: journalDetail, refetch: refetchStats } = useQuery({
    queryKey: ['journal-detail', journalId],
    queryFn: () => journalApi.getById(journalId),
    enabled: !!journalId,
  });

  // 删除论文
  const deleteMutation = useMutation({
    mutationFn: (id: number) => paperApi.deletePaper(id),
    onSuccess: () => {
      message.success('论文删除成功');
      queryClient.invalidateQueries({ queryKey: ['journal-papers', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journal-detail', journalId] });
      refetchStats();
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
      queryClient.invalidateQueries({ queryKey: ['journal-papers', journalId] });
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '转换失败');
    },
  });

  // 批量删除论文（期刊详情页）
  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => {
      // 调用期刊论文批量删除接口
      return journalApi.batchDeleteJournalPapers(journalId, ids);
    },
    onSuccess: (response) => {
      const deletedCount = response?.deleted_count || 0;
      message.success(`已删除 ${deletedCount} 篇论文`);
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['journal-papers', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journal-detail', journalId] });
      refetchStats();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '批量删除失败');
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

  // 动态列配置
  const columns: ColumnsType<Paper> = useMemo(() => {
    const result: ColumnsType<Paper> = [];

    // 核心列 - 标题始终显示
    result.push({
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
    });

    // 可选列 - 作者
    if (visibleColumns.includes('authors')) {
      result.push(optionalColumnDefs.authors);
    }

    result.push({
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      render: (year: number | null) => year ?? '-',
    });

    result.push({
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: '待分析', color: '#999' },
          analyzed: { text: '已分析', color: '#333' },
          converted: { text: '已转换', color: '#1890ff' },
        };
        const config = statusMap[status] || { text: status, color: '#999' };
        return <span style={{ color: config.color }}>{config.text}</span>;
      },
    });

    // 可选列 - 摘要
    if (visibleColumns.includes('abstract')) {
      result.push(optionalColumnDefs.abstract);
    }

    // 可选列 - 摘要总结
    if (visibleColumns.includes('abstract_summary')) {
      result.push(optionalColumnDefs.abstract_summary);
    }

    // 可选列 - AI分析
    if (visibleColumns.includes('ai_analysis')) {
      result.push(optionalColumnDefs.ai_analysis);
    }

    // 预览链接
    result.push(optionalColumnDefs.link);

    // 操作列
    result.push({
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: Paper) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPaper(record);
              setIsDetailDrawerVisible(true);
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

  // 统计卡片
  const paperStats = (journalDetail as any)?.paper_stats;

  return (
    <div>
      {/* 统计卡片 */}
      <PaperStatsCards stats={paperStats} loading={isLoading} />

      {/* 筛选和操作栏 */}
      <div style={{ padding: '8px 0', marginBottom: 16 }}>
        <Space size="middle" style={{ width: '100%' }}>
          {/* 左侧操作按钮 */}
          <Space size="small">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
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
              placeholder="状态"
              allowClear
              style={{ width: 100 }}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              value={statusFilter}
            >
              <Select.Option value="pending">待分析</Select.Option>
              <Select.Option value="analyzed">已分析</Select.Option>
            </Select>
            <Input.Search
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
              storageKey={COLUMN_VISIBILITY_KEYS.JOURNAL_PAPERS}
            />
          </Space>
        </Space>
      </div>

      {/* 论文列表 */}
      <Table
        columns={columns}
        dataSource={papers}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1000 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys as number[]),
        }}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: totalPapers,
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
        open={isDetailDrawerVisible}
        onCancel={() => {
          setIsDetailDrawerVisible(false);
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
              <Descriptions.Item label="作者">{selectedPaper.authors || '-'}</Descriptions.Item>
              <Descriptions.Item label="年份">{selectedPaper.year || '-'}</Descriptions.Item>
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
    </div>
  );
};

export default JournalPapersTab;
