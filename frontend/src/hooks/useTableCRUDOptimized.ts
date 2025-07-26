import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useErrorHandler } from '../utils/errorHandlerOptimized';

interface CRUDApi<T, CreateDTO, UpdateDTO> {
  create: (data: CreateDTO) => Promise<T>;
  update: (id: number, data: UpdateDTO) => Promise<T>;
  delete: (id: number, permanent?: boolean) => Promise<{ message: string }>;
}

interface UseTableCRUDOptions<T> {
  onCreateSuccess?: (data: T) => void;
  onUpdateSuccess?: (data: T) => void;
  onDeleteSuccess?: () => void;
  // 自定义成功消息
  createSuccessMessage?: string;
  updateSuccessMessage?: string;
  deleteSuccessMessage?: string;
  // 自定义错误消息
  createErrorMessage?: string;
  updateErrorMessage?: string;
  deleteErrorMessage?: string;
}

/**
 * 优化后的表格CRUD Hook - 集成统一错误处理
 */
export function useTableCRUD<T, CreateDTO, UpdateDTO>(
  apiModule: CRUDApi<T, CreateDTO, UpdateDTO>,
  queryKey: string,
  options?: UseTableCRUDOptions<T>
) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useErrorHandler();

  const createMutation = useMutation({
    mutationFn: apiModule.create,
    onSuccess: (data) => {
      showSuccess('create', options?.createSuccessMessage);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      options?.onCreateSuccess?.(data);
    },
    onError: (error: any) => {
      showError(error, 'create');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDTO }) =>
      apiModule.update(id, data),
    onSuccess: (data) => {
      showSuccess('update', options?.updateSuccessMessage);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      options?.onUpdateSuccess?.(data);
    },
    onError: (error: any) => {
      showError(error, 'update');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiModule.delete,
    onSuccess: () => {
      showSuccess('delete', options?.deleteSuccessMessage);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      options?.onDeleteSuccess?.();
    },
    onError: (error: any) => {
      showError(error, 'delete');
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    // 便捷方法
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    // 异步方法（返回Promise）
    createAsync: createMutation.mutateAsync,
    updateAsync: updateMutation.mutateAsync,
    deleteAsync: deleteMutation.mutateAsync,
  };
}