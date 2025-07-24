import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Rate,
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
} from '@ant-design/icons';
import { ideasApi } from '../services/api';
import type { Idea, IdeaCreate, IdeaUpdate, Collaborator } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const IdeasManagement: React.FC = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [form] = Form.useForm();

  // 加载Ideas列表
  const loadIdeas = async () => {
    setLoading(true);
    try {
      const data = await ideasApi.getIdeas();
      // 确保data是数组
      setIdeas(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error('加载Ideas失败');
      console.error('加载Ideas失败:', error);
      setIdeas([]); // 错误时设置为空数组
    } finally {
      setLoading(false);
    }
  };

  // 加载高级合作者列表
  const loadCollaborators = async () => {
    try {
      const data = await ideasApi.getSeniorCollaborators();
      // 确保data是数组
      setCollaborators(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载合作者失败:', error);
      setCollaborators([]); // 错误时设置为空数组
    }
  };

  useEffect(() => {
    loadIdeas();
    loadCollaborators();
  }, []);

  // 打开创建/编辑模态框
  const openModal = (idea?: Idea) => {
    setEditingIdea(idea || null);
    setModalVisible(true);
    
    if (idea) {
      form.setFieldsValue({
        research_question: idea.research_question,
        research_method: idea.research_method,
        source_literature: idea.source_literature,
        importance: idea.importance,
        description: idea.description,
        collaborator_id: idea.collaborator_id,
      });
    } else {
      form.resetFields();
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
        await ideasApi.updateIdea(editingIdea.id, values as IdeaUpdate);
        message.success('Idea更新成功');
      } else {
        // 创建
        await ideasApi.createIdea(values as IdeaCreate);
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
      await ideasApi.deleteIdea(id);
      message.success('Idea删除成功');
      loadIdeas();
    } catch (error) {
      message.error('Idea删除失败');
      console.error('删除失败:', error);
    }
  };

  // 重要性显示
  const renderImportance = (importance: number) => {
    let color: string;
    let label: string;
    
    switch (importance) {
      case 1:
        color = '#ff4d4f';
        label = '很低';
        break;
      case 2:
        color = '#ff7a45';
        label = '低';
        break;
      case 3:
        color = '#ffa940';
        label = '中等';
        break;
      case 4:
        color = '#52c41a';
        label = '高';
        break;
      case 5:
        color = '#1890ff';
        label = '很高';
        break;
      default:
        color = '#ffa940';
        label = '中等';
    }
    
    return (
      <Space>
        <Rate disabled value={importance} style={{ fontSize: '16px' }} />
        <Tag color={color as any}>{label}</Tag>
      </Space>
    );
  };

  // 表格列定义
  const columns: ColumnsType<Idea> = [
    {
      title: '研究问题',
      dataIndex: 'research_question',
      key: 'research_question',
      width: '30%',
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
      width: '20%',
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">未填写</Text>,
    },
    {
      title: '来源文献',
      dataIndex: 'source_literature',
      key: 'source_literature',
      width: '20%',
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">未填写</Text>,
    },
    {
      title: '负责人',
      dataIndex: 'collaborator',
      key: 'collaborator',
      width: '10%',
      render: (collaborator: Collaborator) => 
        collaborator ? collaborator.name : <Text type="secondary">未分配</Text>,
    },
    {
      title: '重要性',
      dataIndex: 'importance',
      key: 'importance',
      width: '10%',
      render: renderImportance,
      sorter: (a, b) => a.importance - b.importance,
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
      key: 'actions',
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => openModal(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此Idea？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        bordered={false}
        style={{ 
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
          borderRadius: '8px'
        }}
      >
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => openModal()}
            size="large"
          >
            新建Idea
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={Array.isArray(ideas) ? ideas : []}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          style={{ width: '100%' }}
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingIdea ? '编辑Idea' : '新建Idea'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ importance: 3 }}
        >
          <Form.Item
            name="research_question"
            label="研究问题"
            rules={[{ required: true, message: '请输入研究问题' }]}
          >
            <TextArea 
              placeholder="请描述具体的研究问题..."
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="research_method"
            label="研究方法"
          >
            <TextArea 
              placeholder="请描述研究方法..."
              rows={2}
            />
          </Form.Item>

          <Form.Item
            name="source_literature"
            label="来源文献"
          >
            <TextArea 
              placeholder="请输入相关文献..."
              rows={2}
            />
          </Form.Item>

          <Form.Item
            name="collaborator_id"
            label="负责人"
          >
            <Select 
              placeholder="选择负责人（高级合作者）"
              allowClear
            >
              {Array.isArray(collaborators) && collaborators.map(collaborator => (
                <Option key={collaborator.id} value={collaborator.id}>
                  {collaborator.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="importance"
            label="重要性评级"
            rules={[{ required: true, message: '请选择重要性评级' }]}
          >
            <Rate />
          </Form.Item>

          <Form.Item
            name="description"
            label="额外描述"
          >
            <TextArea 
              placeholder="其他补充说明..."
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IdeasManagement;