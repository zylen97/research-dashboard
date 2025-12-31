/**
 * 优化后的API服务 - 使用工厂函数减少重复代码
 */
import axios from 'axios';
import {
  Collaborator, CollaboratorCreate, CollaboratorUpdate,
  ResearchProject, ResearchProjectCreate, ResearchProjectUpdate,
  CommunicationLog, CommunicationLogCreate, CommunicationLogUpdate,
  FileUploadResponse,
  SystemConfig, SystemConfigCreate, SystemConfigUpdate,
  AIProvider, AIProviderCreate, AITestResponse,
  BackupStats, BackupListResponse, BackupCreateResponse
} from '../types';
import { Idea, IdeaCreate, IdeaUpdate, ConvertToProjectResponse } from '../types/ideas';
import {
  Journal, JournalCreate, JournalUpdate,
  JournalStats, JournalReferences, JournalBatchImportResponse,
  Tag, TagCreate, TagUpdate
} from '../types/journals';
import { handleListResponse } from '../utils/dataFormatters';
import { errorInterceptor } from '../utils/errorHandler';
import { createCRUDApi, createExtendedCRUDApi } from '../utils/apiFactory';
import { API_CONFIG } from '../config/api';
import { ENV } from '../config/environment';

// 创建axios实例
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    if (config.url && !config.url.startsWith(ENV.API_PREFIX) && !config.url.startsWith('http')) {
      config.url = ENV.API_PREFIX + config.url;
    }

    // 已移除认证系统 - 不再添加Authorization头
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response;
    }
    
    const data = response.data;
    
    if (data && typeof data === 'object' && 'success' in data) {
      if (!data.success) {
        const error: any = new Error(data.message || 'API call failed');
        error.response = data;
        throw error;
      }
      return data.data || data;
    }
    
    return data;
  },
  errorInterceptor
);

// 合作者API - 使用工厂函数创建基础CRUD，然后添加额外方法
export const collaboratorApi = {
  ...createCRUDApi<Collaborator, CollaboratorCreate, CollaboratorUpdate>(
    '/collaborators',
    'API.getCollaborators'
  ),
  
  // 重写delete方法以支持force参数
  deleteCollaborator: async (id: number, force: boolean = false) => {
    const response = await api.delete(`/collaborators/${id}`, {
      params: { force }
    });
    return response;
  },
  
  // 额外的方法
  getCollaboratorProjects: async (id: number): Promise<ResearchProject[]> => {
    const response = await api.get(`/collaborators/${id}/projects`);
    return handleListResponse<ResearchProject>(response, 'API.getCollaboratorProjects');
  },

  uploadCollaboratorsFile: (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/collaborators/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  cleanCollaboratorNames: (keyword: string = 'srtp') =>
    api.post(`/collaborators/clean-names?keyword=${keyword}`),
  
  createCollaboratorsBatch: (collaborators: CollaboratorCreate[]) =>
    api.post('/collaborators/create-batch', collaborators),
  
  createCollaboratorGroup: (groupName: string, memberNames: string[]) =>
    api.post('/collaborators/create-group', {
      group_name: groupName,
      member_names: memberNames,
    }),
  
  getCollaboratorDependencies: (id: number) =>
    api.get(`/validation/collaborator/${id}/dependencies`),
    
  restoreCollaborator: (id: number) =>
    api.post(`/collaborators/${id}/restore`),
    
  getDeletedCollaborators: () =>
    api.get('/collaborators/deleted/list'),
    
  checkCollaboratorDependencies: (id: number) =>
    api.get(`/collaborators/${id}/check-dependencies`),
};

// 研究项目API
export const researchApi = createExtendedCRUDApi<
  ResearchProject,
  ResearchProjectCreate, 
  ResearchProjectUpdate,
  {
    getCommunicationLogs: (id: number) => Promise<CommunicationLog[]>;
    createCommunicationLog: (projectId: number, data: CommunicationLogCreate) => Promise<CommunicationLog>;
    updateCommunicationLog: (projectId: number, logId: number, data: CommunicationLogUpdate) => Promise<CommunicationLog>;
    deleteCommunicationLog: (projectId: number, logId: number) => Promise<{ message: string }>;
    updateProgress: (id: number, progress: number) => Promise<{ message: string; progress: number }>;
    getUserTodos: () => Promise<ResearchProject[]>;
    markAsTodo: (projectId: number, priority?: number, notes?: string) => Promise<{ message: string }>;
    unmarkTodo: (projectId: number) => Promise<{ message: string }>;
    getTodoStatus: (projectId: number) => Promise<any>;
    checkProjectDependencies: (id: number) => Promise<any>;
  }
>(
  '/research',
  'API.getProjects',
  (basePath) => ({
    getCommunicationLogs: (id: number) =>
      api.get(`${basePath}/${id}/logs`),
      
    createCommunicationLog: (projectId: number, data: CommunicationLogCreate) =>
      api.post(`${basePath}/${projectId}/logs`, data),
      
    updateCommunicationLog: (projectId: number, logId: number, data: CommunicationLogUpdate) =>
      api.put(`${basePath}/${projectId}/logs/${logId}`, data),
      
    deleteCommunicationLog: (projectId: number, logId: number) =>
      api.delete(`${basePath}/${projectId}/logs/${logId}`),
      
    updateProgress: (id: number, progress: number) =>
      api.put(`${basePath}/${id}/progress`, null, { params: { progress } }),
      
    getUserTodos: async () => {
      const response = await api.get(`${basePath}/todos`);
      return handleListResponse<ResearchProject>(response, 'API.getUserTodos');
    },
    
    markAsTodo: (projectId: number, priority?: number, notes?: string) =>
      api.post(`${basePath}/${projectId}/todo`, { priority, notes }),
      
    unmarkTodo: (projectId: number) =>
      api.delete(`${basePath}/${projectId}/todo`),
      
    getTodoStatus: (projectId: number) =>
      api.get(`${basePath}/${projectId}/todo-status`),
      
    checkProjectDependencies: (id: number) =>
      api.get(`${basePath}/${id}/check-dependencies`),
  })
);

// 已移除认证系统 - authApi 已删除

// 系统配置API
export const configApi = createExtendedCRUDApi<
  SystemConfig,
  SystemConfigCreate,
  SystemConfigUpdate,
  {
    getAIProviders: () => Promise<AIProvider[]>;
    createAIProvider: (data: AIProviderCreate) => Promise<SystemConfig>;
    testAIProvider: (data: any) => Promise<AITestResponse>;
  }
>(
  '/config',
  'API.getConfigs',
  (basePath) => ({
    getAIProviders: () => api.get(`${basePath}/ai/providers`),
    createAIProvider: (data: AIProviderCreate) => api.post(`${basePath}/ai/providers`, data),
    testAIProvider: (data: any) => api.post(`${basePath}/ai/test`, data),
  })
);

// 备份管理API
export const backupApi = {
  getStats: (): Promise<BackupStats> =>
    api.get('/backup/stats'),

  getBackups: (): Promise<BackupListResponse> =>
    api.get('/backup/list'),

  createBackup: (): Promise<BackupCreateResponse> =>
    api.post('/backup/create'),

  restoreBackup: (backupId: string): Promise<{ message: string }> =>
    api.post(`/backup/restore/${backupId}`),

  deleteBackup: (backupId: string): Promise<{ message: string }> =>
    api.delete(`/backup/${backupId}`),

  downloadBackup: (backupId: string): Promise<Blob> =>
    api.get(`/backup/download/${backupId}`, { responseType: 'blob' }),
};

// Ideas管理API - 使用扩展CRUD工厂，包含转化功能和增强错误处理
export const ideasApi = createExtendedCRUDApi<
  Idea,
  IdeaCreate,
  IdeaUpdate,
  {
    convertToProject: (id: number) => Promise<ConvertToProjectResponse>;
    getIdeasSafe: () => Promise<Idea[]>;
  }
>(
  '/ideas',
  'API.getIdeas',
  (basePath) => ({
    convertToProject: async (id: number): Promise<ConvertToProjectResponse> => {
      try {
        const response = await api.post(`${basePath}/${id}/convert-to-project`);
        return response.data;
      } catch (error) {
        console.error('Ideas转化为项目失败:', error);
        throw error;
      }
    },
    // 超强化的安全获取方法，绝对确保返回数组，修复"q.some is not a function"错误
    getIdeasSafe: async (): Promise<Idea[]> => {
      try {
        console.log('[API.getIdeasSafe] 开始请求Ideas数据...');
        const response = await api.get(`${basePath}/`);
        console.log('[API.getIdeasSafe] 原始响应:', response);
        
        const data = handleListResponse<Idea>(response, 'API.getIdeasSafe');
        console.log('[API.getIdeasSafe] handleListResponse处理后的数据:', data, '类型:', typeof data, '是否为数组:', Array.isArray(data));
        
        // 多重数组验证
        if (!data) {
          console.warn('[API.getIdeasSafe] 数据为null/undefined，返回空数组');
          return [];
        }
        
        if (!Array.isArray(data)) {
          console.warn('[API.getIdeasSafe] 响应不是数组，类型:', typeof data, '内容:', data);
          
          // 尝试从各种可能的结构中提取数组
          if (typeof data === 'object' && data !== null) {
            // 检查常见的数组包装字段
            const possibleArrayFields = ['data', 'items', 'results', 'list', 'ideas'];
            
            for (const field of possibleArrayFields) {
              if (field in data && Array.isArray((data as any)[field])) {
                console.log(`[API.getIdeasSafe] 从.${field}字段提取数组`);
                return (data as any)[field];
              }
            }
            
            // 如果是对象的值都看起来像Ideas，尝试转换
            const values = Object.values(data);
            if (values.length > 0 && values.every(item => 
              typeof item === 'object' && 
              item !== null && 
              'id' in item
            )) {
              console.log('[API.getIdeasSafe] 将对象值转换为数组');
              return values as Idea[];
            }
          }
          
          console.error('[API.getIdeasSafe] 无法提取数组，强制返回空数组');
          return [];
        }
        
        // 验证数组元素
        const validatedData = data.filter(item => {
          if (!item || typeof item !== 'object' || !('id' in item)) {
            console.warn('[API.getIdeasSafe] 过滤无效Ideas项目:', item);
            return false;
          }
          return true;
        });
        
        console.log('[API.getIdeasSafe] 最终返回数组长度:', validatedData.length);
        return validatedData;
        
      } catch (error) {
        console.error('[API.getIdeasSafe] API请求失败:', error);
        
        // 确保即使在错误情况下也返回数组
        return [];
      }
    },
  })
);



// 其他API保持原样...
export const validationApi = {
  getProjectDependencies: (id: number) =>
    api.get(`/validation/project/${id}/dependencies`),

  validateProject: (data: any) =>
    api.post('/validation/project/validate', data),

  validateCollaborator: (data: any) =>
    api.post('/validation/collaborator/validate', data),

  checkConsistency: () =>
    api.get('/validation/consistency'),
};

// 标签管理API - 提供标签的CRUD操作和关联查询
export const tagApi = createExtendedCRUDApi<
  Tag,
  TagCreate,
  TagUpdate,
  {
    getTags: (params?: { search?: string }) => Promise<Tag[]>;
    getTagJournals: (tagId: number) => Promise<Journal[]>;
  }
>(
  '/tags',
  'API.getTags',
  (basePath) => ({
    getTags: async (params?: { search?: string }): Promise<Tag[]> => {
      try {
        const response = await api.get(`${basePath}/`, { params });
        return handleListResponse<Tag>(response, 'API.getTags');
      } catch (error) {
        console.error('获取标签列表失败:', error);
        return [];
      }
    },

    getTagJournals: async (tagId: number): Promise<Journal[]> => {
      try {
        const response = await api.get(`${basePath}/${tagId}/journals`);
        return handleListResponse<Journal>(response, 'API.getTagJournals');
      } catch (error) {
        console.error('获取标签期刊列表失败:', error);
        return [];
      }
    },
  })
);

// 期刊库API - 使用扩展CRUD工厂，包含统计和批量导入功能
export const journalApi = createExtendedCRUDApi<
  Journal,
  JournalCreate,
  JournalUpdate,
  {
    getJournals: (params?: { tag_ids?: string; search?: string }) => Promise<Journal[]>;
    getJournalStats: (id: number) => Promise<JournalStats>;
    getJournalReferences: (id: number, refType?: 'reference' | 'target') => Promise<JournalReferences>;
    batchImport: (journals: JournalCreate[]) => Promise<JournalBatchImportResponse>;
  }
>(
  '/journals',
  'API.getJournals',
  (basePath) => ({
    getJournals: async (params?: { tag_ids?: string; search?: string }): Promise<Journal[]> => {
      try {
        const response = await api.get(`${basePath}/`, { params });
        return handleListResponse<Journal>(response, 'API.getJournals');
      } catch (error) {
        console.error('获取期刊列表失败:', error);
        return [];
      }
    },

    getJournalStats: (id: number): Promise<JournalStats> =>
      api.get(`${basePath}/${id}/stats`),

    getJournalReferences: (id: number, refType?: 'reference' | 'target'): Promise<JournalReferences> =>
      api.get(`${basePath}/${id}/references`, { params: { ref_type: refType } }),

    batchImport: (journals: JournalCreate[]): Promise<JournalBatchImportResponse> =>
      api.post(`${basePath}/batch-import`, journals),
  })
);

export const auditApi = {
  getAuditLogs: (params?: any) =>
    api.get('/audit/', { params }),

  getAuditLog: (id: number) =>
    api.get(`/audit/${id}`),

  getAuditStats: () =>
    api.get('/audit/stats'),

  getUserActions: (userId: number, params?: any) =>
    api.get(`/audit/user/${userId}`, { params }),
};

export default api;