import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  Popconfirm,
  message,
  Tooltip,
  Empty,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { promptsApi } from '../../services/api';
import { Prompt, PromptCreate, PromptUpdate } from '../../types';

const { TextArea } = Input;
const { Text } = Typography;
const { Column } = Table;

interface PromptManagementProps {
  height?: string;
}

const PromptManagement: React.FC<PromptManagementProps> = ({ height = "600px" }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
  const [form] = Form.useForm();

  // 加载prompts列表
  const loadPrompts = async () => {
    setLoading(true);
    try {
      const data = await promptsApi.getPrompts();
      setPrompts(data);
    } catch (error: any) {
      message.error(`加载Prompt列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  // 打开创建/编辑模态框
  const openModal = (prompt?: Prompt) => {
    setEditingPrompt(prompt || null);
    setModalVisible(true);
    if (prompt) {
      form.setFieldsValue({
        name: prompt.name,
        content: prompt.content
      });
    } else {
      form.resetFields();
    }
  };

  // 打开查看模态框
  const openViewModal = (prompt: Prompt) => {
    setViewingPrompt(prompt);
    setViewModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingPrompt(null);
    form.resetFields();
  };

  // 关闭查看模态框
  const closeViewModal = () => {
    setViewModalVisible(false);
    setViewingPrompt(null);
  };

  // 保存prompt
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data: PromptCreate | PromptUpdate = {
        name: values.name.trim(),
        content: values.content.trim()
      };

      if (editingPrompt) {
        // 编辑模式
        await promptsApi.updatePrompt(editingPrompt.id, data);
        message.success('Prompt更新成功');
      } else {
        // 创建模式
        await promptsApi.createPrompt(data as PromptCreate);
        message.success('Prompt创建成功');
      }

      closeModal();
      loadPrompts();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      } else {
        message.error('保存失败，请检查输入内容');
      }
    }
  };

  // 删除prompt
  const handleDelete = async (prompt: Prompt) => {
    try {
      await promptsApi.deletePrompt(prompt.id);
      message.success(`Prompt "${prompt.name}" 删除成功`);
      loadPrompts();
    } catch (error: any) {
      message.error(`删除失败: ${error.message}`);
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };


  return (
    <Card 
      title={
        <Space>
          <FileTextOutlined />
          <span>Prompt管理</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
          size="small"
        >
          新建Prompt
        </Button>
      }
      bodyStyle={{ 
        padding: '16px', 
        height: height,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          dataSource={prompts}
          loading={loading}
          pagination={false}
          size="small"
          rowKey="id"
          scroll={{ y: 'calc(100vh - 320px)' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无Prompt模板"
              />
            )
          }}
        >
          <Column
            title="名称"
            dataIndex="name"
            key="name"
            width={200}
            render={(name: string) => (
              <Text strong style={{ color: '#1890ff' }}>
                {name}
              </Text>
            )}
          />
          
          <Column
            title="创建时间"
            dataIndex="created_at"
            key="created_at"
            width={140}
            render={(date: string) => (
              <Text style={{ fontSize: '12px' }}>
                {formatTime(date)}
              </Text>
            )}
          />
          
          <Column
            title="操作"
            key="actions"
            width={140}
            render={(_, record: Prompt) => (
              <Space size="small">
                <Tooltip title="查看详情">
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => openViewModal(record)}
                  />
                </Tooltip>
                
                <Tooltip title="编辑">
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openModal(record)}
                  />
                </Tooltip>
                
                <Popconfirm
                  title="确认删除"
                  description={`确定要删除Prompt "${record.name}" 吗？`}
                  onConfirm={() => handleDelete(record)}
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                >
                  <Tooltip title="删除">
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            )}
          />
        </Table>
      </div>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingPrompt ? '编辑Prompt' : '新建Prompt'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={closeModal}
        width={700}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: '',
            content: ''
          }}
        >
          <Form.Item
            label="Prompt名称"
            name="name"
            rules={[
              { required: true, message: '请输入Prompt名称' },
              { max: 100, message: '名称不能超过100个字符' }
            ]}
          >
            <Input placeholder="例如：默认研究建议、创新分析等" />
          </Form.Item>

          <Form.Item
            label="Prompt内容"
            name="content"
            rules={[
              { required: true, message: '请输入Prompt内容' },
              { min: 10, message: 'Prompt内容至少10个字符' }
            ]}
          >
            <TextArea
              rows={12}
              placeholder="请输入与AI交互的prompt内容..."
              showCount
              style={{
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px'
              }}
            />
          </Form.Item>

          <div style={{ fontSize: '12px', color: '#666' }}>
            <Text type="secondary">
              💡 提示：Prompt将用于指导AI如何分析Excel中的文献数据并生成建议
            </Text>
          </div>
        </Form>
      </Modal>

      {/* 查看详情模态框 */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>Prompt详情</span>
          </Space>
        }
        open={viewModalVisible}
        onCancel={closeViewModal}
        footer={[
          <Button key="edit" type="primary" onClick={() => {
            closeViewModal();
            openModal(viewingPrompt!);
          }}>
            编辑
          </Button>,
          <Button key="close" onClick={closeViewModal}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {viewingPrompt && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>名称：</Text>
              <Text style={{ fontSize: '16px', color: '#1890ff', marginLeft: '8px' }}>
                {viewingPrompt.name}
              </Text>
            </div>

            <Divider />

            <div style={{ marginBottom: '16px' }}>
              <Text strong>内容：</Text>
              <div style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '6px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {viewingPrompt.content}
              </div>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '12px' }}>
              <div>
                <HistoryOutlined style={{ marginRight: '4px' }} />
                创建时间：{formatTime(viewingPrompt.created_at)}
              </div>
              <div>
                <HistoryOutlined style={{ marginRight: '4px' }} />
                更新时间：{formatTime(viewingPrompt.updated_at)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default PromptManagement;