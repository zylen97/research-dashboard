import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Upload,
  Tag,
  Typography,
  Space,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Tooltip,
  message,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Select,
  Progress,
  Alert,
  Layout,
  Tabs,
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  BulbOutlined,
  FileTextOutlined,
  RobotOutlined,
  PlusOutlined,
  FolderOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { literatureApi, folderApi } from '../services/api';
import { Literature, LiteratureCreate, ValidationRequest, FolderTreeNode } from '../types';
import type { ColumnsType } from 'antd/es/table';
import FolderTree from '../components/common/FolderTree';
import LiteratureDetail from '../components/common/LiteratureDetail';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Sider, Content } = Layout;

const LiteratureDiscovery: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState('zl');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedFolderData, setSelectedFolderData] = useState<FolderTreeNode | null>(null);
  const [selectedLiterature, setSelectedLiterature] = useState<Literature | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false);
  const [editingLiterature, setEditingLiterature] = useState<Literature | null>(null);
  const [convertingLiterature, setConvertingLiterature] = useState<Literature | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isBatchMatchingModalVisible, setIsBatchMatchingModalVisible] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState({ current: 0, total: 0 });
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [form] = Form.useForm();
  const [validationForm] = Form.useForm();
  const [batchMatchingForm] = Form.useForm();
  const [convertForm] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取文献数据
  const { data: literature = [], isLoading } = useQuery({
    queryKey: ['literature'],
    queryFn: () => literatureApi.getLiterature(),
  });

  // 获取当前选中文件夹的文献数据
  const { data: folderLiterature = [], isLoading: isFolderLiteratureLoading } = useQuery({
    queryKey: ['folder-literature', selectedFolderId],
    queryFn: () => selectedFolderId 
      ? folderApi.getFolderLiterature(selectedFolderId) 
      : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  // 获取预定义prompts
  const { data: promptsData = [] } = useQuery({
    queryKey: ['literature-prompts'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/literature/prompts', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('获取prompts失败:', error);
        return [];
      }
    },
  });

  // 获取AI providers
  const { data: providersData = [] } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/config/ai/providers', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('获取AI providers失败:', error);
        return [];
      }
    },
  });

  // 计算当前显示的文献列表
  const displayedLiterature = useMemo(() => {
    // 如果选中了文件夹，显示文件夹内的文献
    if (selectedFolderId) {
      return folderLiterature;
    }
    
    // 否则根据分组筛选文献
    return literature.filter(item => {
      if (!item.group_name) return selectedGroup === 'zl'; // 默认分组
      return item.group_name === selectedGroup;
    });
  }, [literature, folderLiterature, selectedFolderId, selectedGroup]);

  // 统计数据
  const stats = useMemo(() => {
    const total = displayedLiterature.length;
    const validated = displayedLiterature.filter(item => item.validation_status === 'validated').length;
    const pending = displayedLiterature.filter(item => item.validation_status === 'pending').length;
    const converted = displayedLiterature.filter(item => item.status === 'converted_to_idea').length;
    
    return { total, validated, pending, converted };
  }, [displayedLiterature]);

  // 创建文献mutation
  const createLiteratureMutation = useMutation({
    mutationFn: literatureApi.createLiterature,
    onSuccess: () => {
      message.success('文献创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('创建失败：' + error.message);
    },
  });

  // 更新文献mutation
  const updateLiteratureMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      literatureApi.updateLiterature(id, data),
    onSuccess: () => {
      message.success('文献更新成功！');
      setIsModalVisible(false);
      setEditingLiterature(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除文献mutation
  const deleteLiteratureMutation = useMutation({
    mutationFn: literatureApi.deleteLiterature,
    onSuccess: () => {
      message.success('文献删除成功！');
      setSelectedLiterature(null);
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 批量删除文献mutation
  const batchDeleteMutation = useMutation({
    mutationFn: literatureApi.batchDeleteLiterature,
    onSuccess: (response) => {
      if (response.success) {
        message.success(response.message);
        if (response.errors.length > 0) {
          Modal.warning({
            title: '部分删除失败',
            content: (
              <div>
                <p>成功删除 {response.deleted_count} 篇文献</p>
                <p>失败原因：</p>
                <ul style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {response.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ),
          });
        }
      } else {
        message.error(response.message);
      }
      setSelectedRowKeys([]);
      setSelectedLiterature(null);
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('批量删除失败：' + error.message);
    },
  });

  // 上传文件mutation
  const uploadMutation = useMutation({
    mutationFn: literatureApi.uploadLiteratureFile,
    onSuccess: (response) => {
      message.success(`成功导入 ${response.imported_count} 条文献记录`);
      if (response.errors.length > 0) {
        Modal.warning({
          title: '导入警告',
          content: (
            <div>
              <p>部分数据导入失败：</p>
              <ul style={{ maxHeight: '200px', overflow: 'auto' }}>
                {response.errors.slice(0, 10).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {response.errors.length > 10 && <li>...</li>}
              </ul>
            </div>
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('文件上传失败：' + error.message);
    },
  });

  // 验证文献mutation
  const validateMutation = useMutation({
    mutationFn: literatureApi.validateLiterature,
    onSuccess: (results) => {
      const successCount = results.filter(r => r.status === 'validated').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      if (errorCount === 0) {
        message.success(`验证完成！成功验证 ${successCount} 篇文献`);
      } else {
        message.warning(`验证完成！成功 ${successCount} 篇，失败 ${errorCount} 篇`);
      }
      
      setIsValidationModalVisible(false);
      validationForm.resetFields();
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('验证失败：' + error.message);
    },
  });

  // 转换为idea mutation
  const convertToIdeaMutation = useMutation({
    mutationFn: ({ id, ideaData }: { id: number; ideaData?: any }) => 
      literatureApi.convertToIdea(id, ideaData),
    onSuccess: (response) => {
      message.success(`文献已转换为idea！ID: ${response.idea_id}`);
      setIsConvertModalVisible(false);
      setConvertingLiterature(null);
      convertForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('转换失败：' + error.message);
    },
  });

  // 批量AI匹配mutation
  const batchMatchingMutation = useMutation({
    mutationFn: async (data: { literature_ids: number[]; prompt_template: string; ai_provider: string }) => {
      const response = await fetch('/api/literature/batch-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Batch matching failed');
      }
      return response.json();
    },
    onSuccess: (response) => {
      message.success(`批量匹配完成！处理${response.total_processed}篇文献，成功${response.successful_count}篇`);
      setIsBatchMatchingModalVisible(false);
      batchMatchingForm.resetFields();
      setSelectedRowKeys([]);
      setMatchingProgress({ current: 0, total: 0 });
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      if (selectedFolderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-literature', selectedFolderId] });
      }
    },
    onError: (error) => {
      message.error('批量匹配失败：' + error.message);
      setMatchingProgress({ current: 0, total: 0 });
    },
  });

  // 获取验证状态颜色和图标
  const getValidationStatus = (status: string) => {
    switch (status) {
      case 'validated':
        return { color: 'success', icon: <CheckCircleOutlined />, text: '已验证' };
      case 'rejected':
        return { color: 'error', icon: <CloseCircleOutlined />, text: '已拒绝' };
      case 'pending':
        return { color: 'processing', icon: <SyncOutlined />, text: '待验证' };
      default:
        return { color: 'default', icon: null, text: '未知' };
    }
  };

  // 处理文件夹选择
  const handleFolderSelect = (folderId: number | null, folderData?: FolderTreeNode) => {
    setSelectedFolderId(folderId);
    setSelectedFolderData(folderData || null);
    setSelectedLiterature(null);
    setSelectedRowKeys([]);
  };

  // 处理行选择
  const handleRowSelect = (literature: Literature) => {
    setSelectedLiterature(literature);
  };

  // 处理表单提交
  const handleSubmit = (values: any) => {
    const data: LiteratureCreate = {
      ...values,
      citation_count: values.citation_count || 0,
    };

    if (editingLiterature) {
      updateLiteratureMutation.mutate({
        id: editingLiterature.id,
        data: {
          ...data,
          folder_id: selectedFolderId, // 如果在文件夹中创建，自动关联
        },
      });
    } else {
      createLiteratureMutation.mutate({
        ...data,
        folder_id: selectedFolderId, // 如果在文件夹中创建，自动关联
      });
    }
  };

  // 处理验证提交
  const handleValidation = (values: any) => {
    const data: ValidationRequest = {
      literature_ids: selectedRowKeys as number[],
      prompt: values.prompt,
    };
    validateMutation.mutate(data);
  };

  // 处理转换提交
  const handleConvertSubmit = (values: any) => {
    if (!convertingLiterature) return;
    
    convertToIdeaMutation.mutate({
      id: convertingLiterature.id,
      ideaData: {
        ...values,
        group_name: selectedGroup, // 继承当前分组
      },
    });
  };

  // 处理批量匹配
  const handleBatchMatching = (values: any) => {
    setMatchingProgress({ current: 0, total: selectedRowKeys.length });
    
    batchMatchingMutation.mutate({
      literature_ids: selectedRowKeys as number[],
      prompt_template: values.prompt_template,
      ai_provider: values.ai_provider,
    });
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的文献');
      return;
    }

    Modal.confirm({
      title: '批量删除文献',
      content: `确定要删除选中的 ${selectedRowKeys.length} 篇文献吗？此操作不可撤销。`,
      onOk: () => {
        batchDeleteMutation.mutate({
          literature_ids: selectedRowKeys as number[],
        });
      },
    });
  };

  // 处理编辑文献
  const handleEditLiterature = (literature: Literature) => {
    setEditingLiterature(literature);
    form.setFieldsValue(literature);
    setIsModalVisible(true);
  };

  // 处理删除文献
  const handleDeleteLiterature = (literature: Literature) => {
    Modal.confirm({
      title: '删除文献',
      content: `确定要删除文献"${literature.title}"吗？`,
      onOk: () => {
        deleteLiteratureMutation.mutate(literature.id);
      },
    });
  };

  // 处理转换为idea
  const handleConvertToIdea = (literature: Literature) => {
    setConvertingLiterature(literature);
    convertForm.setFieldsValue({
      title: `基于"${literature.title}"的研究idea`,
      description: literature.abstract ? 
        `基于文献"${literature.title}"提出的研究想法。\n\n原文摘要：${literature.abstract}` :
        `基于文献"${literature.title}"提出的研究想法。`,
    });
    setIsConvertModalVisible(true);
  };

  // 表格列定义
  const columns: ColumnsType<Literature> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <a 
          onClick={() => handleRowSelect(record)}
          style={{ 
            fontWeight: selectedLiterature?.id === record.id ? 'bold' : 'normal',
            color: selectedLiterature?.id === record.id ? '#1890ff' : undefined
          }}
        >
          {text}
        </a>
      ),
    },
    {
      title: '作者',
      dataIndex: 'authors',
      key: 'authors',
      width: 200,
      ellipsis: true,
    },
    {
      title: '期刊',
      dataIndex: 'journal',
      key: 'journal',
      width: 150,
      ellipsis: true,
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      sorter: (a, b) => (a.year || 0) - (b.year || 0),
    },
    {
      title: '引用数',
      dataIndex: 'citation_count',
      key: 'citation_count',
      width: 80,
      sorter: (a, b) => a.citation_count - b.citation_count,
    },
    {
      title: '验证状态',
      dataIndex: 'validation_status',
      key: 'validation_status',
      width: 100,
      render: (status) => {
        const statusInfo = getValidationStatus(status);
        return (
          <Tag color={statusInfo.color} icon={statusInfo.icon}>
            {statusInfo.text}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditLiterature(record);
              }}
            />
          </Tooltip>
          <Tooltip title="转为Idea">
            <Button
              type="text"
              icon={<BulbOutlined />}
              size="small"
              disabled={record.status === 'converted_to_idea'}
              onClick={(e) => {
                e.stopPropagation();
                handleConvertToIdea(record);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除这篇文献吗？"
            onConfirm={() => handleDeleteLiterature(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 页面标题 */}
      <div className="page-header" style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title level={3} style={{ margin: 0 }}>
              <BookOutlined style={{ marginRight: 8 }} />
              文献管理系统
            </Title>
          </div>
          
          {/* 分组切换 */}
          <Tabs 
            type="card"
            size="small"
            onChange={(key) => {
              setSelectedGroup(key);
              setSelectedFolderId(null);
              setSelectedLiterature(null);
              setSelectedRowKeys([]);
            }}
            activeKey={selectedGroup}
          >
            <TabPane tab="ZL" key="zl" />
            <TabPane tab="YQ" key="yq" />
            <TabPane tab="ZZ" key="zz" />
            <TabPane tab="DJ" key="dj" />
          </Tabs>
        </div>
      </div>

      {/* 三栏布局 */}
      <Layout style={{ flex: 1 }}>
        {/* 左侧文件夹树 */}
        <Sider
          collapsible
          collapsed={leftCollapsed}
          onCollapse={setLeftCollapsed}
          width={280}
          collapsedWidth={0}
          trigger={null}
          style={{ 
            background: 'white',
            borderRight: '1px solid #f0f0f0'
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text strong>
                <FolderOutlined style={{ marginRight: 8 }} />
                文件夹
              </Text>
              <Button
                type="text"
                size="small"
                icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setLeftCollapsed(!leftCollapsed)}
              />
            </div>
          </div>
          
          <div style={{ padding: 16, height: 'calc(100% - 60px)' }}>
            <FolderTree
              selectedFolderId={selectedFolderId}
              onFolderSelect={handleFolderSelect}
              showLiteratureCount={true}
              allowEdit={true}
              height={400}
            />
          </div>
        </Sider>

        {/* 中间文献列表 */}
        <Content style={{ padding: 16, background: 'white', overflow: 'hidden' }}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 操作栏和统计 */}
            <div style={{ marginBottom: 16 }}>
              {/* 面包屑 */}
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Text type="secondary">当前位置：</Text>
                  <Text strong>{selectedGroup.toUpperCase()}</Text>
                  {selectedFolderData && (
                    <>
                      <Text type="secondary"> / </Text>
                      <Text strong>{selectedFolderData.name}</Text>
                    </>
                  )}
                </Space>
              </div>

              {/* 操作按钮 */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 12 
              }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingLiterature(null);
                      form.resetFields();
                      setIsModalVisible(true);
                    }}
                  >
                    新增文献
                  </Button>
                  <Upload
                    accept=".xlsx,.xls,.csv"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      uploadMutation.mutate(file);
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                      导入Excel
                    </Button>
                  </Upload>
                  <Button
                    icon={<CheckCircleOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={() => setIsValidationModalVisible(true)}
                  >
                    批量验证 ({selectedRowKeys.length})
                  </Button>
                  <Button
                    type="primary"
                    icon={<RobotOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={() => setIsBatchMatchingModalVisible(true)}
                    loading={batchMatchingMutation.isPending}
                  >
                    AI批量匹配 ({selectedRowKeys.length})
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={handleBatchDelete}
                    loading={batchDeleteMutation.isPending}
                  >
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </Space>
                
                <Space>
                  <Tag color="blue">共 {stats.total} 篇文献</Tag>
                </Space>
              </div>

              {/* 统计卡片 */}
              <Row gutter={12}>
                <Col span={6}>
                  <Card size="small" className="statistics-card">
                    <Statistic 
                      title="总数" 
                      value={stats.total} 
                      prefix={<FileTextOutlined />} 
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="statistics-card">
                    <Statistic 
                      title="已验证" 
                      value={stats.validated} 
                      valueStyle={{ color: '#52c41a', fontSize: 16 }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="statistics-card">
                    <Statistic 
                      title="待验证" 
                      value={stats.pending} 
                      valueStyle={{ color: '#1890ff', fontSize: 16 }}
                      prefix={<SyncOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="statistics-card">
                    <Statistic 
                      title="已转换" 
                      value={stats.converted} 
                      valueStyle={{ color: '#722ed1', fontSize: 16 }}
                      prefix={<BulbOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* 文献表格 */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Table
                size="small"
                columns={columns}
                dataSource={displayedLiterature}
                rowKey="id"
                loading={isLoading || isFolderLiteratureLoading}
                pagination={{
                  total: displayedLiterature.length,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                }}
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }}
                scroll={{ y: 'calc(100vh - 400px)' }}
                onRow={(record) => ({
                  onClick: () => handleRowSelect(record),
                  style: {
                    cursor: 'pointer',
                    backgroundColor: selectedLiterature?.id === record.id ? '#e6f7ff' : undefined,
                  },
                })}
              />
            </div>
          </div>
        </Content>

        {/* 右侧详情面板 */}
        <Sider
          collapsible
          collapsed={rightCollapsed}
          onCollapse={setRightCollapsed}
          width={400}
          collapsedWidth={0}
          trigger={null}
          reverseArrow
          style={{ 
            background: 'white',
            borderLeft: '1px solid #f0f0f0'
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text strong>
                <FileTextOutlined style={{ marginRight: 8 }} />
                文献详情
              </Text>
              <Button
                type="text"
                size="small"
                icon={rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setRightCollapsed(!rightCollapsed)}
              />
            </div>
          </div>
          
          <div style={{ height: 'calc(100% - 60px)', overflow: 'hidden' }}>
            <LiteratureDetail
              literature={selectedLiterature}
              onEdit={handleEditLiterature}
              onDelete={handleDeleteLiterature}
              onConvertToIdea={handleConvertToIdea}
            />
          </div>
        </Sider>
      </Layout>

      {/* 创建/编辑文献模态框 */}
      <Modal
        title={editingLiterature ? '编辑文献' : '新增文献'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingLiterature(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createLiteratureMutation.isPending || updateLiteratureMutation.isPending}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入文献标题' }]}
          >
            <Input placeholder="请输入文献标题" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="authors"
                label="作者"
              >
                <Input placeholder="请输入作者" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="journal"
                label="期刊"
              >
                <Input placeholder="请输入期刊名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="year"
                label="年份"
              >
                <Input type="number" placeholder="年份" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="citation_count"
                label="引用数"
              >
                <Input type="number" placeholder="引用数" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="doi"
                label="DOI"
              >
                <Input placeholder="DOI" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="keywords"
            label="关键词"
          >
            <Input placeholder="请输入关键词，用逗号分隔" />
          </Form.Item>

          <Form.Item
            name="abstract"
            label="摘要"
          >
            <TextArea rows={4} placeholder="请输入文献摘要" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={2} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量验证模态框 */}
      <Modal
        title="批量验证文献"
        open={isValidationModalVisible}
        onCancel={() => {
          setIsValidationModalVisible(false);
          validationForm.resetFields();
        }}
        onOk={() => validationForm.submit()}
        confirmLoading={validateMutation.isPending}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>已选择 <Text strong>{selectedRowKeys.length}</Text> 篇文献进行验证</Text>
        </div>
        
        <Form
          form={validationForm}
          layout="vertical"
          onFinish={handleValidation}
        >
          <Form.Item
            name="prompt"
            label="验证提示词"
            rules={[{ required: true, message: '请输入验证提示词' }]}
            tooltip="描述您的研究兴趣和要求，AI将根据此提示词评估文献的相关性"
          >
            <TextArea 
              rows={6} 
              placeholder="例如：我研究的是深度学习在自然语言处理中的应用，特别关注Transformer架构和注意力机制。请评估这些文献是否与我的研究方向相关，是否具有参考价值..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 转换为Idea模态框 */}
      <Modal
        title="转换文献为Idea"
        open={isConvertModalVisible}
        onCancel={() => {
          setIsConvertModalVisible(false);
          setConvertingLiterature(null);
          convertForm.resetFields();
        }}
        onOk={() => convertForm.submit()}
        confirmLoading={convertToIdeaMutation.isPending}
        width={800}
      >
        {convertingLiterature && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Title level={5}>原文献信息</Title>
              <Paragraph>
                <Text strong>标题：</Text> {convertingLiterature.title}
              </Paragraph>
              {convertingLiterature.authors && (
                <Paragraph>
                  <Text strong>作者：</Text> {convertingLiterature.authors}
                </Paragraph>
              )}
              {convertingLiterature.abstract && (
                <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                  <Text strong>摘要：</Text> {convertingLiterature.abstract}
                </Paragraph>
              )}
            </Card>

            <Form
              form={convertForm}
              layout="vertical"
              onFinish={handleConvertSubmit}
            >
              <Form.Item
                name="title"
                label="Idea标题"
                rules={[{ required: true, message: '请输入idea标题' }]}
              >
                <Input placeholder="请输入idea标题" />
              </Form.Item>

              <Form.Item
                name="description"
                label="详细描述"
                rules={[{ required: true, message: '请输入详细描述' }]}
              >
                <TextArea 
                  rows={4} 
                  placeholder="请详细描述这个idea的核心内容、目标和价值"
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="priority"
                    label="优先级"
                    initialValue="medium"
                  >
                    <Select>
                      <Select.Option value="high">高</Select.Option>
                      <Select.Option value="medium">中</Select.Option>
                      <Select.Option value="low">低</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="difficulty_level"
                    label="难度等级"
                  >
                    <Select placeholder="选择难度">
                      <Select.Option value="easy">简单</Select.Option>
                      <Select.Option value="medium">中等</Select.Option>
                      <Select.Option value="hard">困难</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="potential_impact"
                    label="潜在影响"
                  >
                    <Select placeholder="选择潜在影响">
                      <Select.Option value="low">低</Select.Option>
                      <Select.Option value="medium">中</Select.Option>
                      <Select.Option value="high">高</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </div>
        )}
      </Modal>

      {/* 批量AI匹配模态框 */}
      <Modal
        title="AI批量匹配文献"
        open={isBatchMatchingModalVisible}
        onCancel={() => {
          if (!batchMatchingMutation.isPending) {
            setIsBatchMatchingModalVisible(false);
            batchMatchingForm.resetFields();
            setMatchingProgress({ current: 0, total: 0 });
          }
        }}
        onOk={() => batchMatchingForm.submit()}
        confirmLoading={batchMatchingMutation.isPending}
        width={800}
        closable={!batchMatchingMutation.isPending}
        maskClosable={false}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message={`已选择 ${selectedRowKeys.length} 篇文献进行AI匹配`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          {batchMatchingMutation.isPending && (
            <div style={{ marginBottom: 16 }}>
              <Text>匹配进度：</Text>
              <Progress
                percent={matchingProgress.total > 0 ? Math.round((matchingProgress.current / matchingProgress.total) * 100) : 0}
                status="active"
                strokeColor="#1890ff"
              />
            </div>
          )}
        </div>
        
        <Form
          form={batchMatchingForm}
          layout="vertical"
          onFinish={handleBatchMatching}
          disabled={batchMatchingMutation.isPending}
        >
          <Form.Item
            name="ai_provider"
            label="选择AI提供商"
            rules={[{ required: true, message: '请选择AI提供商' }]}
          >
            <Select placeholder="选择AI提供商" size="large">
              {providersData.map((provider: any) => (
                <Option key={provider.provider} value={provider.provider}>
                  <Space>
                    <RobotOutlined />
                    {provider.provider} {provider.model && `(${provider.model})`}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="prompt_template"
            label="匹配策略"
            rules={[{ required: true, message: '请选择或输入匹配提示词' }]}
          >
            <Select
              placeholder="选择匹配策略"
              size="large"
              style={{ marginBottom: 8 }}
              onChange={(value) => {
                if (value) {
                  const selectedPrompt = promptsData.find((p: any) => p.id === value);
                  if (selectedPrompt) {
                    batchMatchingForm.setFieldsValue({
                      prompt_template: selectedPrompt.template
                    });
                  }
                }
              }}
              allowClear
            >
              {promptsData.map((prompt: any) => (
                <Option key={prompt.id} value={prompt.id}>
                  <div>
                    <Text strong>{prompt.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {prompt.template.substring(0, 100)}...
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
            
            <TextArea 
              rows={8} 
              placeholder="输入自定义的匹配提示词..."
              style={{ fontSize: '12px' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiteratureDiscovery;