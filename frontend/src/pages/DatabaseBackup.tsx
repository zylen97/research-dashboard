import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  Typography,
  Spin,
  Empty,
  Tooltip,
  Modal,
  Input,
} from 'antd';
import { PageHeader, TableContainer } from '../styles/components';
import { ResizableTitle } from '../components/research-dashboard';
import {
  DownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  TeamOutlined,
  ProjectOutlined,
  MessageOutlined,
  BulbOutlined,
  BookOutlined,
  TagsOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '../services/apiOptimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';
import { BackupItem } from '../types';
import { useResizableColumns } from '../hooks/useResizableColumns';

const { Text } = Typography;

// 默认列宽配置
const DEFAULT_COLUMN_WIDTHS = {
  name: 200,
  size: 90,
  created: 140,
  collaborators: 80,
  projects: 80,
  ideas: 75,
  logs: 75,
  journals: 75,
  tags: 70,
  prompts: 75,
  action: 150,
};

const DatabaseBackup: React.FC = () => {
  const [restoring, setRestoring] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // 列宽调整
  const { enhanceColumns } = useResizableColumns({
    defaultColumnWidths: DEFAULT_COLUMN_WIDTHS,
    storageKey: 'backup-table-columns',
  });

  // 获取备份列表
  const { data: backups = [], isLoading: loadingBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await backupApi.getBackups();
      return (response as unknown) as BackupItem[];
    },
  });

  // 创建备份mutation
  const createBackupMutation = useMutation({
    mutationFn: async (_reason: string) => {
      return await backupApi.createBackup();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  // 恢复备份mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      setRestoring(backupId);
      return await backupApi.restoreBackup(backupId);
    },
    onSuccess: () => {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onSettled: () => {
      setRestoring(null);
    },
  });

  // 删除备份mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (backupId: string) => backupApi.deleteBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
    },
  });

  // 创建备份（使用错误处理包装器）
  const handleCreateBackup = withErrorHandler(
    async () => {
      return new Promise<void>((resolve, reject) => {
        Modal.confirm({
          title: '创建备份',
          content: (
            <Input 
              placeholder="请输入备份说明（可选）" 
              id="backup-reason"
              defaultValue="手动备份"
            />
          ),
          onOk: async () => {
            const reason = (document.getElementById('backup-reason') as HTMLInputElement)?.value || '手动备份';
            try {
              await createBackupMutation.mutateAsync(reason);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onCancel: () => {
            resolve();
          }
        });
      });
    },
    'createBackup',
    {
      successMessage: '备份创建成功',
      errorMessage: '创建备份失败',
    }
  );

  // 恢复备份（使用错误处理包装器）
  const handleRestore = withErrorHandler(
    async (backupId: string) => {
      await restoreBackupMutation.mutateAsync(backupId);
    },
    'restoreBackup',
    {
      successMessage: '数据库恢复成功',
      errorMessage: '恢复备份失败',
    }
  );

  // 删除备份（使用错误处理包装器）
  const handleDelete = withErrorHandler(
    async (backupId: string) => {
      await deleteBackupMutation.mutateAsync(backupId);
    },
    'deleteBackup',
    {
      successMessage: '备份删除成功',
      errorMessage: '删除备份失败',
    }
  );

  // 下载备份（使用错误处理包装器）
  const handleDownload = withErrorHandler(
    async (backupId: string, backupName: string) => {
      const blob = await backupApi.downloadBackup(backupId);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${backupName}.db.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    'downloadBackup',
    {
      successMessage: '备份下载成功',
      errorMessage: '下载备份失败',
    }
  );

  // 提取的通用渲染函数
  const renderCountTag = (count: number | undefined, icon: React.ReactNode) => (
    <Space size="small">
      {icon}
      <Tag style={{
        backgroundColor: count === 0 ? '#F5F5F5' : '#E8E8E8',
        color: count === 0 ? '#999999' : '#333333',
        borderColor: count === 0 ? '#E8E8E8' : '#CCCCCC'
      }}>
        {count || 0}
      </Tag>
    </Space>
  );

  // 表格列配置
  const baseColumns: ColumnsType<BackupItem> = [
    {
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      width: DEFAULT_COLUMN_WIDTHS.name,
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <FolderOpenOutlined style={{ marginTop: 2 }} />
          <Text strong style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>
            {text}
          </Text>
        </div>
      ),
    },
    {
      title: '大小',
      dataIndex: 'sizeFormatted',
      key: 'size',
      width: DEFAULT_COLUMN_WIDTHS.size,
      render: (text: string) => (
        <Tag style={{ backgroundColor: '#E8E8E8', color: '#333333', borderColor: '#CCCCCC' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdFormatted',
      key: 'created',
      width: DEFAULT_COLUMN_WIDTHS.created,
      render: (text: string) => (
        <Space style={{ fontSize: 12 }}>
          <ClockCircleOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '合作者',
      dataIndex: 'collaborators_count',
      key: 'collaborators',
      width: DEFAULT_COLUMN_WIDTHS.collaborators,
      render: (count: number) => renderCountTag(count, <TeamOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.collaborators_count || 0) - (b.collaborators_count || 0),
    },
    {
      title: '项目',
      dataIndex: 'projects_count',
      key: 'projects',
      width: DEFAULT_COLUMN_WIDTHS.projects,
      render: (count: number) => renderCountTag(count, <ProjectOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.projects_count || 0) - (b.projects_count || 0),
    },
    {
      title: 'Ideas',
      dataIndex: 'ideas_count',
      key: 'ideas',
      width: DEFAULT_COLUMN_WIDTHS.ideas,
      render: (count: number) => renderCountTag(count, <BulbOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.ideas_count || 0) - (b.ideas_count || 0),
    },
    {
      title: '日志',
      dataIndex: 'logs_count',
      key: 'logs',
      width: DEFAULT_COLUMN_WIDTHS.logs,
      render: (count: number) => renderCountTag(count, <MessageOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.logs_count || 0) - (b.logs_count || 0),
    },
    {
      title: '期刊',
      dataIndex: 'journals_count',
      key: 'journals',
      width: DEFAULT_COLUMN_WIDTHS.journals,
      render: (count: number) => renderCountTag(count, <BookOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.journals_count || 0) - (b.journals_count || 0),
    },
    {
      title: '标签',
      dataIndex: 'tags_count',
      key: 'tags',
      width: DEFAULT_COLUMN_WIDTHS.tags,
      render: (count: number) => renderCountTag(count, <TagsOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.tags_count || 0) - (b.tags_count || 0),
    },
    {
      title: '提示词',
      dataIndex: 'prompts_count',
      key: 'prompts',
      width: DEFAULT_COLUMN_WIDTHS.prompts,
      render: (count: number) => renderCountTag(count, <FileTextOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.prompts_count || 0) - (b.prompts_count || 0),
    },
    {
      title: '操作',
      key: 'action',
      width: DEFAULT_COLUMN_WIDTHS.action,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="下载备份">
            <Button
              type="default"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record.id, record.name)}
            >
              下载
            </Button>
          </Tooltip>

          <Popconfirm
            title="恢复备份"
            description="恢复此备份将覆盖当前数据库，确定要继续吗？"
            onConfirm={() => handleRestore(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="default"
              size="small"
              icon={<ReloadOutlined />}
              loading={restoring === record.id}
            >
              恢复
            </Button>
          </Popconfirm>

          <Popconfirm
            title="删除备份"
            description="确定要删除这个备份吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteBackupMutation.isPending}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const columns = enhanceColumns(baseColumns);

  return (
    <div>
      <PageHeader
        actions={
          <Space>
            <Button
              type="default"
              icon={<CloudUploadOutlined />}
              onClick={handleCreateBackup}
              loading={createBackupMutation.isPending}
            >
              创建备份
            </Button>
          </Space>
        }
      />

      {/* 备份列表 */}
      <TableContainer className="resizable-table">
        {loadingBackups ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : backups.length === 0 ? (
          <Empty description="暂无备份" />
        ) : (
          <Table
            columns={columns}
            dataSource={backups}
            rowKey="id"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个备份`,
            }}
          />
        )}
      </TableContainer>
    </div>
  );
};

export default DatabaseBackup;