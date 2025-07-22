import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';

interface CRUDApi<T, CreateDTO, UpdateDTO> {
  create: (data: CreateDTO) => Promise<T>;
  update: (id: number, data: UpdateDTO) => Promise<T>;
  delete: (id: number) => Promise<void>;
}

export function useTableCRUD<T, CreateDTO, UpdateDTO>(
  apiModule: CRUDApi<T, CreateDTO, UpdateDTO>,
  queryKey: string,
  options?: {
    onCreateSuccess?: (data: T) => void;
    onUpdateSuccess?: (data: T) => void;
    onDeleteSuccess?: () => void;
  }
) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: apiModule.create,
    onSuccess: (data) => {
      message.success('创建成功！');
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      options?.onCreateSuccess?.(data);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDTO }) =>
      apiModule.update(id, data),
    onSuccess: (data) => {
      message.success('更新成功！');
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      options?.onUpdateSuccess?.(data);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiModule.delete,
    onSuccess: () => {
      message.success('删除成功！');
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      options?.onDeleteSuccess?.();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}