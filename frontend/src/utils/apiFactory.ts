/**
 * API CRUD 工厂函数 - 减少重复的CRUD代码
 */
import api from '../services/apiOptimized';
import { handleListResponse } from './dataFormatters';
import { PaginationParams } from '../types';

export interface CRUDEndpoints<T, CreateDTO, UpdateDTO> {
  getList: (params?: PaginationParams & Record<string, any>) => Promise<T[]>;
  getById: (id: number) => Promise<T>;
  create: (data: CreateDTO) => Promise<T>;
  update: (id: number, data: UpdateDTO) => Promise<T>;
  delete: (id: number, permanent?: boolean) => Promise<{ message: string }>;
}

/**
 * 创建标准CRUD API端点
 * @param basePath - API基础路径，如 '/collaborators', '/research'
 * @param listResponseContext - 列表响应的上下文名称，用于日志
 */
export function createCRUDApi<T, CreateDTO, UpdateDTO>(
  basePath: string,
  listResponseContext?: string
): CRUDEndpoints<T, CreateDTO, UpdateDTO> {
  // 确保路径以斜杠开头
  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  // 移除末尾斜杠
  const cleanPath = normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : normalizedPath;

  return {
    getList: async (params?: PaginationParams & Record<string, any>): Promise<T[]> => {
      const response = await api.get(`${cleanPath}/`, { params });
      return handleListResponse<T>(response, listResponseContext || `API.${cleanPath.slice(1)}.getList`);
    },

    getById: (id: number): Promise<T> => 
      api.get(`${cleanPath}/${id}`),

    create: (data: CreateDTO): Promise<T> =>
      api.post(`${cleanPath}/`, data),

    update: (id: number, data: UpdateDTO): Promise<T> =>
      api.put(`${cleanPath}/${id}`, data),

    delete: (id: number, permanent: boolean = false): Promise<{ message: string }> =>
      api.delete(`${cleanPath}/${id}${permanent ? '?permanent=true' : ''}`),
  };
}

/**
 * 创建带有额外端点的CRUD API
 * @param basePath - API基础路径
 * @param listResponseContext - 列表响应的上下文名称
 * @param extraEndpoints - 额外的端点定义
 */
export function createExtendedCRUDApi<T, CreateDTO, UpdateDTO, Extra = {}>(
  basePath: string,
  listResponseContext?: string,
  extraEndpoints?: (basePath: string) => Extra
): CRUDEndpoints<T, CreateDTO, UpdateDTO> & Extra {
  const crudEndpoints = createCRUDApi<T, CreateDTO, UpdateDTO>(basePath, listResponseContext);
  
  if (!extraEndpoints) {
    return crudEndpoints as CRUDEndpoints<T, CreateDTO, UpdateDTO> & Extra;
  }

  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const cleanPath = normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : normalizedPath;
  
  return {
    ...crudEndpoints,
    ...extraEndpoints(cleanPath)
  };
}