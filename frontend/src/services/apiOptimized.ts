/**
 * 优化后的API服务 - 使用工厂函数减少重复代码
 */
import axios from 'axios';
import {
  Collaborator, CollaboratorCreate, CollaboratorUpdate,
  ResearchProject, ResearchProjectCreate, ResearchProjectUpdate,
  CommunicationLog, CommunicationLogCreate, CommunicationLogUpdate,
  FileUploadResponse, User, UserLogin, AuthToken,
  SystemConfig, SystemConfigCreate, SystemConfigUpdate,
  AIProvider, AIProviderCreate, AITestResponse,
  BackupStats, BackupListResponse, BackupCreateResponse,
  Prompt, PromptCreate, PromptUpdate
} from '../types';
import { Idea, IdeaCreate, IdeaUpdate, ConvertToProjectResponse } from '../types/ideas';
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
    
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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

// 认证API - 不适合使用CRUD工厂
export const authApi = {
  login: (credentials: UserLogin): Promise<AuthToken> =>
    api.post('/auth/login', credentials),

  getCurrentUser: (): Promise<User> =>
    api.get('/auth/me'),

  logout: (): void => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/auth';
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },

  getLocalUser: (): User | null => {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },
};

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

// Prompts管理API - 使用CRUD工厂
export const promptsApi = createCRUDApi<Prompt, PromptCreate, PromptUpdate>(
  '/prompts',
  'API.getPrompts'
);

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
    // 增强的安全获取方法，确保总是返回数组
    getIdeasSafe: async (): Promise<Idea[]> => {
      try {
        const response = await api.get(`${basePath}/`);
        const data = handleListResponse<Idea>(response, 'API.getIdeasSafe');
        // 再次确保返回的是数组
        if (!Array.isArray(data)) {
          console.warn('[API.getIdeasSafe] 响应不是数组，返回空数组');
          return [];
        }
        return data;
      } catch (error) {
        console.error('[API.getIdeasSafe] API请求失败:', error);
        // 网络错误、认证失败等情况下返回空数组
        return [];
      }
    },
  })
);



// 其他API保持原样...
export const ideaDiscoveryApi = {
  processExcel: async (file: File, promptId?: number, customPrompt?: string): Promise<Blob> => {
    const formData = new FormData();
    formData.append('file', file);
    if (promptId) formData.append('prompt_id', promptId.toString());
    if (customPrompt) formData.append('custom_prompt', customPrompt);
    
    const response = await api.post('/ideas/process-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob'
    });
    return response.data;
  },

  healthCheck: (): Promise<{ status: string; service: string }> =>
    api.get('/ideas/health'),
};

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