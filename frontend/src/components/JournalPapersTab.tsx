/**
 * 期刊论文Tab组件
 * 显示期刊下的论文列表，支持导入和批量分析
 */
import React, { useState, useMemo } from 'react';
import {
  Button,
  Upload,
  Table,
  Space,
  Modal,
  Input,
  Typography,
  Card,
  message,
  Popconfirm,
  Alert,
  Divider,
  Select,
  Descriptions,
} from 'antd';
import {
  UploadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  RocketOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import { journalApi, paperApi } from '../services/apiOptimized';
import { Paper } from '../types/papers';
import { AIConfigUpdate } from '../types/ai';
import AIAnalysisConfigModal from './AIAnalysisConfigModal';
import {
  AVAILABLE_COLUMNS,
  COLUMN_VISIBILITY_KEYS,
  createOptionalColumnDefinitions,
  useColumnVisibility,
} from './papers';
import PaperStatsCards from './papers/PaperStatsCards';
import ColumnFilter from './papers/ColumnFilter';
import { FilterSection } from '../styles/components';

const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface JournalPapersTabProps {
  journalId: number;
  journalName: string;
}

const JournalPapersTab: React.FC<JournalPapersTabProps> = ({ journalId, journalName }) => {
  const queryClient = useQueryClient();

  // 状态管理
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [isAIConfigModalVisible, setIsAIConfigModalVisible] = useState(false);
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

  // Excel导入
  const uploadMutation = useMutation({
    mutationFn: (file: File) => journalApi.importPapersToJournal(journalId, file),
    onSuccess: (data) => {
      const importedCount = data?.data?.imported_count || 0;
      message.success(`成功导入 ${importedCount} 篇论文`);
      queryClient.invalidateQueries({ queryKey: ['journal-papers', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journal-detail', journalId] });
      refetchStats();
      setIsImportModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '导入失败');
    },
  });

  // 批量AI分析
  const analyzeMutation = useMutation({
    mutationFn: (aiConfig: AIConfigUpdate | null) =>
      journalApi.analyzeJournalPapers(journalId, aiConfig, 'pending', 3),
    onSuccess: (data) => {
      const successCount = data?.data?.analyzed_count || 0;
      const totalCount = data?.data?.details?.total || 0;
      message.success(`分析完成：${successCount}/${totalCount} 篇成功`);
      queryClient.invalidateQueries({ queryKey: ['journal-papers', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journal-detail', journalId] });
      refetchStats();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '分析失败');
    },
  });

  // 处理批量分析按钮点击
  const handleBatchAnalyze = () => {
    const pendingCount = papers.filter(p => p.status === 'pending').length;
    if (pendingCount === 0) {
      message.info('没有待分析的论文');
      return;
    }
    setIsAIConfigModalVisible(true);
  };

  // 处理AI配置确认
  const handleAIConfigConfirm = (config: AIConfigUpdate) => {
    analyzeMutation.mutate(config);
  };

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
          {record.status === 'analyzed' && (
            <Popconfirm
              title="确认转换？"
              description="将此论文转换为Idea"
              onConfirm={() => convertMutation.mutate(record.id)}
            >
              <Button type="link" size="small" icon={<RocketOutlined />}>
                转换
              </Button>
            </Popconfirm>
          )}
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

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <FilterSection
          actionButtons={
            <>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setIsImportModalVisible(true)}
              >
                导入Excel
              </Button>
              <Button
                icon={<RocketOutlined />}
                onClick={handleBatchAnalyze}
                loading={analyzeMutation.isPending}
              >
                批量分析
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
                  批量删除 ({selectedRowKeys.length})
                </Button>
              )}
            </>
          }
          filterControls={
            <Space size="small">
              <Select
                placeholder="筛选状态"
                allowClear
                style={{ width: 120 }}
                onChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
                value={statusFilter}
              >
                <Select.Option value="pending">待分析</Select.Option>
                <Select.Option value="analyzed">已分析</Select.Option>
                <Select.Option value="converted">已转换</Select.Option>
              </Select>
              <Input.Search
                placeholder="搜索标题、作者"
                allowClear
                style={{ width: 180 }}
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
          }
        />
      </Card>

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

      {/* Excel导入弹窗 */}
      <Modal
        title={`导入论文到: ${journalName}`}
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Dragger
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
        </Dragger>
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

      {/* 论文详情抽屉 */}
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

      {/* AI分析配置弹窗 */}
      <AIAnalysisConfigModal
        visible={isAIConfigModalVisible}
        onClose={() => setIsAIConfigModalVisible(false)}
        onConfirm={handleAIConfigConfirm}
        paperCount={papers.filter(p => p.status === 'pending').length}
      />
    </div>
  );
};

export default JournalPapersTab;
