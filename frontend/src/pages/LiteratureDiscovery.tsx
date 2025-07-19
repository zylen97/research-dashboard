import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
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
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { literatureApi } from '../services/api';
import { Literature, LiteratureCreate, ValidationRequest } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LiteratureDiscovery: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [editingLiterature, setEditingLiterature] = useState<Literature | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [validationForm] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取文献数据
  const { data: literature = [], isLoading } = useQuery({
    queryKey: ['literature'],
    queryFn: () => literatureApi.getLiterature(),
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
    mutationFn: literatureApi.convertToIdea,
    onSuccess: (response) => {
      message.success(`文献已转换为idea！ID: ${response.idea_id}`);
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (error) => {
      message.error('转换失败：' + error.message);
    },
  });

  // 获取验证状态颜色和图标
  const getValidationStatus = (status: string, score?: number) => {
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
    convertToIdeaMutation.mutate(record.id);
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

  // 表格列配置
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
        const statusInfo = getValidationStatus(status, record.validation_score);
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

  // 统计数据
  const stats = {
    total: literature.length,
    validated: literature.filter(l => l.validation_status === 'validated').length,
    rejected: literature.filter(l => l.validation_status === 'rejected').length,
    pending: literature.filter(l => l.validation_status === 'pending').length,
    converted: literature.filter(l => l.status === 'converted_to_idea').length,
  };

  return (
    <div>
      {/* 页面标题和操作按钮 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24 
      }}>
        <Title level={2} style={{ margin: 0 }}>
          <BookOutlined style={{ marginRight: 8 }} />
          Idea发掘系统
        </Title>
        <Space>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
              导入文献
            </Button>
          </Upload>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={() => setIsValidationModalVisible(true)}
          >
            批量验证 ({selectedRowKeys.length})
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总文献数" value={stats.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic 
              title="已验证" 
              value={stats.validated} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic 
              title="待验证" 
              value={stats.pending} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic 
              title="已转换" 
              value={stats.converted} 
              valueStyle={{ color: '#722ed1' }}
              prefix={<BulbOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 文献表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={literature}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: literature.length,
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
      </Card>

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
    </div>
  );
};

export default LiteratureDiscovery;