import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Table,
  Button,
  Form,
  Input,
  DatePicker,
  Space,
  message,
  Popconfirm,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { ResearchProject, CommunicationLog, CommunicationLogCreate, Collaborator } from '../types';
import { researchApi } from '../services/api';
import dayjs from 'dayjs';

interface CommunicationFormValues {
  title: string;
  content?: string;
  outcomes?: string;
  action_items?: string;
  communication_date?: any;
}

const { TextArea } = Input;

interface CommunicationLogModalProps {
  visible: boolean;
  project: ResearchProject | null;
  collaborators: Collaborator[];
  onClose: () => void;
  onUpdate?: () => void;
}

const CommunicationLogModal: React.FC<CommunicationLogModalProps> = ({
  visible,
  project,
  collaborators: _collaborators,
  onClose,
  onUpdate,
}) => {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null);
  const [form] = Form.useForm();

  // 获取交流日志
  const fetchLogs = useCallback(async () => {
    if (!project) return;
    
    setLoading(true);
    try {
      const data = await researchApi.getCommunicationLogs(project.id);
      setLogs(data);
    } catch (error) {
      message.error('获取交流日志失败');
      console.error('获取交流日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    if (visible && project) {
      fetchLogs();
    }
  }, [visible, project, fetchLogs]);

  // 处理提交
  const handleSubmit = async (values: CommunicationFormValues) => {
    if (!project) return;

    // 确保content不为空
    const content = values.content?.trim();
    if (!content) {
      message.error('交流内容不能为空');
      return;
    }

    // 确保title长度符合要求
    if (values.title.length > 200) {
      message.error('标题长度不能超过200个字符');
      return;
    }

    const logData: CommunicationLogCreate = {
      communication_type: 'meeting', // 默认值，后端需要
      title: values.title.trim(),
      content: content,
      ...(values.action_items?.trim() && { action_items: values.action_items.trim() }),
      ...(values.communication_date && { communication_date: values.communication_date.format('YYYY-MM-DD') }),
    };

    try {
      if (editingLog) {
        await researchApi.updateCommunicationLog(project.id, editingLog.id, logData);
        message.success('更新交流日志成功');
      } else {
        await researchApi.createCommunicationLog(project.id, logData);
        message.success('添加交流日志成功');
      }
      
      form.resetFields();
      setIsAddModalVisible(false);
      setEditingLog(null);
      fetchLogs();
      onUpdate?.();
    } catch (error) {
      message.error(editingLog ? '更新交流日志失败' : '添加交流日志失败');
      console.error('提交交流日志失败:', error);
    }
  };

  // 处理编辑
  const handleEdit = (log: CommunicationLog) => {
    setEditingLog(log);
    form.setFieldsValue({
      title: log.title,
      content: log.content,
      action_items: log.action_items,
      communication_date: log.communication_date ? dayjs(log.communication_date) : undefined,
    });
    setIsAddModalVisible(true);
  };

  // 处理删除
  const handleDelete = async (log: CommunicationLog) => {
    if (!project) return;

    try {
      await researchApi.deleteCommunicationLog(project.id, log.id);
      message.success('删除交流日志成功');
      fetchLogs();
      onUpdate?.();
    } catch (error) {
      message.error('删除交流日志失败');
      console.error('删除交流日志失败:', error);
    }
  };



  // 表格视图
  const renderTableView = () => {
    const columns = [
      {
        title: '时间',
        dataIndex: 'communication_date',
        key: 'date',
        width: 160,
        render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        width: 200,
        ellipsis: true,
      },
      {
        title: '内容',
        dataIndex: 'content',
        key: 'content',
        ellipsis: true,
      },
      {
        title: '待办事项',
        dataIndex: 'action_items',
        key: 'action_items',
        ellipsis: true,
        render: (text: string) => text || '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        fixed: 'right' as const,
        render: (_: any, log: CommunicationLog) => (
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(log)}
            />
            <Popconfirm
              title="确定要删除这条交流记录吗？"
              onConfirm={() => handleDelete(log)}
              okText="删除"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table
        size="small"
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
        }}
        scroll={{ x: 800 }}
      />
    );
  };

  return (
    <>
      <Modal
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            {project?.title} - 交流日志
          </span>
        }
        open={visible}
        onCancel={onClose}
        width={900}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>,
        ]}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      >
        <div>
          {/* 操作按钮区域 */}
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingLog(null);
                form.resetFields();
                setIsAddModalVisible(true);
              }}
            >
              添加记录
            </Button>
          </div>
          
          {/* 表格区域 */}
          <Spin spinning={loading}>
            {renderTableView()}
          </Spin>
        </div>
      </Modal>

      {/* 添加/编辑交流日志模态框 */}
      <Modal
        title={editingLog ? '编辑交流记录' : '添加交流记录'}
        open={isAddModalVisible}
        onCancel={() => {
          setIsAddModalVisible(false);
          setEditingLog(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入交流主题或标题" />
          </Form.Item>

          <Form.Item
            name="communication_date"
            label="交流时间"
            rules={[{ required: true, message: '请选择交流时间' }]}
            initialValue={dayjs()}
          >
            <DatePicker
              format="YYYY-MM-DD"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="content"
            label="交流内容"
            rules={[{ required: true, message: '请输入交流内容' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细记录交流的主要内容、讨论的问题等"
            />
          </Form.Item>

          <Form.Item
            name="action_items"
            label="待办事项"
          >
            <TextArea
              rows={3}
              placeholder="记录需要后续跟进的事项或任务"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CommunicationLogModal;