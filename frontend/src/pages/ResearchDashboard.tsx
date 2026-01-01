import React, { useState, useMemo, useCallback } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Table,
  Switch,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  ProjectOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { ResearchProject, ResearchProjectCreate } from '../types';
import {
  StatisticsCards,
  createProjectColumns,
  useProjectData,
  useProjectActions,
  ResizableTitle
} from '../components/research-dashboard';
import CommunicationLogModal from '../components/CommunicationLogModal';
import ProjectPreviewModal from '../components/research-dashboard/ProjectPreviewModal';
import { journalApi } from '../services/apiOptimized';

const { Title } = Typography;
const { TextArea } = Input;

// 默认列宽配置
const DEFAULT_COLUMN_WIDTHS = {
  index: 50,
  title: 180,
  research_method: 60,
  status: 70,
  collaborators: 180,
  communication_progress: 200,
  actions: 150,
};

const ResearchDashboard: React.FC = () => {
  // 表单和模态框状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<ResearchProject | null>(null);
  const [isCommunicationModalVisible, setIsCommunicationModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showArchived, setShowArchived] = useState(() => {
    // 从localStorage读取用户偏好
    const saved = localStorage.getItem('showArchivedProjects');
    return saved === 'true';
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // 从localStorage读取保存的列宽
    const saved = localStorage.getItem('research-table-columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMN_WIDTHS;
  });
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

  // 查询期刊列表（用于期刊下拉选择器）
  const { data: journals = [] } = useQuery({
    queryKey: ['journals'],
    queryFn: () => journalApi.getJournals(),
  });

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
      // 处理日期格式：如果选择了日期，转换为ISO字符串；否则为null
      start_date: values.start_date ? values.start_date.toISOString() : null,
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
      start_date: project.start_date ? dayjs(project.start_date) : null,
      my_role: project.my_role || 'other_author',
    });
    setIsModalVisible(true);
  };

  // 处理论文进度查看
  const handleViewLogs = (project: ResearchProject) => {
    setSelectedProject(project);
    setIsCommunicationModalVisible(true);
  };

  // 处理项目预览
  const handlePreview = (project: ResearchProject) => {
    setSelectedProject(project);
    setIsPreviewModalVisible(true);
  };

  // 过滤项目数据
  const filteredProjects = useMemo(() => {
    if (showArchived) {
      return sortedProjects;
    }
    // 默认过滤掉存档（completed）状态的项目
    return sortedProjects.filter((project: ResearchProject) => project.status !== 'completed');
  }, [sortedProjects, showArchived]);

  // 处理显示存档开关变化
  const handleShowArchivedChange = (checked: boolean) => {
    setShowArchived(checked);
    localStorage.setItem('showArchivedProjects', checked.toString());
  };

  // 处理列宽调整
  const handleResize = useCallback((key: string) => (_e: any, { size }: any) => {
    setColumnWidths((prev) => {
      const newWidths = { ...prev, [key]: size.width };
      // 保存到localStorage
      localStorage.setItem('research-table-columns', JSON.stringify(newWidths));
      return newWidths;
    });
  }, []);

  // 表格列配置
  const baseColumns = createProjectColumns({
    actions: {
      onEdit: handleEdit,
      onDelete: handleDeleteProject,
      onViewLogs: handleViewLogs,
      onToggleTodo: handleToggleTodo,
      onPreview: handlePreview,
    },
    getProjectTodoStatus,
    currentPage,
    pageSize,
  });

  // 为列添加可调整宽度的功能
  const columns = baseColumns.map((col: any) => {
    const key = col.key || col.dataIndex;
    if (!columnWidths[key]) {
      return col;
    }
    return {
      ...col,
      width: columnWidths[key],
      onHeaderCell: () => ({
        width: columnWidths[key],
        onResize: handleResize(key),
      }),
    };
  });

  return (
    <div style={{ padding: '16px' }}>
      {/* 待办项目行样式和可调整列宽样式 */}
      <style>{`
        .todo-project-row {
          background-color: #F5F5F5 !important;
          border-left: 3px solid #666666 !important;
        }
        .todo-project-row:hover {
          background-color: #E8E8E8 !important;
        }
        
        .resizable-table .react-resizable {
          position: relative;
          background-clip: padding-box;
        }
        
        .resizable-table .react-resizable-handle {
          position: absolute;
          inset-inline-end: -5px;
          bottom: 0;
          z-index: 1;
          width: 10px;
          height: 100%;
          cursor: col-resize;
        }
        
        .resizable-table .react-resizable-handle:hover {
          background-color: #666666;
          opacity: 0.3;
        }
      `}</style>

      {/* 页面标题和操作按钮 */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <ProjectOutlined style={{ marginRight: 8 }} />
            研究看板
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>显示已发表项目</span>
            <Switch
              checked={showArchived}
              onChange={handleShowArchivedChange}
              size="small"
            />
          </div>
        </div>
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
      <div className="table-container resizable-table">
        <Table
          size="small"
          dataSource={filteredProjects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
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
            name="research_method"
            label="研究方法"
            rules={[
              { required: true, message: '请输入研究方法' },
              { max: 2000, message: '研究方法不能超过2000字符' }
            ]}
          >
            <TextArea
              rows={2}
              placeholder="请输入研究方法"
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
            <Select
              showSearch
              placeholder="选择或输入期刊名称"
              mode="tags"
              maxCount={1}
              filterOption={(input, option) =>
                (option?.children?.toString() || '').toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {Array.isArray(journals) && journals.map((journal: any) => (
                <Select.Option key={journal.id} value={journal.name}>
                  {journal.name}
                  {journal.category && ` (${journal.category})`}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="target_journal"
            label="(拟)投稿期刊"
          >
            <Select
              showSearch
              placeholder="选择或输入期刊名称"
              mode="tags"
              maxCount={1}
              filterOption={(input, option) =>
                (option?.children?.toString() || '').toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {Array.isArray(journals) && journals.map((journal: any) => (
                <Select.Option key={journal.id} value={journal.name}>
                  {journal.name}
                  {journal.category && ` (${journal.category})`}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="start_date"
            label="开始时间"
            rules={[{ required: false, message: '请选择项目开始时间' }]}
          >
            <DatePicker 
              style={{ width: '100%' }}
              placeholder="选择项目开始时间（留空则使用当前时间）"
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="项目状态"
            rules={[{ required: true, message: '请选择项目状态' }]}
            initialValue="active"
          >
            <Select placeholder="请选择项目状态">
              <Select.Option value="active">撰写中</Select.Option>
              <Select.Option value="paused">暂停</Select.Option>
              <Select.Option value="reviewing">审稿中</Select.Option>
              <Select.Option value="revising">返修中</Select.Option>
              <Select.Option value="completed">已发表</Select.Option>
            </Select>
          </Form.Item>

          {/* 🆕 我的身份选择器 */}
          <Form.Item
            name="my_role"
            label="我的身份"
            rules={[{ required: true, message: '请选择您在此项目中的身份' }]}
            initialValue="other_author"
          >
            <Select placeholder="选择您的身份">
              <Select.Option value="first_author">
                <span style={{ fontWeight: 'bold', color: '#333333' }}>🥇 第一作者</span>
              </Select.Option>
              <Select.Option value="corresponding_author">
                <span style={{ fontWeight: 'bold', color: '#666666' }}>✉️ 通讯作者</span>
              </Select.Option>
              <Select.Option value="other_author">
                <span style={{ color: '#999999' }}>👥 其他作者</span>
              </Select.Option>
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

      {/* 论文进度模态框 */}
      <CommunicationLogModal
        visible={isCommunicationModalVisible}
        project={selectedProject}
        collaborators={collaborators}
        onClose={() => {
          setIsCommunicationModalVisible(false);
          setSelectedProject(null);
        }}
        onUpdate={() => {
          // 刷新项目列表以更新最新论文进度
          refetch();
        }}
      />

      {/* 项目预览模态框 */}
      <ProjectPreviewModal
        visible={isPreviewModalVisible}
        project={selectedProject}
        onClose={() => {
          setIsPreviewModalVisible(false);
          setSelectedProject(null);
        }}
      />
    </div>
  );
};

export default ResearchDashboard;