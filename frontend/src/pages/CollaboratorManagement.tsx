import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Button,
  Modal,
  Form,
  Avatar,
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
  UserOutlined,
  TeamOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { collaboratorApi, researchApi } from '../services/apiOptimized';
import { useTableCRUD } from '../hooks/useTableCRUDOptimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';
import { Collaborator, CollaboratorCreate } from '../types';
import CollaboratorStatistics from '../components/collaborator/CollaboratorStatistics';
import CollaboratorFormModal from '../components/collaborator/CollaboratorFormModal';
import CollaboratorDetailModal from '../components/collaborator/CollaboratorDetailModal';
import { safeForEach, safeFilter } from '../utils/arrayHelpers';
import { handleListResponse } from '../utils/dataFormatters';

const { Title, Text } = Typography;

const CollaboratorManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [form] = Form.useForm();
  
  // 本地管理小组标记状态
  const [localGroupMarks, setLocalGroupMarks] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem('collaborator-group-marks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 持久化本地小组标记状态
  useEffect(() => {
    localStorage.setItem('collaborator-group-marks', JSON.stringify(localGroupMarks));
  }, [localGroupMarks]);
  
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
      onCreateSuccess: (newCollaborator) => {
        // 如果新建时选择了小组标记，保存到本地状态
        if (pendingGroupStatus) {
          setLocalGroupMarks(prev => ({
            ...prev,
            [newCollaborator.id]: true
          }));
        }
        setPendingGroupStatus(false);
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

  // 临时保存新建时的is_group状态
  const [pendingGroupStatus, setPendingGroupStatus] = useState<boolean>(false);

  // 识别小组成员的函数
  const isGroupCollaborator = useCallback((collaborator: Collaborator) => {
    if (!collaborator) return false;
    
    // 1. 优先使用后端的is_group字段
    if (collaborator.is_group !== undefined) {
      return collaborator.is_group;
    }
    
    // 2. 使用本地标记状态
    if (localGroupMarks[collaborator.id] !== undefined) {
      return localGroupMarks[collaborator.id];
    }
    
    // 3. 临时逻辑：根据名称和班级信息判断
    const groupIndicators = [
      '小组', '团队', '大创团队', '创新大赛小组', 
      '周佳祺 庄晶涵 范佳伟', '田超 王昊 李思佳 凌文杰'
    ];
    
    return groupIndicators.some(indicator => 
      (collaborator.name && collaborator.name.includes(indicator)) || 
      (collaborator.class_name && collaborator.class_name.includes(indicator))
    );
  }, [localGroupMarks]);

  // 排序合作者
  const sortedCollaborators = useMemo(() => {
    const safeCollaborators = handleListResponse<Collaborator>(collaborators, 'CollaboratorManagement.sortedCollaborators');
    return [...safeCollaborators].sort((a, b) => {
      if (!a || !b) return 0;
      
      const aIsGroup = isGroupCollaborator(a);
      const bIsGroup = isGroupCollaborator(b);
      
      // 1. 小组/团队优先
      if (aIsGroup && !bIsGroup) return -1;
      if (!aIsGroup && bIsGroup) return 1;
      
      // 2. 高级合作者优先
      if (a.is_senior && !b.is_senior) return -1;
      if (!a.is_senior && b.is_senior) return 1;
      
      // 3. 在同级别中，女生优先于男生
      if (a.gender === '女' && b.gender !== '女') return -1;
      if (a.gender !== '女' && b.gender === '女') return 1;
      
      // 4. 同性别或都不是女生时，按名字排序
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [collaborators, isGroupCollaborator]);

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
                    <li style={{ color: '#ff4d4f' }}>
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
                    <span style={{ color: '#1890ff' }}>
                      软删除（推荐） - 可以随时恢复
                    </span>
                  </Radio>
                  <Radio value="hard" disabled={!can_hard_delete}>
                    <span style={{ color: '#ff4d4f' }}>
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

  // 处理表单提交
  const handleSubmit = async (values: CollaboratorCreate & { is_senior?: boolean; is_group?: boolean }) => {
    const apiValues: CollaboratorCreate = {
      name: values.name,
      is_senior: values.is_senior || false,
      is_group: values.is_group || false,
    };
    
    // 只有在字段有值时才添加到apiValues中
    if (values.gender !== undefined) {
      apiValues.gender = values.gender;
    }
    if (values.class_name !== undefined) {
      apiValues.class_name = values.class_name;
    }
    if (values.future_plan !== undefined) {
      apiValues.future_plan = values.future_plan;
    }
    if (values.background !== undefined) {
      apiValues.background = values.background;
    }
    
    if (editingCollaborator) {
      // 更新合作者时，同时更新本地标记状态
      setLocalGroupMarks(prev => ({
        ...prev,
        [editingCollaborator.id]: values.is_group || false
      }));
      
      update({ id: editingCollaborator.id, data: apiValues });
    } else {
      // 新建时保存is_group状态
      setPendingGroupStatus(values.is_group || false);
      create(apiValues);
    }
  };

  // 处理编辑
  const handleEdit = (collaborator: Collaborator) => {
    setEditingCollaborator(collaborator);
    form.setFieldsValue({
      ...collaborator,
      is_group: isGroupCollaborator(collaborator),
      is_senior: collaborator.is_senior
    });
    setIsModalVisible(true);
  };

  // 查看详情
  const showDetail = (collaborator: Collaborator) => {
    setSelectedCollaborator(collaborator);
    setIsDetailModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setIsModalVisible(false);
    setEditingCollaborator(null);
    form.resetFields();
  };

  // 获取性别标签颜色
  const getGenderColor = (gender?: string) => {
    if (gender === '男') return 'blue';
    if (gender === '女') return 'pink';
    return 'default';
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 小组合作者行样式 */}
      <style>{`
        .group-collaborator-row {
          background-color: #f9f0ff !important;
          border-left: 3px solid #722ed1 !important;
        }
        .group-collaborator-row:hover {
          background-color: #efdbff !important;
        }
      `}</style>
      
      {/* 页面标题和操作按钮 */}
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            合作者管理
          </Title>
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            <Tag color="purple">小组</Tag> 为团队合作者，<Tag color="gold">高级合作者</Tag> 为特别重要的合作伙伴
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
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCollaborator(null);
              setPendingGroupStatus(false);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            新增合作者
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <CollaboratorStatistics 
        collaborators={collaborators} 
        localGroupMarks={localGroupMarks} 
      />

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
          rowClassName={(record: Collaborator) => 
            isGroupCollaborator(record) ? 'group-collaborator-row' : ''
          }
          columns={[
            {
              title: '姓名',
              dataIndex: 'name',
              key: 'name',
              width: 150,
              render: (name: string, record) => {
                const isParticipating = collaboratorParticipationStatus.get(record.id) || false;
                const isGroup = isGroupCollaborator(record);
                return (
                  <Space>
                    <Avatar 
                      size={32} 
                      icon={isGroup ? <TeamOutlined /> : <UserOutlined />}
                      style={{ 
                        backgroundColor: isGroup ? '#722ed1' : 
                          (record.is_senior ? '#faad14' : (record.gender === '男' ? '#1890ff' : '#eb2f96')),
                      }}
                    />
                    <div>
                      <div>
                        <Text strong style={{ color: isGroup ? '#722ed1' : 'inherit' }}>
                          {isGroup && '👥 '}{name}
                        </Text>
                        {isGroup && (
                          <Tag color="purple" style={{ marginLeft: 8 }}>
                            小组
                          </Tag>
                        )}
                        {record.is_senior && !isGroup && (
                          <Tag color="gold" style={{ marginLeft: 8 }}>
                            高级合作者
                          </Tag>
                        )}
                      </div>
                      {!isParticipating && (
                        <div style={{ marginTop: 4 }}>
                          <Tag color="orange" style={{ fontSize: '12px' }}>
                            未参与项目
                          </Tag>
                        </div>
                      )}
                    </div>
                  </Space>
                );
              },
            },
            {
              title: '性别',
              dataIndex: 'gender',
              key: 'gender',
              width: 80,
              render: (gender: string) => 
                gender ? (
                  <Tag color={getGenderColor(gender)}>{gender}</Tag>
                ) : '-',
              filters: [
                { text: '男', value: '男' },
                { text: '女', value: '女' },
              ],
              onFilter: (value, record) => record.gender === value,
            },
            {
              title: '班级',
              dataIndex: 'class_name',
              key: 'class_name',
              width: 120,
              render: (className: string) => className || '-',
            },
            {
              title: '未来规划',
              dataIndex: 'future_plan',
              key: 'future_plan',
              width: 200,
              ellipsis: { showTitle: false },
              render: (plan: string) => 
                plan ? (
                  <Text ellipsis={{ tooltip: plan }}>{plan}</Text>
                ) : '-',
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
              title: '操作',
              key: 'actions',
              width: 120,
              fixed: 'right',
              render: (_, collaborator) => (
                <Space size="small">
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => showDetail(collaborator)}
                    title="查看详情"
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

      {/* 合作者详情模态框 */}
      <CollaboratorDetailModal
        visible={isDetailModalVisible}
        collaborator={selectedCollaborator}
        isGroupMember={selectedCollaborator ? !!isGroupCollaborator(selectedCollaborator) : false}
        onClose={() => {
          setIsDetailModalVisible(false);
          setSelectedCollaborator(null);
        }}
      />
    </div>
  );
};

export default CollaboratorManagement;