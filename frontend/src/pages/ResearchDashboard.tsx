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
  CrownOutlined,
  MailOutlined,
  ClearOutlined,
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
import ValidationPromptModal from '../components/ValidationPromptModal';
import JournalSelect from '../components/JournalSelect';
import ResearchMethodSelect from '../components/ResearchMethodSelect';
import CompactJournalFilter from '../components/CompactJournalFilter';
import { PageHeader, FilterSection } from '../styles/components';
import { researchMethodApi } from '../services/apiOptimized';
import { ResearchMethod } from '../types/research-methods';

const { Title } = Typography;
const { TextArea } = Input;

// 默认列宽配置
const DEFAULT_COLUMN_WIDTHS = {
  index: 50,
  title: 180,
  research_method: 60,
  status: 70,
  my_role: 80,
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
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterMyRole, setFilterMyRole] = useState<string>('');
  const [filterResearchMethod, setFilterResearchMethod] = useState<string>('');
  const [filterTargetJournal, setFilterTargetJournal] = useState<string>('');
  const [filterReferenceJournal, setFilterReferenceJournal] = useState<string>('');

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

  // 查询研究方法列表（用于筛选）
  const { data: researchMethods = [] } = useQuery<ResearchMethod[]>({
    queryKey: ['research-methods'],
    queryFn: () => researchMethodApi.getMethods(),
  });

  // 重置所有筛选
  const handleResetFilters = () => {
    setFilterStatus('');
    setFilterMyRole('');
    setFilterResearchMethod('');
    setFilterTargetJournal('');
    setFilterReferenceJournal('');
  };

  // 构建筛选参数对象
  const filters = useMemo(() => ({
    status: filterStatus || undefined,
    my_role: filterMyRole || undefined,
    research_method: filterResearchMethod || undefined,
    target_journal: filterTargetJournal || undefined,
    reference_journal: filterReferenceJournal || undefined,
  }), [filterStatus, filterMyRole, filterResearchMethod, filterTargetJournal, filterReferenceJournal]);

  // 使用自定义钩子管理数据和操作
  const {
    sortedProjects,
    collaborators,
    isLoading,
    getProjectTodoStatus,
    updateLocalTodoStatus,
    revertLocalTodoStatus,
    refetch,
  } = useProjectData(filters);

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
      my_role: project.my_role || 'first_author',
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

  // 处理模态框确认按钮点击 - 带验证提示
  const handleOkClick = async () => {
    try {
      // 尝试验证表单
      await form.validateFields();
      // 验证通过，提交表单
      form.submit();
    } catch (error: any) {
      // 验证失败，收集错误信息并显示对话框
      const errorFields = error.errorFields || [];
      const missingFields = errorFields.map((e: any) => `${e.errors[0]}`);
      setValidationErrors(missingFields);
      setIsValidationModalVisible(true);
    }
  };

  // 过滤项目数据
  const filteredProjects = useMemo(() => {
    if (showArchived) {
      return sortedProjects;
    }
    // 默认过滤掉已发表状态的项目
    return sortedProjects.filter((project: ResearchProject) => project.status !== 'published');
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
    <div>
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
      <PageHeader
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Title level={3} style={{ margin: 0 }}>
              <ProjectOutlined style={{ marginRight: 8 }} />
              研究
            </Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px' }}>显示已发表研究</span>
              <Switch
                checked={showArchived}
                onChange={handleShowArchivedChange}
                size="small"
              />
            </div>
          </div>
        }
        actions={
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
        }
      />

      {/* 统计卡片 */}
      <StatisticsCards
        projects={sortedProjects}
        getProjectTodoStatus={getProjectTodoStatus}
      />

      {/* 筛选区域 */}
      <FilterSection
        filterControls={
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1.2fr 2fr 2fr auto',
            gap: '12px',
            alignItems: 'start',
          }}>
            <Select
              placeholder="状态"
              allowClear
              value={filterStatus || null}
              onChange={setFilterStatus}
            >
              <Select.Option value="writing">撰写</Select.Option>
              <Select.Option value="submitting">投稿</Select.Option>
              <Select.Option value="published">发表</Select.Option>
            </Select>
            <Select
              placeholder="我的身份"
              allowClear
              value={filterMyRole || null}
              onChange={setFilterMyRole}
            >
              <Select.Option value="first_author">一作</Select.Option>
              <Select.Option value="corresponding_author">通讯</Select.Option>
            </Select>
            <Select
              placeholder="研究方法"
              allowClear
              showSearch
              value={filterResearchMethod || null}
              onChange={setFilterResearchMethod}
              filterOption={(input, option) =>
                (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
              }
              options={researchMethods.map(m => ({
                label: m.name,
                value: m.name
              }))}
            />
            <CompactJournalFilter
              value={filterTargetJournal}
              onChange={(val) => setFilterTargetJournal(val ?? '')}
              placeholder="投稿期刊"
            />
            <CompactJournalFilter
              value={filterReferenceJournal}
              onChange={(val) => setFilterReferenceJournal(val ?? '')}
              placeholder="参考期刊"
            />
            <Button
              icon={<ClearOutlined />}
              onClick={handleResetFilters}
              disabled={!filterStatus && !filterMyRole && !filterResearchMethod && !filterTargetJournal && !filterReferenceJournal}
            >
              重置筛选
            </Button>
          </div>
        }
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
        onOk={handleOkClick}
        confirmLoading={isCreating || isUpdating}
        width={800}
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
            rules={[{ required: true, message: '请选择或输入研究方法' }]}
          >
            <ResearchMethodSelect placeholder="选择或输入研究方法" />
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
            <JournalSelect placeholder="从期刊库选择" />
          </Form.Item>

          <Form.Item
            name="target_journal"
            label="投稿期刊"
          >
            <JournalSelect placeholder="从期刊库选择" />
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
            initialValue="writing"
          >
            <Select placeholder="请选择项目状态">
              <Select.Option value="writing">撰写</Select.Option>
              <Select.Option value="submitting">投稿</Select.Option>
              <Select.Option value="published">发表</Select.Option>
            </Select>
          </Form.Item>

          {/* 🆕 我的身份选择器 */}
          <Form.Item
            name="my_role"
            label="我的身份"
            rules={[{ required: true, message: '请选择您在此项目中的身份' }]}
            initialValue="first_author"
          >
            <Select placeholder="选择您的身份">
              <Select.Option value="first_author">
                <span style={{ fontWeight: 'bold', color: '#333333' }}><CrownOutlined style={{ marginRight: 8 }} />一作</span>
              </Select.Option>
              <Select.Option value="corresponding_author">
                <span style={{ fontWeight: 'bold', color: '#666666' }}><MailOutlined style={{ marginRight: 8 }} />通讯</span>
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

      {/* 表单验证提示模态框 */}
      <ValidationPromptModal
        visible={isValidationModalVisible}
        onClose={() => setIsValidationModalVisible(false)}
        missingFields={validationErrors}
      />
    </div>
  );
};

export default ResearchDashboard;