import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Button,
  Modal,
  Form,
  Typography,
  Tag,
  Space,
  Table,
  Radio,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  ReloadOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { collaboratorApi, researchApi, ideasApi } from '../services/apiOptimized';
import { useTableCRUD } from '../hooks/useTableCRUDOptimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';
import { Collaborator, CollaboratorCreate } from '../types';
import CollaboratorStatistics from '../components/collaborator/CollaboratorStatistics';
import CollaboratorFormModal from '../components/collaborator/CollaboratorFormModal';
import CollaboratorProjectsModal from '../components/collaborator/CollaboratorProjectsModal';
import { safeForEach, safeFilter } from '../utils/arrayHelpers';
import { handleListResponse } from '../utils/dataFormatters';

const { Title, Text } = Typography;

/**
 * 合作者管理页面（简化版）
 * 只管理2个字段：name, background
 */
const CollaboratorManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isProjectsModalVisible, setIsProjectsModalVisible] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [selectedCollaboratorForProjects, setSelectedCollaboratorForProjects] = useState<Collaborator | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [form] = Form.useForm();

  // 清理旧的localStorage小组标记数据（组件mount时执行一次）
  useEffect(() => {
    localStorage.removeItem('collaborator-group-marks');
  }, []);

  // 用于跟踪删除类型的ref
  const deleteTypeRef = useRef<'soft' | 'hard'>('soft');

  // 获取合作者数据
  const { data: collaboratorsData, isLoading, refetch } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => collaboratorApi.getList(),
  });

  // 确保 collaborators 始终是数组
  const collaborators = handleListResponse<Collaborator>(collaboratorsData, 'CollaboratorManagement.collaborators');

  // 获取研究项目数据
  const { data: projectsData } = useQuery({
    queryKey: ['research-projects'],
    queryFn: () => researchApi.getList(),
  });

  const projects = handleListResponse(projectsData, 'CollaboratorManagement.projects');

  // 获取Ideas数据
  const { data: ideasData } = useQuery({
    queryKey: ['ideas'],
    queryFn: () => ideasApi.getList(),
  });
  const ideas = handleListResponse(ideasData, 'CollaboratorManagement.ideas');

  // 使用优化的CRUD Hook
  const {
    create,
    update,
    isCreating,
    isUpdating,
  } = useTableCRUD(
    collaboratorApi,
    'collaborators',
    {
      createSuccessMessage: '合作者创建成功！',
      updateSuccessMessage: '合作者信息更新成功！',
      deleteSuccessMessage: '合作者删除成功！',
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

  // 排序合作者（按项目数降序，项目数相同时按名字排序）
  const sortedCollaborators = useMemo(() => {
    const safeCollaborators = handleListResponse<Collaborator>(collaborators, 'CollaboratorManagement.sortedCollaborators');
    return [...safeCollaborators].sort((a, b) => {
      if (!a || !b) return 0;

      // 1. 按项目数降序
      const projectCountA = projects.filter((p: any) =>
        p?.collaborators?.some((c: any) => c?.id === a.id)
      ).length;
      const projectCountB = projects.filter((p: any) =>
        p?.collaborators?.some((c: any) => c?.id === b.id)
      ).length;

      if (projectCountA !== projectCountB) {
        return projectCountB - projectCountA;
      }

      // 2. 项目数相同时按名字排序
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [collaborators, projects]);

  // 分析合作者参与状态
  const collaboratorParticipationStatus = useMemo(() => {
    const participatingCollaboratorIds = new Set<number>();

    // 收集所有参与项目的合作者ID
    safeForEach(projects, (project: any) => {
      if (project && typeof project === 'object') {
        safeForEach(project.collaborators, (collaborator: any) => {
          if (collaborator && typeof collaborator === 'object' && collaborator.id) {
            participatingCollaboratorIds.add(collaborator.id);
          }
        }, 'project.collaborators');
      }
    }, 'CollaboratorManagement.projects');

    // 创建合作者参与状态映射
    const statusMap = new Map<number, boolean>();
    safeForEach(sortedCollaborators, (collaborator: Collaborator) => {
      if (collaborator && collaborator.id) {
        statusMap.set(collaborator.id, participatingCollaboratorIds.has(collaborator.id));
      }
    }, 'sortedCollaborators');

    return statusMap;
  }, [projects, sortedCollaborators]);

  // 处理删除（使用优化的错误处理）
  const handleDelete = withErrorHandler(
    async (collaborator: Collaborator) => {
      // 先检查是否有关联的项目
      const projectsResponse = await collaboratorApi.getCollaboratorProjects(collaborator.id);
      const projects = handleListResponse(projectsResponse, 'getCollaboratorProjects');
      const activeProjects = safeFilter(projects, (p: any) => p && typeof p === 'object' && p.status === 'active', 'activeProjects');
      const completedProjects = safeFilter(projects, (p: any) => p && typeof p === 'object' && p.status === 'completed', 'completedProjects');

      const dependencies = {
        total_projects: projects.length,
        active_projects: activeProjects.length,
        completed_projects: completedProjects.length,
      };

      const can_soft_delete = true;
      const can_hard_delete = activeProjects.length === 0;
      const hasActiveProjects = dependencies.active_projects > 0;

      // 重置删除类型为默认值
      deleteTypeRef.current = 'soft';

      Modal.confirm({
        title: '删除合作者确认',
        width: 520,
        content: (
          <div>
            <p>您即将删除合作者：<strong>"{collaborator.name}"</strong></p>

            {dependencies.total_projects > 0 && (
              <>
                <p style={{ marginTop: 16, marginBottom: 8 }}>
                  <strong>当前合作者的相关数据：</strong>
                </p>
                <ul style={{ marginLeft: 20 }}>
                  {dependencies.active_projects > 0 && (
                    <li style={{ color: '#333333' }}>
                      参与 {dependencies.active_projects} 个进行中的项目
                    </li>
                  )}
                  {dependencies.completed_projects > 0 && (
                    <li>
                      参与 {dependencies.completed_projects} 个已完成的项目
                    </li>
                  )}
                </ul>
              </>
            )}

            <div style={{
              marginTop: 16,
              padding: '12px',
              background: '#f0f2f5',
              borderRadius: '4px'
            }}>
              <p style={{ marginBottom: 8, fontWeight: 'bold' }}>删除选项：</p>
              <Radio.Group
                defaultValue="soft"
                onChange={(e) => {
                  deleteTypeRef.current = e.target.value;
                }}
              >
                <Space direction="vertical">
                  <Radio value="soft" disabled={!can_soft_delete}>
                    <span style={{ color: '#666666' }}>
                      软删除（推荐） - 可以随时恢复
                    </span>
                  </Radio>
                  <Radio value="hard" disabled={!can_hard_delete}>
                    <span style={{ color: '#333333' }}>
                      永久删除 - 不可恢复
                      {hasActiveProjects && ' (有活跃项目，不可用)'}
                    </span>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>
          </div>
        ),
        okText: '确认删除',
        cancelText: '取消',
        okType: 'primary',
        onOk: async () => {
          await collaboratorApi.deleteCollaborator(collaborator.id, deleteTypeRef.current === 'hard');
          refetch();
        },
      });
    },
    'deleteCollaborator',
    {
      errorMessage: '检查合作者依赖关系失败，请稍后重试',
    }
  );

  // 处理表单提交（极简版 - 只处理2个字段）
  const handleSubmit = async (values: CollaboratorCreate) => {
    const apiValues: CollaboratorCreate = {
      name: values.name,
      background: values.background,
    };

    if (editingCollaborator) {
      update({ id: editingCollaborator.id, data: apiValues });
    } else {
      create(apiValues);
    }
  };

  // 处理编辑
  const handleEdit = (collaborator: Collaborator) => {
    setEditingCollaborator(collaborator);
    form.setFieldsValue({
      name: collaborator.name,
      background: collaborator.background,
    });
    setIsModalVisible(true);
  };

  // 查看相关项目
  const showProjects = (collaborator: Collaborator) => {
    setSelectedCollaboratorForProjects(collaborator);
    setIsProjectsModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setIsModalVisible(false);
    setEditingCollaborator(null);
    form.resetFields();
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* 页面标题和操作按钮 */}
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            合作者管理
          </Title>
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            管理所有合作者信息
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
            title="刷新数据"
          >
            刷新
          </Button>
          <Button
            type="default"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCollaborator(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            新增合作者
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <CollaboratorStatistics collaborators={collaborators} />

      {/* 合作者列表 */}
      <div className="table-container">
        <Table
          size="small"
          dataSource={sortedCollaborators}
          rowKey="id"
          loading={isLoading}
          onChange={(pagination) => {
            setCurrentPage(pagination.current || 1);
            setPageSize(pagination.pageSize || 50);
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: sortedCollaborators.length,
            pageSizeOptions: ['10', '20', '50', '100'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1000 }}
          columns={[
            {
              title: '姓名',
              dataIndex: 'name',
              key: 'name',
              width: 150,
              render: (name: string, record) => {
                const isParticipating = collaboratorParticipationStatus.get(record.id) || false;
                return (
                  <div>
                    <Text strong>{name}</Text>
                    {!isParticipating && (
                      <Tag style={{ marginLeft: 8, fontSize: '12px', backgroundColor: '#F5F5F5', color: '#666666', borderColor: '#E8E8E8' }}>
                        未参与项目
                      </Tag>
                    )}
                  </div>
                );
              },
            },
            {
              title: '背景信息',
              dataIndex: 'background',
              key: 'background',
              width: 250,
              ellipsis: { showTitle: false },
              render: (background: string) =>
                background ? (
                  <Text ellipsis={{ tooltip: background }}>{background}</Text>
                ) : '-',
            },
            {
              title: '参与项目数',
              key: 'project_count',
              width: 120,
              align: 'center',
              render: (_, record) => {
                const projectCount = projects.filter((p: any) =>
                  p?.collaborators?.some((c: any) => c?.id === record.id)
                ).length;
                return <Tag style={{ backgroundColor: '#E8E8E8', color: '#333333', borderColor: '#CCCCCC' }}>{projectCount}</Tag>;
              },
            },
            {
              title: '负责Idea数',
              key: 'idea_count',
              width: 120,
              align: 'center',
              render: (_, record) => {
                const ideaCount = ideas.filter((i: any) =>
                  i?.responsible_person?.id === record.id
                ).length;
                return <Tag style={{ backgroundColor: '#E8E8E8', color: '#333333', borderColor: '#CCCCCC' }}>{ideaCount}</Tag>;
              },
            },
            {
              title: '操作',
              key: 'actions',
              width: 160,
              fixed: 'right',
              render: (_, collaborator) => (
                <Space size="small">
                  <Button
                    type="text"
                    icon={<ProjectOutlined />}
                    onClick={() => showProjects(collaborator)}
                    title="查看相关项目"
                  />
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(collaborator)}
                    title="编辑"
                  />
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    danger
                    title="删除"
                    onClick={() => handleDelete(collaborator)}
                  />
                </Space>
              ),
            },
          ]}
        />
      </div>

      {/* 创建/编辑合作者模态框 */}
      <CollaboratorFormModal
        visible={isModalVisible}
        onCancel={closeModal}
        editingCollaborator={editingCollaborator}
        form={form}
        onSubmit={handleSubmit}
        confirmLoading={isCreating || isUpdating}
      />

      {/* 合作者相关项目模态框 */}
      <CollaboratorProjectsModal
        visible={isProjectsModalVisible}
        collaborator={selectedCollaboratorForProjects}
        onClose={() => {
          setIsProjectsModalVisible(false);
          setSelectedCollaboratorForProjects(null);
        }}
      />
    </div>
  );
};

export default CollaboratorManagement;
