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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

// 使用优化后的API服务和Hook
import { simpleIdeasApi } from '../services/apiOptimized';
import { useTableCRUD } from '../hooks/useTableCRUDOptimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SimpleIdea {
  id: number;
  research_question: string;  // 将显示为"项目名称"
  research_method: string;
  source_journal: string;
  source_literature: string;
  responsible_person: string;
  maturity: 'mature' | 'immature';
  description?: string;  // 将显示为"项目描述"
  created_at: string;
  updated_at: string;
}

const SimpleIdeasPage: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIdea, setEditingIdea] = useState<SimpleIdea | null>(null);
  const [form] = Form.useForm();

  // 使用React Query获取数据
  const { data: ideas = [], isLoading, refetch } = useQuery({
    queryKey: ['simple-ideas'],
    queryFn: () => simpleIdeasApi.getList(),
  });

  // 使用优化的CRUD Hook
  const {
    create,
    update,
    delete: deleteIdea,
    isCreating,
    isUpdating,
    isDeleting,
  } = useTableCRUD(
    simpleIdeasApi,
    'simple-ideas',
    {
      createSuccessMessage: 'Idea创建成功',
      updateSuccessMessage: 'Idea更新成功',
      deleteSuccessMessage: 'Idea删除成功',
      onCreateSuccess: () => {
        closeModal();
        refetch();
      },
      onUpdateSuccess: () => {
        closeModal();
        refetch();
      },
      onDeleteSuccess: () => {
        refetch();
      },
    }
  );

  // 使用错误处理包装器处理转化功能
  const handleConvert = withErrorHandler(
    async (id: number) => {
      await simpleIdeasApi.post(`/${id}/convert-to-project`);
      refetch(); // 刷新列表
    },
    'convert',
    {
      successMessage: '成功转化为研究项目！',
      errorMessage: '转化失败',
    }
  );

  // 打开创建/编辑模态框
  const openModal = (idea?: SimpleIdea) => {
    setEditingIdea(idea || null);
    setModalVisible(true);
    
    if (idea) {
      // 合并来源字段
      const sources = [];
      if (idea.source_journal) sources.push(`期刊: ${idea.source_journal}`);
      if (idea.source_literature) sources.push(`文献: ${idea.source_literature}`);
      
      form.setFieldsValue({
        research_question: idea.research_question,
        research_method: idea.research_method,
        source: sources.join(' | ') || '',
        responsible_person: idea.responsible_person,
        maturity: idea.maturity,
        description: idea.description,
      });
    } else {
      form.resetFields();
      // 设置默认值
      form.setFieldsValue({
        maturity: 'immature'
      });
    }
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
      
      // 处理来源字段 - 简化逻辑，允许为空
      const source = values.source?.trim() || null;
      const processedValues = {
        ...values,
        // 如果有来源信息，同时填入期刊和文献字段；如果没有，设为null
        source_journal: source,
        source_literature: source,
      };
      delete processedValues.source;
      
      if (editingIdea) {
        // 更新
        update({ id: editingIdea.id, data: processedValues });
      } else {
        // 创建
        create(processedValues);
      }
    } catch (error) {
      // 表单验证失败，不需要额外处理
    }
  };

  // 成熟度显示
  const renderMaturity = (maturity: 'mature' | 'immature') => {
    const color = maturity === 'mature' ? '#52c41a' : '#ffa940';
    const label = maturity === 'mature' ? '成熟' : '不成熟';
    
    return (
      <Tag color={color}>{label}</Tag>
    );
  };

  // 表格列定义
  const columns: ColumnsType<SimpleIdea> = [
    {
      title: '序号',
      key: 'index',
      width: '6%',
      render: (_, __, index) => index + 1,
    },
    {
      title: '项目名称',
      dataIndex: 'research_question',
      key: 'research_question',
      width: '16%',
      render: (text: string) => (
        <Text style={{ wordBreak: 'break-word' }}>
          {text}
        </Text>
      ),
    },
    {
      title: '项目描述',
      dataIndex: 'description',
      key: 'description',
      width: '16%',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '研究方法',
      dataIndex: 'research_method',
      key: 'research_method',
      width: '12%',
      ellipsis: true,
    },
    {
      title: '来源',
      key: 'source',
      width: '14%',
      render: (_, record) => {
        const sources = [];
        if (record.source_journal) sources.push(`期刊: ${record.source_journal}`);
        if (record.source_literature) sources.push(`文献: ${record.source_literature}`);
        return (
          <Text style={{ fontSize: '12px' }}>
            {sources.join(' | ') || '-'}
          </Text>
        );
      },
    },
    {
      title: '负责人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: '8%',
    },
    {
      title: '成熟度',
      dataIndex: 'maturity',
      key: 'maturity',
      width: '8%',
      render: renderMaturity,
      filters: [
        { text: '成熟', value: 'mature' },
        { text: '不成熟', value: 'immature' },
      ],
      onFilter: (value, record) => record.maturity === value,
    },
    {
      title: '操作',
      key: 'action',
      width: '20%',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个Idea吗？"
            onConfirm={() => deleteIdea(record.id)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
              loading={isDeleting}
            >
              删除
            </Button>
          </Popconfirm>
          {record.maturity === 'mature' && (
            <Popconfirm
              title="确定要将这个Idea转化为研究项目吗？"
              onConfirm={() => handleConvert(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                icon={<SwapOutlined />}
                size="small"
                style={{ color: '#52c41a' }}
              >
                转化为项目
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题和说明 */}
        <div>
          <Title level={3}>
            <BulbOutlined /> Ideas 管理
          </Title>
          <Paragraph type="secondary">
            管理和跟踪研究想法，成熟的想法可以转化为正式的研究项目
          </Paragraph>
        </div>

        {/* 操作按钮 */}
        <div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
            loading={isCreating}
          >
            新增 Idea
          </Button>
        </div>

        {/* Ideas列表 */}
        <Table
          columns={columns}
          dataSource={ideas}
          rowKey="id"
          loading={isLoading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Space>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingIdea ? '编辑 Idea' : '新增 Idea'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={isCreating || isUpdating}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="research_question"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="简洁明确的项目名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea
              rows={3}
              placeholder="详细描述这个项目的内容和目标"
            />
          </Form.Item>

          <Form.Item
            name="research_method"
            label="研究方法"
            rules={[{ required: true, message: '请输入研究方法' }]}
          >
            <TextArea
              rows={2}
              placeholder="描述计划采用的研究方法"
            />
          </Form.Item>

          <Form.Item
            name="source"
            label="来源（可选）"
          >
            <TextArea
              rows={2}
              placeholder="期刊、文献或其他来源信息"
            />
          </Form.Item>

          <Form.Item
            name="responsible_person"
            label="负责人"
            rules={[{ required: true, message: '请输入负责人' }]}
          >
            <Input placeholder="项目负责人姓名" />
          </Form.Item>

          <Form.Item
            name="maturity"
            label="成熟度"
            rules={[{ required: true, message: '请选择成熟度' }]}
          >
            <Select placeholder="选择想法的成熟度">
              <Option value="immature">不成熟</Option>
              <Option value="mature">成熟</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SimpleIdeasPage;