import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { researchApi, collaboratorApi } from '../../../services/apiOptimized';
import { ResearchProject } from '../../../types';

export interface TodoStatus {
  is_todo: boolean;
  marked_at: string | null;
  priority: number | null;
  notes: string | null;
}

export interface ProjectFilters {
  status?: string | undefined;
  my_role?: string | undefined;
  research_method?: string | undefined;
  target_journal?: string | undefined;
  reference_journal?: string | undefined;
}

export const useProjectData = (filters: ProjectFilters = {}) => {
  // 获取用户的待办项目列表
  const { data: userTodosData, refetch: refetchTodos } = useQuery({
    queryKey: ['user-todos'],
    queryFn: () => researchApi.getUserTodos(),
  });
  
  const userTodos = Array.isArray(userTodosData) ? userTodosData : [];

  // 缓存待办状态
  const [todoStatusCache, setTodoStatusCache] = useState<Record<number, TodoStatus>>({});

  // 获取研究项目数据
  const { data: projectsData, isLoading: isProjectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['research-projects', filters],
    queryFn: () => researchApi.getProjects(filters as any),
  });

  // 获取合作者数据（用于下拉选择）
  const { data: collaboratorsData, isLoading: isCollaboratorsLoading, refetch: refetchCollaborators } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => collaboratorApi.getCollaborators(),
  });

  // 确保数据始终是数组
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const collaborators = Array.isArray(collaboratorsData) ? collaboratorsData : [];

  // 更新待办缓存
  useEffect(() => {
    const cache: Record<number, TodoStatus> = {};
    userTodos.forEach((todo: any) => {
      cache[todo.id] = {
        is_todo: true,
        marked_at: todo.user_todo_marked_at || todo.marked_at,
        priority: todo.user_todo_priority || todo.priority || 0,
        notes: todo.user_todo_notes || todo.notes || null
      };
    });
    setTodoStatusCache(cache);
  }, [userTodos]);

  // 获取项目的待办状态
  const getProjectTodoStatus = useCallback((project: ResearchProject): TodoStatus => {
    // 从缓存中获取
    const cached = todoStatusCache[project.id];
    if (cached) {
      return cached;
    }
    
    // 默认不是待办状态
    return { is_todo: false, marked_at: null, priority: null, notes: null };
  }, [todoStatusCache]);

  // 按待办状态排序项目：待办项目置顶，然后按论文进度日期倒序
  const sortedProjects = useMemo(() => {
    // 状态优先级映射（用于非待办项目排序）
    const STATUS_PRIORITY: Record<string, number> = {
      'writing': 1,      // 撰写中
      'submitting': 2,   // 投稿中
      'published': 3,    // 已发表
    };

    return [...projects].sort((a, b) => {
      const aTodoStatus = getProjectTodoStatus(a);
      const bTodoStatus = getProjectTodoStatus(b);

      // 1. 待办项目优先
      if (aTodoStatus.is_todo && !bTodoStatus.is_todo) return -1;
      if (!aTodoStatus.is_todo && bTodoStatus.is_todo) return 1;

      // 2. 都是待办项目时，先按优先级排序（高优先级在前），再按标记时间倒序
      if (aTodoStatus.is_todo && bTodoStatus.is_todo) {
        // 优先级比较
        if (aTodoStatus.priority !== bTodoStatus.priority) {
          return (bTodoStatus.priority || 0) - (aTodoStatus.priority || 0);
        }
        // 标记时间比较
        if (aTodoStatus.marked_at && bTodoStatus.marked_at) {
          return new Date(bTodoStatus.marked_at).getTime() - new Date(aTodoStatus.marked_at).getTime();
        }
        return 0;
      }

      // 3. 都不是待办项目时，先按状态优先级排序，再按论文进度日期倒序
      // 状态优先级：writing(撰写中) → submitting(投稿中) → published(已发表)
      const aStatusPriority = STATUS_PRIORITY[a.status] || 999;
      const bStatusPriority = STATUS_PRIORITY[b.status] || 999;
      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }

      // 4. 状态相同时，按论文进度日期倒序排列
      // 获取最新论文进度记录的日期
      const getLatestCommunicationDate = (project: ResearchProject) => {
        const logs = project.communication_logs || [];
        if (logs.length === 0) return null;

        const sortedLogs = [...logs].sort((logA, logB) => {
          const dateA = new Date(logA.communication_date || logA.created_at);
          const dateB = new Date(logB.communication_date || logB.created_at);
          return dateB.getTime() - dateA.getTime();
        });

        const latestLog = sortedLogs[0];
        if (!latestLog) return null;

        return new Date(latestLog.communication_date || latestLog.created_at);
      };

      const aLatestDate = getLatestCommunicationDate(a);
      const bLatestDate = getLatestCommunicationDate(b);

      // 有论文进度的项目优先于没有论文进度的项目
      if (aLatestDate && !bLatestDate) return -1;
      if (!aLatestDate && bLatestDate) return 1;

      // 都有论文进度时，按最新记录日期倒序
      if (aLatestDate && bLatestDate) {
        return bLatestDate.getTime() - aLatestDate.getTime();
      }

      // 都没有论文进度时，按创建时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [projects, getProjectTodoStatus]);

  // 更新本地待办状态缓存（乐观更新）
  const updateLocalTodoStatus = (projectId: number, todoStatus: TodoStatus) => {
    setTodoStatusCache(prev => ({
      ...prev,
      [projectId]: todoStatus
    }));
  };

  // 恢复本地待办状态（API失败时使用）
  const revertLocalTodoStatus = (projectId: number, previousStatus: TodoStatus) => {
    setTodoStatusCache(prev => ({
      ...prev,
      [projectId]: previousStatus
    }));
  };

  // 统一的刷新函数
  const refetch = async () => {
    await Promise.all([refetchProjects(), refetchCollaborators(), refetchTodos()]);
  };

  return {
    // 数据
    projects,
    sortedProjects,
    collaborators,
    todoStatusCache,
    userTodos,
    
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