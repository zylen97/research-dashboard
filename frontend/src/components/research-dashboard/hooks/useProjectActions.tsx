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

  // 标记为待办 mutation
  const markAsTodoMutation = useMutation({
    mutationFn: (id: number) =>
      researchApi.markAsTodo(id),
    onSuccess: () => {
      message.success('已标记为待办事项！');
      queryClient.invalidateQueries({ queryKey: ['user-todos'] });
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any, variables) => {
      // 如果API调用失败，恢复本地状态
      revertLocalTodoStatus(variables, {
        is_todo: false,
        marked_at: null,
        priority: null,
        notes: null
      });
      message.error('标记失败：' + error.message);
    },
  });

  // 取消待办 mutation
  const unmarkTodoMutation = useMutation({
    mutationFn: (id: number) => researchApi.unmarkTodo(id),
    onSuccess: () => {
      message.success('已取消待办标记！');
      queryClient.invalidateQueries({ queryKey: ['user-todos'] });
      queryClient.invalidateQueries({ queryKey: ['research-projects'] });
    },
    onError: (error: any, variables, context: any) => {
      // 如果API调用失败，恢复本地状态
      if (context?.previousStatus) {
        revertLocalTodoStatus(variables, context.previousStatus);
      }
      message.error('取消失败：' + error.message);
    },
  });

  // 创建论文进度 mutation
  const createLogMutation = useMutation({
    mutationFn: ({ projectId, logData }: { projectId: number; logData: any }) =>
      researchApi.createCommunicationLog(projectId, logData),
    onSuccess: () => {
      message.success('论文进度创建成功！');
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

  // 更新论文进度 mutation
  const updateLogMutation = useMutation({
    mutationFn: ({ projectId, logId, logData }: { projectId: number; logId: number; logData: any }) =>
      researchApi.updateCommunicationLog(projectId, logId, logData),
    onSuccess: () => {
      message.success('论文进度更新成功！');
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

  // 删除论文进度 mutation
  const deleteLogMutation = useMutation({
    mutationFn: ({ projectId, logId }: { projectId: number; logId: number }) =>
      researchApi.deleteCommunicationLog(projectId, logId),
    onSuccess: () => {
      message.success('论文进度删除成功！');
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
                所有相关的论文进度将被永久删除
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
    const previousStatus = { ...currentTodoStatus };

    if (!currentTodoStatus.is_todo) {
      // 标记为待办
      updateLocalTodoStatus(project.id, {
        is_todo: true,
        marked_at: new Date().toISOString(),
        priority: 0,
        notes: null
      });

      markAsTodoMutation.mutate(project.id);
    } else {
      // 取消待办
      updateLocalTodoStatus(project.id, {
        is_todo: false,
        marked_at: null,
        priority: null,
        notes: null
      });

      unmarkTodoMutation.mutateAsync(project.id, {
        onError: () => {
          // 传递之前的状态以便回滚
          return { previousStatus };
        }
      });
    }
  };

  return {
    // Mutations
    createProjectMutation,
    updateProjectMutation,
    deleteProjectMutation,
    markAsTodoMutation,
    unmarkTodoMutation,
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
    isToggling: markAsTodoMutation.isPending || unmarkTodoMutation.isPending,
  };
};