/**
 * 标签管理面板组件
 * 可复用的标签CRUD组件，用于在期刊库Tab中嵌入
 */
import React, { useState } from 'react';
import {
  Table, Button, Space, message, Popconfirm, Modal, Form, Input, Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagApi } from '../services/apiOptimized';
import { Tag as TagType, TagCreate, TagUpdate } from '../types/journals';
import ValidationPromptModal from './ValidationPromptModal';

const { TextArea } = Input;

export const TagManagementPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // 查询标签列表
  const { data: tags = [], isLoading } = useQuery<TagType[]>({
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
  const handleOpenModal = (tag?: TagType) => {
    if (tag) {
      setEditingTag(tag);
      form.setFieldsValue({
        name: tag.name,
        description: tag.description,
      });
    } else {
      setEditingTag(null);
      form.resetFields();
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
      };

      if (editingTag) {
        updateMutation.mutate({ id: editingTag.id, data: tagData });
      } else {
        createMutation.mutate(tagData);
      }
    } catch (error: any) {
      const errorFields = error.errorFields || [];
      const missingFields = errorFields.map((e: any) => `${e.errors[0]}`);
      setValidationErrors(missingFields);
      setIsValidationModalVisible(true);
    }
  };

  // 删除标签
  const handleDelete = (tag: TagType) => {
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
      render: (name: string) => (
        <Tag style={{
          backgroundColor: '#F5F5F5',
          color: '#333333',
          borderColor: '#E8E8E8',
          fontSize: '14px'
        }}>
          {name}
        </Tag>
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
      sorter: (a: TagType, b: TagType) => a.journal_count - b.journal_count,
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
      render: (_: any, record: TagType) => (
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
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
        </Form>
      </Modal>

      {/* 表单验证提示模态框 */}
      <ValidationPromptModal
        visible={isValidationModalVisible}
        onClose={() => setIsValidationModalVisible(false)}
        missingFields={validationErrors}
      />
    </>
  );
};
