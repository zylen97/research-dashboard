import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
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
} from '@ant-design/icons';
import api from '../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SimpleIdea {
  id: number;
  research_question: string;
  research_method: string;
  source_journal: string;
  source_literature: string;
  responsible_person: string;
  maturity: 'mature' | 'immature';
  description?: string;
  created_at: string;
  updated_at: string;
}

const SimpleIdeasPage: React.FC = () => {
  const [ideas, setIdeas] = useState<SimpleIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIdea, setEditingIdea] = useState<SimpleIdea | null>(null);
  const [form] = Form.useForm();

  // 加载Ideas列表
  const loadIdeas = async () => {
    setLoading(true);
    try {
      // axios interceptor已配置返回data，但TypeScript不知道
      const response = await api.get('/simple-ideas/');
      setIdeas(response as unknown as SimpleIdea[]);
    } catch (error) {
      message.error('加载Ideas失败');
      console.error('加载Ideas失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIdeas();
  }, []);

  // 打开创建/编辑模态框
  const openModal = (idea?: SimpleIdea) => {
    setEditingIdea(idea || null);
    setModalVisible(true);
    
    if (idea) {
      form.setFieldsValue({
        research_question: idea.research_question,
        research_method: idea.research_method,
        source_journal: idea.source_journal,
        source_literature: idea.source_literature,
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
      
      if (editingIdea) {
        // 更新
        await api.put(`/simple-ideas/${editingIdea.id}`, values);
        message.success('Idea更新成功');
      } else {
        // 创建
        await api.post('/simple-ideas/', values);
        message.success('Idea创建成功');
      }
      
      closeModal();
      loadIdeas();
    } catch (error) {
      message.error(editingIdea ? 'Idea更新失败' : 'Idea创建失败');
      console.error('提交失败:', error);
    }
  };

  // 删除Idea
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/simple-ideas/${id}`);
      message.success('Idea删除成功');
      loadIdeas();
    } catch (error) {
      message.error('Idea删除失败');
      console.error('删除失败:', error);
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
      title: '研究问题',
      dataIndex: 'research_question',
      key: 'research_question',
      width: '20%',
      render: (text: string) => (
        <Text style={{ wordBreak: 'break-word' }}>
          {text}
        </Text>
      ),
    },
    {
      title: '研究方法',
      dataIndex: 'research_method',
      key: 'research_method',
      width: '15%',
      ellipsis: true,
    },
    {
      title: '来源期刊',
      dataIndex: 'source_journal',
      key: 'source_journal',
      width: '15%',
      ellipsis: true,
    },
    {
      title: '来源文献',
      dataIndex: 'source_literature',
      key: 'source_literature',
      width: '15%',
      ellipsis: true,
    },
    {
      title: '负责人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: '10%',
    },
    {
      title: '成熟度',
      dataIndex: 'maturity',
      key: 'maturity',
      width: '10%',
      render: renderMaturity,
      filters: [
        { text: '成熟', value: 'mature' },
        { text: '不成熟', value: 'immature' },
      ],
      onFilter: (value, record) => record.maturity === value,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '10%',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个Idea吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2}>
          <BulbOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          Ideas管理
        </Title>
        <Paragraph type="secondary">
          管理研究想法，设置负责人和成熟度评级
        </Paragraph>
      </div>

      {/* 操作栏 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            新增Idea
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={ideas}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingIdea ? '编辑Idea' : '新增Idea'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
        >
          <Form.Item
            name="research_question"
            label="研究问题"
            rules={[{ required: true, message: '请输入研究问题' }]}
          >
            <TextArea rows={2} placeholder="请输入研究问题" />
          </Form.Item>

          <Form.Item
            name="research_method"
            label="研究方法"
            rules={[{ required: true, message: '请输入研究方法' }]}
          >
            <TextArea rows={2} placeholder="请输入研究方法" />
          </Form.Item>

          <Form.Item
            name="source_journal"
            label="来源期刊"
            rules={[{ required: true, message: '请输入来源期刊' }]}
          >
            <Input placeholder="请输入来源期刊" />
          </Form.Item>

          <Form.Item
            name="source_literature"
            label="来源文献"
            rules={[{ required: true, message: '请输入来源文献' }]}
          >
            <TextArea rows={2} placeholder="请输入来源文献" />
          </Form.Item>

          <Form.Item
            name="responsible_person"
            label="负责人"
            rules={[{ required: true, message: '请输入负责人姓名' }]}
          >
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>

          <Form.Item
            name="maturity"
            label="成熟度"
            rules={[{ required: true, message: '请选择成熟度' }]}
          >
            <Select placeholder="请选择成熟度">
              <Option value="mature">成熟</Option>
              <Option value="immature">不成熟</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="额外描述"
          >
            <TextArea rows={3} placeholder="可选的额外描述信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SimpleIdeasPage;