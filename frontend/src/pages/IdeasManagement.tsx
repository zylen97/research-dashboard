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
  Card,
  Typography,
  Tag,
  message,
  Tooltip,
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

import { ideasApi } from '../services/apiOptimized';
import { Idea, IdeaUpdate, MATURITY_OPTIONS } from '../types/ideas';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const IdeasManagementPage: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [convertingIdeaId, setConvertingIdeaId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

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

  // 强化数据验证 - 确保ideas绝对是数组，修复"q.some is not a function"错误
  const ideas = React.useMemo(() => {
    console.log('[IdeasManagement] 原始数据类型:', typeof ideasData, '是否为数组:', Array.isArray(ideasData), '数据:', ideasData);
    
    // 多重验证确保返回数组
    if (!ideasData) {
      console.warn('[IdeasManagement] 数据为空，返回空数组');
      return [];
    }
    
    if (!Array.isArray(ideasData)) {
      console.warn('[IdeasManagement] 接收到非数组数据，类型:', typeof ideasData, '内容:', ideasData);
      
      // 尝试从对象中提取数组
      if (typeof ideasData === 'object' && ideasData !== null) {
        // 检查是否有data字段
        if ('data' in ideasData && Array.isArray((ideasData as any).data)) {
          console.log('[IdeasManagement] 从.data字段提取数组');
          return (ideasData as any).data;
        }
        
        // 检查是否有items字段
        if ('items' in ideasData && Array.isArray((ideasData as any).items)) {
          console.log('[IdeasManagement] 从.items字段提取数组');
          return (ideasData as any).items;
        }
        
        // 如果对象可以转换为数组
        const objectValues = Object.values(ideasData);
        if (objectValues.length > 0 && objectValues.every(item => 
          typeof item === 'object' && item !== null && 'id' in item
        )) {
          console.log('[IdeasManagement] 将对象值转换为数组');
          return objectValues;
        }
      }
      
      console.error('[IdeasManagement] 无法将数据转换为数组，强制返回空数组');
      return [];
    }
    
    // 验证数组中的每个元素
    const validatedArray = ideasData.filter(item => {
      if (!item || typeof item !== 'object') {
        console.warn('[IdeasManagement] 过滤无效项目:', item);
        return false;
      }
      return true;
    });
    
    console.log('[IdeasManagement] 验证后的数组长度:', validatedArray.length);
    return validatedArray;
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
    mutationFn: ideasApi.delete,
    onSuccess: () => {
      message.success('Ideas删除成功');
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
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
    form.setFieldsValue(idea);
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
      title: '项目描述',
      dataIndex: 'project_description',
      key: 'project_description',
      width: 250,
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
      title: '来源',
      dataIndex: 'source',
      key: 'source',
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
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 120,
    },
    {
      title: '成熟度',
      dataIndex: 'maturity',
      key: 'maturity',
      width: 100,
      render: (maturity: string) => (
        <Tag color={maturity === 'mature' ? 'green' : 'orange'}>
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
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <BulbOutlined style={{ marginRight: '8px', color: '#faad14' }} />
            Idea面板
          </Title>
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
        </div>

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
          // 添加空状态和错误状态处理
          locale={{
            emptyText: error 
              ? `数据加载失败: ${error.message || '请检查网络连接'}` 
              : '暂无数据'
          }}
        />
      </Card>

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
          requiredMark={false}
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
            label="项目描述（可选）"
            rules={[{ max: 2000, message: '项目描述不能超过2000字符' }]}
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
            name="source"
            label="来源（可选）"
            rules={[{ max: 500, message: '来源信息不能超过500字符' }]}
          >
            <TextArea
              rows={2}
              placeholder="期刊、文献或其他来源信息"
            />
          </Form.Item>

          <Form.Item
            name="responsible_person"
            label="负责人"
            rules={[
              { required: true, message: '请输入负责人' },
              { max: 100, message: '负责人姓名不能超过100字符' }
            ]}
          >
            <Input placeholder="项目负责人姓名" />
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
    </div>
  );
};

export default IdeasManagementPage;