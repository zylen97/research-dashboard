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

  // 按待办状态排序项目：待办项目置顶，然后按项目进度日期倒序
  const sortedProjects = useMemo(() => {
    // 状态优先级映射（用于非待办项目排序）- 扩展更多状态（v4.7.1）
    const STATUS_PRIORITY: Record<string, number> = {
      'writing': 1,      // 撰写中
      'submitting': 2,   // 投稿中
      'published': 3,    // 已发表
      'draft': 4,        // 草稿
      'rejected': 5,     // 已拒稿
      'under_review': 6, // 审稿中
    };

    // 获取状态优先级的辅助函数（P1-6）
    const getStatusPriority = (status: string): number => {
      return STATUS_PRIORITY[status] ?? 999;
    };

    // 获取最新项目进度日期，添加日期有效性检查（P2-7）
    const getLatestCommunicationDate = (project: ResearchProject): Date | null => {
      const logs = project.communication_logs || [];
      if (logs.length === 0) return null;

      const sortedLogs = [...logs].sort((logA, logB) => {
        const dateA = new Date(logA.communication_date || logA.created_at);
        const dateB = new Date(logB.communication_date || logB.created_at);

        // 检查日期是否有效
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;

        return dateB.getTime() - dateA.getTime();
      });

      const latestLog = sortedLogs[0];
      if (!latestLog) return null;

      const date = new Date(latestLog.communication_date || latestLog.created_at);
      return isNaN(date.getTime()) ? null : date;
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
          const aTime = new Date(aTodoStatus.marked_at).getTime();
          const bTime = new Date(bTodoStatus.marked_at).getTime();
          // 检查日期有效性
          if (!isNaN(aTime) && !isNaN(bTime)) {
            return bTime - aTime;
          }
        }
        return 0;
      }

      // 3. 都不是待办项目时，先按状态优先级排序，再按项目进度日期倒序
      // 状态优先级：writing(撰写中) → submitting(投稿中) → published(已发表)
      const aStatusPriority = getStatusPriority(a.status);
      const bStatusPriority = getStatusPriority(b.status);
      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }

      // 4. 状态相同时，按项目进度日期倒序排列
      const aLatestDate = getLatestCommunicationDate(a);
      const bLatestDate = getLatestCommunicationDate(b);

      // 有项目进度的项目优先于没有项目进度的项目
      if (aLatestDate && !bLatestDate) return -1;
      if (!aLatestDate && bLatestDate) return 1;

      // 都有项目进度时，按最新记录日期倒序
      if (aLatestDate && bLatestDate) {
        return bLatestDate.getTime() - aLatestDate.getTime();
      }

      // 都没有项目进度时，按创建时间倒序
      const aCreated = new Date(a.created_at).getTime();
      const bCreated = new Date(b.created_at).getTime();
      // 检查创建日期有效性
      if (isNaN(aCreated)) return 1;
      if (isNaN(bCreated)) return -1;
      return bCreated - aCreated;
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