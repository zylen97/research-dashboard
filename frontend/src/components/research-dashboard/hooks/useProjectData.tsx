import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { researchApi, collaboratorApi } from '../../../services/api';
import { ResearchProject } from '../../../types';

export interface TodoStatus {
  is_todo: boolean;
  todo_marked_at: string;
}

export const useProjectData = () => {
  // 本地管理待办状态（后端支持前的临时方案）
  const [localTodoMarks, setLocalTodoMarks] = useState<Record<number, TodoStatus>>(() => {
    try {
      const saved = localStorage.getItem('project-todo-marks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 持久化本地待办状态
  useEffect(() => {
    localStorage.setItem('project-todo-marks', JSON.stringify(localTodoMarks));
  }, [localTodoMarks]);

  // 获取研究项目数据
  const { data: projects = [], isLoading: isProjectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['research-projects'],
    queryFn: () => researchApi.getProjects(),
  });

  // 获取合作者数据（用于下拉选择）
  const { data: collaborators = [], isLoading: isCollaboratorsLoading, refetch: refetchCollaborators } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => collaboratorApi.getCollaborators(),
  });

  // 获取项目的待办状态
  const getProjectTodoStatus = (project: ResearchProject): TodoStatus => {
    // 1. 优先使用本地标记状态
    const localMark = localTodoMarks[project.id];
    if (localMark !== undefined) {
      return localMark;
    }
    
    // 2. 后端支持is_todo字段时直接返回
    if (project.is_todo !== undefined) {
      return {
        is_todo: project.is_todo,
        todo_marked_at: project.todo_marked_at || new Date().toISOString()
      };
    }
    
    // 3. 默认不是待办状态
    return { is_todo: false, todo_marked_at: '' };
  };

  // 按待办状态排序项目：待办项目置顶
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aTodoStatus = getProjectTodoStatus(a);
      const bTodoStatus = getProjectTodoStatus(b);
      
      // 1. 待办项目优先
      if (aTodoStatus.is_todo && !bTodoStatus.is_todo) return -1;
      if (!aTodoStatus.is_todo && bTodoStatus.is_todo) return 1;
      
      // 2. 都是待办项目时，按标记时间倒序（最新标记的在最前面）
      if (aTodoStatus.is_todo && bTodoStatus.is_todo) {
        if (aTodoStatus.todo_marked_at && bTodoStatus.todo_marked_at) {
          return new Date(bTodoStatus.todo_marked_at).getTime() - new Date(aTodoStatus.todo_marked_at).getTime();
        }
        return 0;
      }
      
      // 3. 都不是待办项目时，按创建时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [projects, localTodoMarks]);

  // 更新本地待办状态
  const updateLocalTodoStatus = (projectId: number, todoStatus: TodoStatus) => {
    setLocalTodoMarks(prev => ({
      ...prev,
      [projectId]: todoStatus
    }));
  };

  // 恢复本地待办状态（API失败时使用）
  const revertLocalTodoStatus = (projectId: number, previousStatus: TodoStatus) => {
    setLocalTodoMarks(prev => ({
      ...prev,
      [projectId]: previousStatus
    }));
  };

  // 统一的刷新函数
  const refetch = async () => {
    await Promise.all([refetchProjects(), refetchCollaborators()]);
  };

  return {
    // 数据
    projects,
    sortedProjects,
    collaborators,
    localTodoMarks,
    
    // 状态
    isProjectsLoading,
    isCollaboratorsLoading,
    isLoading: isProjectsLoading || isCollaboratorsLoading,
    
    // 方法
    getProjectTodoStatus,
    updateLocalTodoStatus,
    revertLocalTodoStatus,
    refetch,
  };
};