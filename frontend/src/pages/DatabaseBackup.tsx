import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../services/api';
import { BackupStatsResponse, BackupItem } from '../types';
import { ApiResponse } from '../types/api';

const { Title, Text } = Typography;

const DatabaseBackup: React.FC = () => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [stats, setStats] = useState<BackupStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // 获取备份列表
  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response: ApiResponse<BackupItem[]> = await api.get('/api/backup/list');
      if (response.success) {
        setBackups(response.data);
      }
    } catch (error) {
      message.error('获取备份列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 获取备份统计
  const fetchStats = async () => {
    try {
      const response: ApiResponse<BackupStatsResponse> = await api.get('/api/backup/stats');
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchStats();
  }, []);

  // 创建备份
  const handleCreateBackup = async () => {
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
        setCreating(true);
        try {
          const response: ApiResponse<BackupItem> = await api.post('/api/backup/create', null, {
            params: { reason }
          });
          if (response.success) {
            message.success('备份创建成功');
            fetchBackups();
            fetchStats();
          }
        } catch (error) {
          message.error('创建备份失败');
          console.error(error);
        } finally {
          setCreating(false);
        }
      }
    });
  };

  // 恢复备份
  const handleRestore = async (backupId: string) => {
    setRestoring(backupId);
    try {
      const response: ApiResponse<{ message: string }> = await api.post(`/api/backup/restore/${backupId}`);
      if (response.success) {
        message.success('数据库恢复成功');
        // 可能需要刷新整个应用
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      message.error('恢复备份失败');
      console.error(error);
    } finally {
      setRestoring(null);
    }
  };

  // 删除备份
  const handleDelete = async (backupId: string) => {
    try {
      const response: ApiResponse<{ message: string }> = await api.delete(`/api/backup/${backupId}`);
      if (response.success) {
        message.success('备份删除成功');
        fetchBackups();
        fetchStats();
      }
    } catch (error) {
      message.error('删除备份失败');
      console.error(error);
    }
  };

  // 下载备份
  const handleDownload = async (backupId: string, backupName: string) => {
    try {
      const response = await api.get(`/api/backup/download/${backupId}`, {
        responseType: 'blob'
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${backupName}.db.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success('备份下载成功');
    } catch (error) {
      message.error('下载备份失败');
      console.error(error);
    }
  };

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
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
              loading={creating}
            >
              创建备份
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchBackups();
                fetchStats();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {loading ? (
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
      
      {/* 提示信息 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>使用说明</Title>
        <Space direction="vertical">
          <Text>• 系统会自动保留最近 {stats?.max_backups || 7} 个备份</Text>
          <Text>• 创建备份前请确保没有正在进行的重要操作</Text>
          <Text>• 恢复备份会覆盖当前所有数据，请谨慎操作</Text>
          <Text>• 建议定期下载备份到本地进行异地保存</Text>
          <Text type="danger">• 生产环境的操作请格外小心！</Text>
        </Space>
      </Card>
    </div>
  );
};

export default DatabaseBackup;