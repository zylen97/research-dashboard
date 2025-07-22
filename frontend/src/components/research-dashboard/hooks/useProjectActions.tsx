import { message, Modal } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { researchApi } from '../../../services/api';
import { ResearchProject } from '../../../types';
import { TodoStatus } from './useProjectData';

export interface ProjectActionsProps {
  getProjectTodoStatus: (project: ResearchProject) => TodoStatus;
  updateLocalTodoStatus: (projectId: number, todoStatus: TodoStatus) => void;
  revertLocalTodoStatus: (projectId: number, previousStatus: TodoStatus) => void;
}

export const useProjectActions = ({
  getProjectTodoStatus,
  updateLocalTodoStatus,
  revertLocalTodoStatus,
}: ProjectActionsProps) => {
  const queryClient = useQueryClient();

  // 创建项目mutation
  const createProjectMutation = useMutation({
    mutationFn: researchApi.createProject,
    onSuccess: () => {
      message.success('研究项目创建成功！');
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any) => {
      message.error('创建失败：' + error.message);
    },
  });

  // 更新项目mutation
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      researchApi.updateProject(id, data),
    onSuccess: () => {
      message.success('项目更新成功！');
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除项目mutation
  const deleteProjectMutation = useMutation({
    mutationFn: researchApi.deleteProject,
    onSuccess: () => {
      message.success('项目删除成功！');
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 切换待办状态 mutation
  const toggleTodoMutation = useMutation({
    mutationFn: ({ id, is_todo }: { id: number; is_todo: boolean }) =>
      researchApi.toggleTodoStatus(id, is_todo),
    onSuccess: (_, variables) => {
      message.success(variables.is_todo ? '已标记为待办事项！' : '已取消待办标记！');
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any, variables) => {
      // 如果API调用失败，恢复本地状态
      const currentTodoStatus = getProjectTodoStatus({ id: variables.id } as ResearchProject);
      revertLocalTodoStatus(variables.id, {
        is_todo: !variables.is_todo, // 恢复到之前的状态
        todo_marked_at: currentTodoStatus.todo_marked_at
      });
      message.error('更新失败：' + error.message);
    },
  });

  // 创建交流日志 mutation
  const createLogMutation = useMutation({
    mutationFn: ({ projectId, logData }: { projectId: number; logData: any }) =>
      researchApi.createCommunicationLog(projectId, logData),
    onSuccess: () => {
      message.success('交流日志创建成功！');
      // 添加短暂延迟确保后端处理完成，然后刷新数据
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['research-projects'] });
        queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      }, 100);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message;
      message.error('创建失败：' + errorMessage);
    },
  });

  // 更新交流日志 mutation
  const updateLogMutation = useMutation({
    mutationFn: ({ projectId, logId, logData }: { projectId: number; logId: number; logData: any }) =>
      researchApi.updateCommunicationLog(projectId, logId, logData),
    onSuccess: () => {
      message.success('交流日志更新成功！');
      // 添加短暂延迟确保后端处理完成，然后刷新数据
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['research-projects'] });
        queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      }, 100);
    },
    onError: (error: any) => {
      message.error('更新失败：' + error.message);
    },
  });

  // 删除交流日志 mutation
  const deleteLogMutation = useMutation({
    mutationFn: ({ projectId, logId }: { projectId: number; logId: number }) =>
      researchApi.deleteCommunicationLog(projectId, logId),
    onSuccess: () => {
      message.success('交流日志删除成功！');
      // 添加短暂延迟确保后端处理完成，然后刷新数据
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['research-projects'] });
        queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      }, 100);
    },
    onError: (error: any) => {
      message.error('删除失败：' + error.message);
    },
  });

  // 处理删除项目
  const handleDeleteProject = (project: ResearchProject) => {
    Modal.confirm({
      title: '删除项目确认',
      width: 520,
      content: (
        <div>
          <p>您即将删除项目：<strong>"{project.title}"</strong></p>
          
          <p style={{ marginTop: 16, marginBottom: 8 }}>
            <strong>删除此项目将会影响以下数据：</strong>
          </p>
          <ul style={{ marginLeft: 20 }}>
            <li>
              <span style={{ color: '#ff4d4f' }}>
                所有相关的交流日志将被永久删除
              </span>
            </li>
            <li>
              合作者的项目关联将被移除
            </li>
          </ul>
          
          <p style={{ color: '#ff4d4f', marginTop: 16, fontWeight: 'bold' }}>
            ⚠️ 此操作不可恢复！请确认是否继续。
          </p>
        </div>
      ),
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteProjectMutation.mutate(project.id);
      },
    });
  };

  // 处理切换待办状态
  const handleToggleTodo = (project: ResearchProject) => {
    const currentTodoStatus = getProjectTodoStatus(project);
    const newTodoStatus = !currentTodoStatus.is_todo;
    
    // 更新本地待办状态
    updateLocalTodoStatus(project.id, {
      is_todo: newTodoStatus,
      todo_marked_at: newTodoStatus ? new Date().toISOString() : ''
    });
    
    // 仍然调用API以保持后端同步（即使后端可能不完全支持）
    toggleTodoMutation.mutate({
      id: project.id,
      is_todo: newTodoStatus,
    });
  };

  return {
    // Mutations
    createProjectMutation,
    updateProjectMutation,
    deleteProjectMutation,
    toggleTodoMutation,
    createLogMutation,
    updateLogMutation,
    deleteLogMutation,
    
    // Action handlers
    handleDeleteProject,
    handleToggleTodo,
    
    // Loading states
    isCreating: createProjectMutation.isPending,
    isUpdating: updateProjectMutation.isPending,
    isDeleting: deleteProjectMutation.isPending,
    isToggling: toggleTodoMutation.isPending,
  };
};