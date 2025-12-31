/**
 * 标签管理页面
 * 提供标签的CRUD操作，支持颜色选择和期刊关联查看
 */
import React, { useState } from 'react';
import {
  Table, Button, Space, message, Popconfirm, Modal, Form, Input, Select, Tag as AntTag, Card, Typography
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TagsOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagApi } from '../services/apiOptimized';
import { Tag, TagCreate, TagUpdate } from '../types/journals';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 预定义的标签颜色
const TAG_COLORS = [
  { label: '蓝色', value: 'blue' },
  { label: '绿色', value: 'green' },
  { label: '橙色', value: 'orange' },
  { label: '红色', value: 'red' },
  { label: '紫色', value: 'purple' },
  { label: '青色', value: 'cyan' },
  { label: '洋红', value: 'magenta' },
  { label: '金色', value: 'gold' },
  { label: '灰色', value: 'default' },
];

const TagsManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const queryClient = useQueryClient();

  // 查询标签列表
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 创建标签
  const createMutation = useMutation({
    mutationFn: (data: TagCreate) => tagApi.create(data),
    onSuccess: () => {
      message.success('标签创建成功');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新标签
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TagUpdate }) => tagApi.update(id, data),
    onSuccess: () => {
      message.success('标签更新成功');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 删除标签
  const deleteMutation = useMutation({
    mutationFn: (id: number) => tagApi.delete(id),
    onSuccess: () => {
      message.success('标签删除成功');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  // 打开创建/编辑模态框
  const handleOpenModal = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      form.setFieldsValue({
        name: tag.name,
        description: tag.description,
        color: tag.color,
      });
    } else {
      setEditingTag(null);
      form.resetFields();
      form.setFieldsValue({ color: 'blue' }); // 默认蓝色
    }
    setIsModalVisible(true);
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingTag(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const tagData: TagCreate = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: values.color,
      };

      if (editingTag) {
        updateMutation.mutate({ id: editingTag.id, data: tagData });
      } else {
        createMutation.mutate(tagData);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 删除标签
  const handleDelete = (tag: Tag) => {
    deleteMutation.mutate(tag.id);
  };

  // 表格列定义
  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: Tag) => (
        <AntTag color={record.color} style={{ fontSize: '14px' }}>
          {name}
        </AntTag>
      ),
    },
    {
      title: '标签描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: '使用期刊数',
      dataIndex: 'journal_count',
      key: 'journal_count',
      width: 120,
      align: 'center' as const,
      sorter: (a: Tag, b: Tag) => a.journal_count - b.journal_count,
      render: (count: number) => (
        <span style={{ fontWeight: count > 0 ? 'bold' : 'normal' }}>
          {count}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Tag) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={
              record.journal_count > 0
                ? `该标签正在被 ${record.journal_count} 个期刊使用，确定要删除吗？`
                : '确定要删除该标签吗？'
            }
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
            disabled={record.journal_count > 0}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.journal_count > 0}
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
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>
            <TagsOutlined /> 标签管理
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            新建标签
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={tags}
          rowKey="id"
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个标签`,
            defaultPageSize: 20,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 创建/编辑标签模态框 */}
      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        okText="确定"
        cancelText="取消"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="标签名称"
            rules={[
              { required: true, message: '请输入标签名称' },
              { max: 50, message: '标签名称不能超过50个字符' },
            ]}
          >
            <Input placeholder="例如：中文期刊、英文期刊、工程类期刊" />
          </Form.Item>

          <Form.Item
            name="description"
            label="标签描述"
            rules={[{ max: 200, message: '描述不能超过200个字符' }]}
          >
            <TextArea rows={3} placeholder="选填，描述该标签的用途或范围" />
          </Form.Item>

          <Form.Item name="color" label="标签颜色" initialValue="blue">
            <Select>
              {TAG_COLORS.map((color) => (
                <Option key={color.value} value={color.value}>
                  <AntTag color={color.value}>{color.label}</AntTag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TagsManagement;
