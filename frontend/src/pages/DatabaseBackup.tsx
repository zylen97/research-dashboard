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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '../services/apiOptimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';
import { BackupItem } from '../types';

const { Text } = Typography;

const DatabaseBackup: React.FC = () => {
  const [restoring, setRestoring] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // 获取备份列表
  const { data: backups = [], isLoading: loadingBackups, refetch: refetchBackups } = useQuery({
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
  const columns: ColumnsType<BackupItem> = [
    {
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Space>
          <FolderOpenOutlined />
          <Text strong ellipsis={{ tooltip: text }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'sizeFormatted',
      key: 'size',
      width: 90,
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
      width: 140,
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
      width: 80,
      render: (count: number) => renderCountTag(count, <TeamOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.collaborators_count || 0) - (b.collaborators_count || 0),
    },
    {
      title: '项目',
      dataIndex: 'projects_count',
      key: 'projects',
      width: 80,
      render: (count: number) => renderCountTag(count, <ProjectOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.projects_count || 0) - (b.projects_count || 0),
    },
    {
      title: 'Ideas',
      dataIndex: 'ideas_count',
      key: 'ideas',
      width: 75,
      render: (count: number) => renderCountTag(count, <BulbOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.ideas_count || 0) - (b.ideas_count || 0),
    },
    {
      title: '日志',
      dataIndex: 'logs_count',
      key: 'logs',
      width: 75,
      render: (count: number) => renderCountTag(count, <MessageOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.logs_count || 0) - (b.logs_count || 0),
    },
    {
      title: '期刊',
      dataIndex: 'journals_count',
      key: 'journals',
      width: 75,
      render: (count: number) => renderCountTag(count, <BookOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.journals_count || 0) - (b.journals_count || 0),
    },
    {
      title: '标签',
      dataIndex: 'tags_count',
      key: 'tags',
      width: 70,
      render: (count: number) => renderCountTag(count, <TagsOutlined />),
      sorter: (a: BackupItem, b: BackupItem) => (a.tags_count || 0) - (b.tags_count || 0),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
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

  const handleRefresh = () => {
    refetchBackups();
  };

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
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </Space>
        }
      />

      {/* 备份列表 */}
      <TableContainer>
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