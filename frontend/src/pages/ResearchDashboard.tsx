import React, { useState } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Table,
} from 'antd';
import {
  PlusOutlined,
  ProjectOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ResearchProject, ResearchProjectCreate } from '../types';
import { 
  StatisticsCards, 
  createProjectColumns,
  useProjectData, 
  useProjectActions 
} from '../components/research-dashboard';
import CommunicationLogModal from '../components/CommunicationLogModal';

const { Title } = Typography;
const { TextArea } = Input;

const ResearchDashboard: React.FC = () => {
  // 表单和模态框状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<ResearchProject | null>(null);
  const [isCommunicationModalVisible, setIsCommunicationModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [form] = Form.useForm();

  // 使用自定义钩子管理数据和操作
  const {
    sortedProjects,
    collaborators,
    isLoading,
    getProjectTodoStatus,
    updateLocalTodoStatus,
    revertLocalTodoStatus,
    refetch,
  } = useProjectData();

  const {
    createProjectMutation,
    updateProjectMutation,
    handleDeleteProject,
    handleToggleTodo,
    isCreating,
    isUpdating,
  } = useProjectActions({
    getProjectTodoStatus,
    updateLocalTodoStatus,
    revertLocalTodoStatus,
  });


  // 处理表单提交
  const handleSubmit = async (values: any) => {
    const projectData: ResearchProjectCreate = {
      ...values,
    };

    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data: projectData });
    } else {
      createProjectMutation.mutate(projectData);
    }
    
    // 成功后关闭模态框
    setIsModalVisible(false);
    setEditingProject(null);
    form.resetFields();
  };

  // 处理编辑
  const handleEdit = (project: ResearchProject) => {
    setEditingProject(project);
    form.setFieldsValue({
      ...project,
      collaborator_ids: Array.isArray(project.collaborators) ? project.collaborators.map(c => c.id) : [],
    });
    setIsModalVisible(true);
  };

  // 处理交流日志查看
  const handleViewLogs = (project: ResearchProject) => {
    setSelectedProject(project);
    setIsCommunicationModalVisible(true);
  };

  // 表格列配置
  const columns = createProjectColumns({
    actions: {
      onEdit: handleEdit,
      onDelete: handleDeleteProject,
      onViewLogs: handleViewLogs,
      onToggleTodo: handleToggleTodo,
    },
    getProjectTodoStatus,
    currentPage,
    pageSize,
  });

  return (
    <div>
      {/* 待办项目行样式 */}
      <style>{`
        .todo-project-row {
          background-color: #fffbf0 !important;
          border-left: 3px solid #faad14 !important;
        }
        .todo-project-row:hover {
          background-color: #fff7e6 !important;
        }
      `}</style>

      {/* 页面标题和操作按钮 */}
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>
          <ProjectOutlined style={{ marginRight: 8 }} />
          研究看板
        </Title>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
            title="刷新数据"
          >
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingProject(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            新建项目
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <StatisticsCards 
        projects={sortedProjects} 
        getProjectTodoStatus={getProjectTodoStatus} 
      />

      {/* 项目列表 */}
      <div className="table-container">
        <Table
          size="small"
          dataSource={sortedProjects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          onChange={(pagination) => {
            setCurrentPage(pagination.current || 1);
            setPageSize(pagination.pageSize || 50);
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            pageSizeOptions: ['10', '20', '50', '100'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
          rowClassName={(record: ResearchProject) => 
            getProjectTodoStatus(record).is_todo ? 'todo-project-row' : ''
          }
        />
      </div>

      {/* 创建/编辑项目模态框 */}
      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingProject(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={isCreating || isUpdating}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="项目标题"
            rules={[{ required: true, message: '请输入项目标题' }]}
          >
            <Input placeholder="请输入项目标题" />
          </Form.Item>

          <Form.Item
            name="idea_description"
            label="项目描述"
            rules={[{ required: true, message: '请输入项目描述' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请详细描述项目的核心idea和目标"
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="项目状态"
            initialValue="active"
          >
            <Select>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="paused">暂停</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
            </Select>
          </Form.Item>


          <Form.Item
            name="collaborator_ids"
            label="合作者"
          >
            <Select
              mode="multiple"
              placeholder="选择合作者"
              showSearch
              filterOption={(input, option) =>
                (option?.children?.toString() || '').toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {Array.isArray(collaborators) && collaborators.map((collaborator) => (
                <Select.Option key={collaborator.id} value={collaborator.id}>
                  {collaborator.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 交流日志模态框 */}
      <CommunicationLogModal
        visible={isCommunicationModalVisible}
        project={selectedProject}
        collaborators={collaborators}
        onClose={() => {
          setIsCommunicationModalVisible(false);
          setSelectedProject(null);
        }}
        onUpdate={() => {
          // 可以在这里刷新项目列表以更新最新交流进度
        }}
      />
    </div>
  );
};

export default ResearchDashboard;