import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Typography,
  Spin,
  Empty,
  Tooltip,
  Modal,
  Input,
} from 'antd';
import {
  DownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  TeamOutlined,
  ProjectOutlined,
  MessageOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '../services/apiOptimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';
import { BackupItem } from '../types';

type BackupStatsResponse = {
  total_backups: number;
  max_backups: number;
  total_size: number;
  average_size: number;
  current_environment: string;
};

const { Title, Text } = Typography;

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

  // 获取备份统计
  const { data: stats, refetch: refetchStats } = useQuery<BackupStatsResponse>({
    queryKey: ['backup-stats'],
    queryFn: () => backupApi.getStats(),
  });

  // 创建备份mutation
  const createBackupMutation = useMutation({
    mutationFn: async (_reason: string) => {
      return await backupApi.createBackup();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
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

  // 格式化文件大小
  const formatSize = (size: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let formattedSize = size;
    
    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }
    
    return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
  };

  // 表格列配置
  const columns: ColumnsType<BackupItem> = [
    {
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <FolderOpenOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'sizeFormatted',
      key: 'size',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdFormatted',
      key: 'created',
      render: (text: string) => (
        <Space>
          <ClockCircleOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '合作者',
      dataIndex: 'collaborators_count',
      key: 'collaborators',
      render: (count: number) => (
        <Space>
          <TeamOutlined />
          <Tag color={count === 0 ? 'error' : 'success'}>
            {count || 0}
          </Tag>
          {count === 0 && (
            <Tooltip title="备份中没有合作者数据">
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            </Tooltip>
          )}
        </Space>
      ),
      sorter: (a: BackupItem, b: BackupItem) => (a.collaborators_count || 0) - (b.collaborators_count || 0),
    },
    {
      title: '项目',
      dataIndex: 'projects_count',
      key: 'projects',
      render: (count: number) => (
        <Space>
          <ProjectOutlined />
          <Tag color={count === 0 ? 'error' : 'success'}>
            {count || 0}
          </Tag>
          {count === 0 && (
            <Tooltip title="备份中没有项目数据">
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            </Tooltip>
          )}
        </Space>
      ),
      sorter: (a: BackupItem, b: BackupItem) => (a.projects_count || 0) - (b.projects_count || 0),
    },
    {
      title: '日志',
      dataIndex: 'logs_count',
      key: 'logs',
      render: (count: number) => (
        <Space>
          <MessageOutlined />
          <Tag color={count === 0 ? 'warning' : 'processing'}>
            {count || 0}
          </Tag>
        </Space>
      ),
      sorter: (a: BackupItem, b: BackupItem) => (a.logs_count || 0) - (b.logs_count || 0),
    },
    {
      title: 'Ideas',
      dataIndex: 'ideas_count',
      key: 'ideas',
      render: (count: number) => (
        <Space>
          <BulbOutlined />
          <Tag color={count === 0 ? 'warning' : 'success'}>
            {count || 0}
          </Tag>
        </Space>
      ),
      sorter: (a: BackupItem, b: BackupItem) => (a.ideas_count || 0) - (b.ideas_count || 0),
    },
    {
      title: 'Prompts',
      dataIndex: 'prompts_count',
      key: 'prompts',
      render: (count: number) => (
        <Space>
          <FileTextOutlined />
          <Tag color={count === 0 ? 'warning' : 'processing'}>
            {count || 0}
          </Tag>
        </Space>
      ),
      sorter: (a: BackupItem, b: BackupItem) => (a.prompts_count || 0) - (b.prompts_count || 0),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="下载备份">
            <Button
              type="primary"
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
    refetchStats();
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4}>
        <DatabaseOutlined /> 数据库备份管理
      </Title>
      
      {/* 统计信息 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="备份总数"
                value={stats.total_backups}
                suffix={`/ ${stats.max_backups}`}
                prefix={<SaveOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总大小"
                value={formatSize(stats.total_size)}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均大小"
                value={formatSize(stats.average_size)}
                prefix={<FolderOpenOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="当前环境"
                value={stats.current_environment}
                valueStyle={{ 
                  color: stats.current_environment === 'production' ? '#cf1322' : '#3f8600' 
                }}
              />
            </Card>
          </Col>
        </Row>
      )}
      
      {/* 操作按钮 */}
      <Card 
        title="备份列表"
        extra={
          <Space>
            <Button
              type="primary"
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
      >
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
      </Card>
    </div>
  );
};

export default DatabaseBackup;