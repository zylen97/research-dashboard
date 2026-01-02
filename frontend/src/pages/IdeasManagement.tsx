/**
 * Ideas管理页面 - 重新设计版本
 * 简化表单：项目名称、项目描述、研究方法、来源、负责人、成熟度
 * 包含编辑、删除、转化功能
 */
import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  Typography,
  Tag,
  message,
  Tooltip,
  Row,
  Col,
  Card,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  SwapRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import { ideasApi, collaboratorApi } from '../services/apiOptimized';
import { Idea, IdeaUpdate, MATURITY_OPTIONS } from '../types/ideas';
import { PageContainer, PageHeader, TableContainer } from '../styles/components';
import JournalSelect from '../components/JournalSelect';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const IdeasManagementPage: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [convertingIdeaId, setConvertingIdeaId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 查询合作者列表（用于下拉选择器）
  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => collaboratorApi.getList(),
  });

  // 查询Ideas列表 - 使用增强的安全方法
  const { data: ideasData = [], isLoading, refetch, error } = useQuery({
    queryKey: ['ideas'],
    queryFn: () => ideasApi.getIdeasSafe(),
    // 添加错误重试机制
    retry: (failureCount, error) => {
      // 认证错误不重试，其他错误最多重试2次
      if ((error as any)?.response?.status === 401) return false;
      return failureCount < 2;
    },
  });

  // 响应拦截器已确保返回数组
  const ideas = React.useMemo(() => {
    if (!ideasData) return [];
    // 额外安全检查：确保是数组
    if (!Array.isArray(ideasData)) {
      console.error('[IdeasManagement] 数据不是数组:', ideasData);
      return [];
    }
    return ideasData;
  }, [ideasData]);

  // 创建Idea
  const createMutation = useMutation({
    mutationFn: ideasApi.create,
    onSuccess: () => {
      message.success('Ideas创建成功');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      closeModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新Idea
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: IdeaUpdate }) =>
      ideasApi.update(id, data),
    onSuccess: () => {
      message.success('Ideas更新成功');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      closeModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 删除Idea
  const deleteMutation = useMutation({
    mutationFn: (id: number) => ideasApi.delete(id),
    onSuccess: () => {
      message.success('Ideas删除成功');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      // 刷新可能引用该Idea的项目列表和待办状态
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
      queryClient.invalidateQueries({ queryKey: ['user-todos'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  // 转化为项目 - 增强缓存同步机制
  const convertMutation = useMutation({
    mutationFn: ideasApi.convertToProject,
    onSuccess: async (response, variables) => {
      const convertedIdeaId = variables; // 转化的idea ID
      
      try {
        // 1. 立即显示成功消息
        message.success(`已成功转化为研究项目：${response.project_title}`);
        
        // 2. 乐观更新：立即从本地缓存移除已转化的idea
        queryClient.setQueryData(['ideas'], (oldData: any) => {
          if (Array.isArray(oldData)) {
            return oldData.filter(idea => idea.id !== convertedIdeaId);
          }
          return oldData;
        });
        
        // 3. 强制刷新数据确保同步
        await Promise.all([
          refetch(), // 强制重新获取Ideas列表
          queryClient.invalidateQueries({ queryKey: ['research_projects'] }) // 刷新研究项目列表
        ]);
        console.log('[IdeasManagement] 转化后缓存刷新完成');
      } catch (error) {
        console.warn('[IdeasManagement] 缓存刷新失败，但转化成功:', error);
        // 如果刷新失败，至少确保本地状态是正确的
        await refetch();
      } finally {
        // 4. 清除loading状态
        setConvertingIdeaId(null);
      }
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || '转化失败';
      message.error(errorMsg);
      
      // 转化失败时，确保数据状态正确
      refetch();
      console.error('[IdeasManagement] 转化失败:', error);
      
      // 清除loading状态
      setConvertingIdeaId(null);
    },
  });

  // 打开新增模态框
  const openCreateModal = () => {
    setEditingIdea(null);
    form.resetFields();
    form.setFieldsValue({ maturity: 'immature' }); // 设置默认值
    setModalVisible(true);
  };

  // 打开编辑模态框
  const openEditModal = (idea: Idea) => {
    setEditingIdea(idea);
    // 回填数据时，优先使用 responsible_persons，如果没有则使用 responsible_person
    form.setFieldsValue({
      ...idea,
      responsible_person_ids: Array.isArray(idea.responsible_persons)
        ? idea.responsible_persons.map(p => p.id)
        : (idea.responsible_person ? [idea.responsible_person.id] : []),
    });
    setModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingIdea(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingIdea) {
        // 更新
        updateMutation.mutate({ id: editingIdea.id, data: values });
      } else {
        // 创建
        createMutation.mutate(values);
      }
    } catch (error) {
      // 表单验证失败
      console.error('Form validation failed:', error);
    }
  };

  // 删除确认
  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // 转化为项目确认
  const handleConvert = (id: number) => {
    setConvertingIdeaId(id); // 设置正在转化的ID
    convertMutation.mutate(id);
  };

  // 表格列定义
  const columns: ColumnsType<Idea> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '研究方法',
      dataIndex: 'research_method',
      key: 'research_method',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '参考论文',
      dataIndex: 'reference_paper',
      key: 'reference_paper',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '参考期刊',
      dataIndex: 'reference_journal',
      key: 'reference_journal',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '拟投稿期刊',
      dataIndex: 'target_journal',
      key: 'target_journal',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'responsible_persons',
      key: 'responsible_persons',
      width: 150,
      render: (persons: any[]) => {
        if (!persons || persons.length === 0) return '-';
        if (persons.length === 1) return persons[0].name;
        const names = persons.map(p => p.name);
        return (
          <Tooltip title={names.join(', ')}>
            <span>{names.slice(0, 2).join(', ')}{names.length > 2 ? '...' : ''}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '成熟度',
      dataIndex: 'maturity',
      key: 'maturity',
      width: 100,
      render: (maturity: string) => (
        <Tag
          style={{
            backgroundColor: maturity === 'mature' ? '#E8E8E8' : '#F5F5F5',
            color: maturity === 'mature' ? '#333333' : '#666666',
            borderColor: maturity === 'mature' ? '#CCCCCC' : '#E8E8E8',
          }}
        >
          {MATURITY_OPTIONS.find(opt => opt.value === maturity)?.label || maturity}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={convertingIdeaId === record.id ? "转化中，请稍候..." : "编辑"}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              size="small"
              disabled={convertingIdeaId === record.id}
            />
          </Tooltip>
          <Tooltip title={
            convertingIdeaId === record.id ? "正在转化为研究项目..." : 
            convertingIdeaId !== null ? "其他项目转化中，请稍候..." : 
            "转化为研究项目"
          }>
            <Popconfirm
              title="确认转化"
              description="转化后将从Ideas列表中删除，并在研究看板中创建新项目"
              onConfirm={() => handleConvert(record.id)}
              okText="确认"
              cancelText="取消"
              disabled={convertingIdeaId !== null}
            >
              <Button
                type="text"
                icon={<SwapRightOutlined />}
                size="small"
                loading={convertingIdeaId === record.id}
                disabled={convertingIdeaId !== null && convertingIdeaId !== record.id}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={convertingIdeaId === record.id ? "转化中，请稍候..." : "删除"}>
            <Popconfirm
              title="确认删除"
              description="删除后不可恢复"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
                loading={deleteMutation.isPending}
                disabled={convertingIdeaId === record.id}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* 统计卡片 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card className="statistics-card hover-shadow">
            <Statistic
              title="想法总数"
              value={ideas?.length || 0}
              valueStyle={{ color: '#333333' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="statistics-card hover-shadow">
            <Statistic
              title="成熟想法"
              value={ideas?.filter((idea: Idea) => idea.maturity === 'mature').length || 0}
              valueStyle={{ color: '#333333' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="statistics-card hover-shadow">
            <Statistic
              title="待评估"
              value={ideas?.filter((idea: Idea) => !idea.maturity || idea.maturity === 'immature').length || 0}
              valueStyle={{ color: '#666666' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 页面标题和操作区 */}
      <PageHeader
        title={<Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
          <BulbOutlined style={{ marginRight: 8, color: '#666666' }} />
          Idea面板
        </Title>}
        actions={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              新增Idea
            </Button>
          </Space>
        }
      />

      {/* 表格区域 */}
      <TableContainer>
        <Table
          columns={columns}
          dataSource={ideas}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            defaultPageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
          }}
          locale={{
            emptyText: error
              ? `数据加载失败: ${error.message || '请检查网络连接'}`
              : '暂无数据'
          }}
        />
      </TableContainer>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingIdea ? '编辑 Idea' : '新增 Idea'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={800}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={true}
        >
          <Form.Item
            name="project_name"
            label="项目名称"
            rules={[
              { required: true, message: '请输入项目名称' },
              { max: 200, message: '项目名称不能超过200字符' }
            ]}
          >
            <Input placeholder="简洁明确的项目名称" />
          </Form.Item>

          <Form.Item
            name="project_description"
            label="项目描述"
            rules={[
              { required: true, message: '请输入项目描述' },
              { max: 2000, message: '项目描述不能超过2000字符' }
            ]}
          >
            <TextArea
              rows={3}
              placeholder="详细描述这个项目的内容和目标"
            />
          </Form.Item>

          <Form.Item
            name="research_method"
            label="研究方法"
            rules={[
              { required: true, message: '请输入研究方法' },
              { max: 1000, message: '研究方法不能超过1000字符' }
            ]}
          >
            <TextArea
              rows={2}
              placeholder="描述计划采用的研究方法"
            />
          </Form.Item>

          <Form.Item
            name="reference_paper"
            label="参考论文（可选）"
            rules={[{ max: 1000, message: '参考论文不能超过1000字符' }]}
          >
            <TextArea
              rows={2}
              placeholder="请输入参考论文的标题或内容"
            />
          </Form.Item>

          <Form.Item
            name="reference_journal"
            label="参考期刊（可选）"
            rules={[{ max: 200, message: '参考期刊不能超过200字符' }]}
          >
            <JournalSelect placeholder="从期刊库选择" />
          </Form.Item>

          <Form.Item
            name="target_journal"
            label="拟投稿期刊（可选）"
            rules={[{ max: 200, message: '拟投稿期刊不能超过200字符' }]}
          >
            <JournalSelect placeholder="从期刊库选择" />
          </Form.Item>

          <Form.Item
            name="responsible_person_ids"
            label="负责人"
            rules={[
              { required: true, message: '请选择负责人' },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="选择负责人（可多选）"
              showSearch
              filterOption={(input, option) =>
                (option?.children?.toString() || '').toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {Array.isArray(collaborators) && collaborators.map((collaborator: any) => (
                <Select.Option key={collaborator.id} value={collaborator.id}>
                  {collaborator.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="maturity"
            label="成熟度"
            rules={[{ required: true, message: '请选择成熟度' }]}
          >
            <Select placeholder="选择想法的成熟度">
              {MATURITY_OPTIONS.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default IdeasManagementPage;