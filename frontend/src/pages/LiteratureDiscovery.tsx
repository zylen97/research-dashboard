import React, { useState } from 'react';
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
  Tooltip,
  message,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Select,
  Progress,
  Alert,
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
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { literatureApi } from '../services/api';
import { Literature, LiteratureCreate, ValidationRequest } from '../types';
import { useAuth } from '../contexts/AuthContext';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const LiteratureDiscovery: React.FC = () => {
  const { user } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState('zl');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false);
  const [editingLiterature, setEditingLiterature] = useState<Literature | null>(null);
  const [convertingLiterature, setConvertingLiterature] = useState<Literature | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isBatchMatchingModalVisible, setIsBatchMatchingModalVisible] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState({ current: 0, total: 0 });
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

  // 创建文献mutation
  const createLiteratureMutation = useMutation({
    mutationFn: literatureApi.createLiterature,
    onSuccess: () => {
      message.success('文献创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['literature'] });
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
      queryClient.invalidateQueries({ queryKey: ['literature'] });
    },
    onError: (error) => {
      message.error('删除失败：' + error.message);
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

  // 处理表单提交
  const handleSubmit = async (values: LiteratureCreate) => {
    if (editingLiterature) {
      updateLiteratureMutation.mutate({ id: editingLiterature.id, data: values });
    } else {
      createLiteratureMutation.mutate(values);
    }
  };

  // 处理验证提交
  const handleValidation = async (values: { prompt: string }) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要验证的文献');
      return;
    }

    const request: ValidationRequest = {
      literature_ids: selectedRowKeys as number[],
      prompt: values.prompt,
    };

    validateMutation.mutate(request);
  };

  // 处理编辑
  const handleEdit = (record: Literature) => {
    setEditingLiterature(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  // 处理删除
  const handleDelete = (record: Literature) => {
    deleteLiteratureMutation.mutate(record.id);
  };

  // 处理转换为idea
  const handleConvertToIdea = (record: Literature) => {
    setConvertingLiterature(record);
    convertForm.setFieldsValue({
      title: record.title,
      description: record.abstract || `基于文献: ${record.title}`,
      tags: record.keywords,
      priority: 'medium',
    });
    setIsConvertModalVisible(true);
  };

  // 处理转换提交
  const handleConvertSubmit = (values: any) => {
    if (convertingLiterature) {
      convertToIdeaMutation.mutate({
        id: convertingLiterature.id,
        ideaData: values,
      });
    }
  };

  // 处理批量AI匹配
  const handleBatchMatching = (values: { prompt_template: string; ai_provider: string }) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要匹配的文献');
      return;
    }

    setMatchingProgress({ current: 0, total: selectedRowKeys.length });
    
    const data = {
      literature_ids: selectedRowKeys as number[],
      prompt_template: values.prompt_template,
      ai_provider: values.ai_provider,
    };

    batchMatchingMutation.mutate(data);
  };

  // 文件上传配置
  const uploadProps = {
    beforeUpload: (file: File) => {
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.type === 'application/vnd.ms-excel';
      if (!isExcel) {
        message.error('只能上传Excel文件！');
        return false;
      }
      uploadMutation.mutate(file);
      return false;
    },
    showUploadList: false,
  };

  // 文献表格列配置
  const columns: ColumnsType<Literature> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (text: string) => (
        <Tooltip title={text}>
          <div style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '280px'
          }}>
            {text}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '作者',
      dataIndex: 'authors',
      key: 'authors',
      width: 200,
      render: (text: string) => text || '-',
    },
    {
      title: '期刊',
      dataIndex: 'journal',
      key: 'journal',
      width: 150,
      render: (text: string) => text || '-',
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
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '验证状态',
      dataIndex: 'validation_status',
      key: 'validation_status',
      width: 120,
      render: (status: string, record: Literature) => {
        const statusInfo = getValidationStatus(status);
        return (
          <Tag color={statusInfo.color} icon={statusInfo.icon}>
            {statusInfo.text}
            {record.validation_score && ` (${Math.round(record.validation_score * 100)}%)`}
          </Tag>
        );
      },
      filters: [
        { text: '已验证', value: 'validated' },
        { text: '已拒绝', value: 'rejected' },
        { text: '待验证', value: 'pending' },
      ],
      onFilter: (value, record) => record.validation_status === value,
    },
    {
      title: 'AI分析结果',
      dataIndex: 'validation_reason',
      key: 'ai_response',
      width: 250,
      render: (reason: string) => {
        if (!reason) return '-';
        return (
          <Tooltip title={reason} placement="top">
            <div style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '230px',
              fontSize: '12px',
              color: '#666'
            }}>
              <RobotOutlined style={{ marginRight: 4, color: '#1890ff' }} />
              {reason}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          imported: { color: 'default', text: '已导入' },
          reviewed: { color: 'processing', text: '已审查' },
          converted_to_idea: { color: 'success', text: '已转换' },
        };
        const info = statusMap[status] || { color: 'default', text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {record.validation_status === 'validated' && record.status !== 'converted_to_idea' && (
            <Tooltip title="转换为Idea">
              <Button
                type="text"
                icon={<BulbOutlined />}
                onClick={() => handleConvertToIdea(record)}
                loading={convertToIdeaMutation.isPending}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除这篇文献吗？"
            onConfirm={() => handleDelete(record)}
            okText="删除"
            cancelText="取消"
            okType="danger"
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 文献表组件
  const LiteratureTable: React.FC<{ group: string }> = ({ group }) => {
    const groupLiterature = literature.filter(lit => {
      // 如果文献没有group_name字段，默认属于zl组
      const litGroup = lit.group_name || 'zl';
      return litGroup === group;
    });

    // 统计数据
    const stats = {
      total: groupLiterature.length,
      validated: groupLiterature.filter(l => l.validation_status === 'validated').length,
      rejected: groupLiterature.filter(l => l.validation_status === 'rejected').length,
      pending: groupLiterature.filter(l => l.validation_status === 'pending').length,
      converted: groupLiterature.filter(l => l.status === 'converted_to_idea').length,
    };

    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                导入文献
              </Button>
            </Upload>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => setIsBatchMatchingModalVisible(true)}
              loading={batchMatchingMutation.isPending}
            >
              AI批量匹配 ({selectedRowKeys.length})
            </Button>
          </Space>
          <Space>
            <Tag color="blue">共 {groupLiterature.length} 篇文献</Tag>
            {user && (
              <Tag color="green">
                <UserOutlined style={{ marginRight: 4 }} />
                {user.display_name}
              </Tag>
            )}
          </Space>
        </div>

        {/* 统计卡片 */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} lg={6}>
            <Card className="statistics-card hover-shadow">
              <Statistic title="总文献数" value={stats.total} prefix={<FileTextOutlined style={{ fontSize: 14 }} />} />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <Card className="statistics-card hover-shadow">
              <Statistic 
                title="已验证" 
                value={stats.validated} 
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined style={{ fontSize: 14 }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <Card className="statistics-card hover-shadow">
              <Statistic 
                title="待验证" 
                value={stats.pending} 
                valueStyle={{ color: '#1890ff' }}
                prefix={<SyncOutlined style={{ fontSize: 14 }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <Card className="statistics-card hover-shadow">
              <Statistic 
                title="已转换" 
                value={stats.converted} 
                valueStyle={{ color: '#722ed1' }}
                prefix={<BulbOutlined style={{ fontSize: 14 }} />}
              />
            </Card>
          </Col>
        </Row>

        {/* 文献表格 */}
        <div className="table-container">
          <Table
            size="small"
            columns={columns}
            dataSource={groupLiterature}
            rowKey="id"
            loading={isLoading}
            pagination={{
              total: groupLiterature.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              getCheckboxProps: (record) => ({
                disabled: record.validation_status !== 'pending',
              }),
            }}
            scroll={{ x: 1200 }}
          />
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={3} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 8 }} />
            Idea发掘系统
          </Title>
        </div>
      </div>

      {/* 文献管理 - 分组模式 */}
      <Tabs 
        type="card"
        onChange={(key) => {
          setSelectedGroup(key);
          setSelectedRowKeys([]);
        }}
        activeKey={selectedGroup}
      >
        <TabPane tab="ZL" key="zl">
          <LiteratureTable group="zl" />
        </TabPane>
        <TabPane tab="YQ" key="yq">
          <LiteratureTable group="yq" />
        </TabPane>
        <TabPane tab="ZZ" key="zz">
          <LiteratureTable group="zz" />
        </TabPane>
        <TabPane tab="DJ" key="dj">
          <LiteratureTable group="dj" />
        </TabPane>
      </Tabs>

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
            {/* 显示原文献信息 */}
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
              {convertingLiterature.journal && (
                <Paragraph>
                  <Text strong>期刊：</Text> {convertingLiterature.journal}
                </Paragraph>
              )}
              {convertingLiterature.abstract && (
                <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                  <Text strong>摘要：</Text> {convertingLiterature.abstract}
                </Paragraph>
              )}
            </Card>

            {/* Idea编辑表单 */}
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

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="estimated_duration"
                    label="预计耗时"
                  >
                    <Input placeholder="例如：3个月、半年等" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="required_skills"
                    label="所需技能"
                  >
                    <Input placeholder="描述完成这个idea需要的技能" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="tags"
                label="标签"
              >
                <Input placeholder="输入标签，用逗号分隔" />
              </Form.Item>
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
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {matchingProgress.current} / {matchingProgress.total}
              </Text>
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
            tooltip="选择用于文献匹配分析的AI提供商"
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
            label="选择匹配策略"
            rules={[{ required: true, message: '请选择或输入匹配提示词' }]}
            tooltip="选择预定义的匹配策略，或自定义提示词"
          >
            <Select
              placeholder="选择匹配策略或自定义"
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
              <Option value="custom">
                <Text strong>自定义提示词</Text>
              </Option>
            </Select>
            
            <TextArea 
              rows={8} 
              placeholder="输入自定义的匹配提示词..."
              style={{ fontSize: '12px' }}
            />
          </Form.Item>

          <Alert
            message="匹配说明"
            description={
              <div>
                <p>• AI将根据您提供的提示词分析每篇文献的相关性</p>
                <p>• 分析结果将显示在"AI分析结果"列中</p>
                <p>• 相关的文献状态会更新为"已验证"，不相关的会标记为"已拒绝"</p>
                <p>• 请耐心等待，批量匹配可能需要一些时间</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default LiteratureDiscovery;