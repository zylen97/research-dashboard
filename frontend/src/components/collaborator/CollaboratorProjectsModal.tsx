import React, { useState, useMemo } from 'react';
import { Modal, Table, Typography, Space, Button } from 'antd';
import { ProjectOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { collaboratorApi } from '../../services/apiOptimized';
import { Collaborator, ResearchProject } from '../../types';
import { createProjectColumns } from '../research-dashboard/table-columns/projectColumns';
import ProjectPreviewModal from '../research-dashboard/ProjectPreviewModal';

const { Text } = Typography;

interface CollaboratorProjectsModalProps {
  visible: boolean;
  collaborator: Collaborator | null;
  onClose: () => void;
}

/**
 * 合作者相关项目弹窗
 * 显示某个合作者参与的所有研究项目
 */
export const CollaboratorProjectsModal: React.FC<CollaboratorProjectsModalProps> = ({
  visible,
  collaborator,
  onClose,
}) => {
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 获取合作者的项目列表
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['collaborator-projects', collaborator?.id],
    queryFn: () => collaborator ? collaboratorApi.getCollaboratorProjects(collaborator.id) : Promise.resolve([]),
    enabled: visible && !!collaborator,
  });

  // 响应拦截器已确保返回数组
  const projects = (projectsData || []) as ResearchProject[];

  // 项目操作配置（简化版 - 只保留预览功能）
  const projectActions = useMemo(() => ({
    onEdit: () => {},
    onDelete: () => {},
    onViewLogs: () => {},
    onToggleTodo: () => {},
    onPreview: (project: ResearchProject) => {
      setSelectedProject(project);
      setIsPreviewModalVisible(true);
    },
  }), []);

  // 待办状态getter
  const getProjectTodoStatus = (project: ResearchProject) => ({
    is_todo: project.is_todo || false,
    marked_at: project.todo_marked_at || null,
    priority: null,
    notes: null,
  });

  // 创建表格列（隐藏"合作者"列，简化操作列）
  const columns = useMemo(() => {
    const allColumns = createProjectColumns({
      actions: projectActions,
      getProjectTodoStatus,
      currentPage,
      pageSize,
    });

    return allColumns.map(col => {
      if (col.key === 'collaborators') {
        // 隐藏合作者列
        return { ...col, width: 0, render: () => null };
      }
      if (col.key === 'actions') {
        // 只保留预览按钮
        return {
          ...col,
          width: 80,
          render: (_: any, project: ResearchProject) => (
            <Space size="small">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => projectActions.onPreview(project)}
                title="预览详情"
              />
            </Space>
          ),
        };
      }
      return col;
    }).filter(col => col.width !== 0);
  }, [projectActions, currentPage, pageSize]);

  if (!collaborator) return null;

  return (
    <>
      <Modal
        title={
          <Space>
            <TeamOutlined style={{ color: '#333333' }} />
            <span>{collaborator.name} 的相关项目</span>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        {/* 统计信息 */}
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: '4px' }}>
          <Space size="large">
            <Text>
              <ProjectOutlined /> 共参与 <strong>{projects.length}</strong> 个项目
            </Text>
            <Text type="secondary">
              进行中：{projects.filter(p => p.status === 'active').length} 个
            </Text>
            <Text type="secondary">
              已完成：{projects.filter(p => p.status === 'completed').length} 个
            </Text>
          </Space>
        </div>

        {/* 项目表格 */}
        <Table
          size="small"
          dataSource={projects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: projects.length,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Modal>

      {/* 项目预览弹窗 */}
      <ProjectPreviewModal
        visible={isPreviewModalVisible}
        project={selectedProject}
        onClose={() => {
          setIsPreviewModalVisible(false);
          setSelectedProject(null);
        }}
      />
    </>
  );
};

export default CollaboratorProjectsModal;
