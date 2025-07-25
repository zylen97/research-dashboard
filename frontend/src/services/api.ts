import axios from 'axios';
import {
  Collaborator, CollaboratorCreate, CollaboratorUpdate,
  ResearchProject, ResearchProjectCreate, ResearchProjectUpdate,
  CommunicationLog, CommunicationLogCreate, CommunicationLogUpdate,
  FileUploadResponse,
  PaginationParams,
  User, UserLogin, AuthToken, SystemConfig, SystemConfigCreate, SystemConfigUpdate,
  AIProvider, AIProviderCreate, AITestResponse, BackupStats,
  BackupListResponse, BackupCreateResponse,
  Prompt, PromptCreate, PromptUpdate
} from '../types';
import { handleListResponse } from '../utils/dataFormatters';
import { errorInterceptor } from '../utils/errorHandler';

// API基础配置
import { API_CONFIG } from '../config/api';
import { ENV } from '../config/environment';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 自动为所有请求添加 API 前缀
    if (config.url && !config.url.startsWith(ENV.API_PREFIX) && !config.url.startsWith('http')) {
      // 开发环境下记录API请求
      if (ENV.LOG_LEVEL === 'debug' && config.url.includes('ideas-management')) {
        console.log('[Ideas API] 原始URL:', config.url);
        console.log('[Ideas API] 修改后URL:', ENV.API_PREFIX + config.url);
      }
      config.url = ENV.API_PREFIX + config.url;
    }
    
    // 从localStorage获取token
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一错误处理和数据格式
api.interceptors.response.use(
  (response) => {
    // 对于blob类型的响应（如文件下载），直接返回完整响应
    if (response.config.responseType === 'blob') {
      return response;
    }
    
    // 统一处理API响应格式
    const data = response.data;
    
    // 如果响应是统一格式（包含success字段），返回数据部分
    if (data && typeof data === 'object' && 'success' in data) {
      if (!data.success) {
        const error: any = new Error(data.message || 'API call failed');
        error.response = data; // 保留完整响应数据
        throw error;
      }
      return data.data || data;
    }
    
    // 否则直接返回数据
    return data;
  },
  errorInterceptor
);

// 合作者API
export const collaboratorApi = {
  // 获取合作者列表
  getCollaborators: async (params?: PaginationParams): Promise<Collaborator[]> => {
    const response = await api.get('/collaborators/', { params });
    return handleListResponse<Collaborator>(response, 'API.getCollaborators');
  },

  // 获取单个合作者
  getCollaborator: (id: number): Promise<Collaborator> =>
    api.get(`/collaborators/${id}`),

  // 创建合作者
  createCollaborator: (data: CollaboratorCreate): Promise<Collaborator> =>
    api.post('/collaborators/', data),

  // 更新合作者
  updateCollaborator: (id: number, data: CollaboratorUpdate): Promise<Collaborator> =>
    api.put(`/collaborators/${id}`, data),

  // 删除合作者
  deleteCollaborator: (id: number, permanent: boolean = false): Promise<{ message: string }> =>
    api.delete(`/collaborators/${id}${permanent ? '?permanent=true' : ''}`),

  // 获取合作者参与的项目
  getCollaboratorProjects: async (id: number): Promise<ResearchProject[]> => {
    const response = await api.get(`/collaborators/${id}/projects`);
    return handleListResponse<ResearchProject>(response, 'API.getCollaboratorProjects');
  },

  // 上传合作者文件
  uploadCollaboratorsFile: (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/collaborators/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 清理合作者名称
  cleanCollaboratorNames: (keyword: string = 'srtp'): Promise<{
    message: string;
    cleaned_count: number;
    total_found: number;
  }> =>
    api.post(`/collaborators/clean-names?keyword=${keyword}`),
  
  // 批量创建合作者
  createCollaboratorsBatch: (collaborators: CollaboratorCreate[]): Promise<{
    message: string;
    created_count: number;
  }> =>
    api.post('/collaborators/create-batch', collaborators),
  
  // 创建合作者组
  createCollaboratorGroup: (groupName: string, memberNames: string[]): Promise<{
    message: string;
    updated_count: number;
    not_found: string[];
  }> =>
    api.post('/collaborators/create-group', {
      group_name: groupName,
      member_names: memberNames,
    }),
  
  // 获取合作者依赖关系
  getCollaboratorDependencies: (id: number): Promise<{
    valid: boolean;
    error?: string;
    dependencies?: {
      total_projects: number;
      active_projects: number;
      completed_projects: number;
    };
    warnings?: string[];
    can_soft_delete?: boolean;
    can_hard_delete?: boolean;
  }> =>
    api.get(`/validation/collaborator/${id}/dependencies`),
    
  // 恢复已删除的合作者
  restoreCollaborator: (id: number): Promise<{ message: string }> =>
    api.post(`/collaborators/${id}/restore`),
    
  // 获取已删除的合作者列表
  getDeletedCollaborators: (): Promise<Collaborator[]> =>
    api.get('/collaborators/deleted/list'),
    
  // 检查合作者的依赖关系（在合作者路由中）
  checkCollaboratorDependencies: (id: number): Promise<{
    exists: boolean;
    active_projects: number;
    total_projects: number;
    can_soft_delete: boolean;
    can_hard_delete: boolean;
  }> =>
    api.get(`/collaborators/${id}/check-dependencies`),
};

// 研究项目API
export const researchApi = {
  // 获取研究项目列表
  getProjects: async (params?: PaginationParams & { status_filter?: string }): Promise<ResearchProject[]> => {
    const response = await api.get('/research/', { params });
    return handleListResponse<ResearchProject>(response, 'API.getProjects');
  },

  // 获取单个研究项目
  getProject: (id: number): Promise<ResearchProject> =>
    api.get(`/research/${id}`),

  // 创建研究项目
  createProject: (data: ResearchProjectCreate): Promise<ResearchProject> =>
    api.post('/research/', data),

  // 更新研究项目
  updateProject: (id: number, data: ResearchProjectUpdate): Promise<ResearchProject> =>
    api.put(`/research/${id}`, data),

  // 删除研究项目
  deleteProject: (id: number): Promise<{ message: string }> =>
    api.delete(`/research/${id}`),

  // 获取项目交流日志
  getCommunicationLogs: (id: number): Promise<CommunicationLog[]> =>
    api.get(`/research/${id}/logs`),

  // 创建交流日志
  createCommunicationLog: (projectId: number, data: CommunicationLogCreate): Promise<CommunicationLog> => {
    console.log('API调用参数:', { projectId, data });
    return api.post(`/research/${projectId}/logs`, data);
  },

  // 更新交流日志
  updateCommunicationLog: (projectId: number, logId: number, data: CommunicationLogUpdate): Promise<CommunicationLog> =>
    api.put(`/research/${projectId}/logs/${logId}`, data),

  // 删除交流日志
  deleteCommunicationLog: (projectId: number, logId: number): Promise<{ message: string }> =>
    api.delete(`/research/${projectId}/logs/${logId}`),

  // 更新项目进度
  updateProgress: (id: number, progress: number): Promise<{ message: string; progress: number }> =>
    api.put(`/research/${id}/progress`, null, { params: { progress } }),

  // 获取用户的待办项目列表
  getUserTodos: async (): Promise<ResearchProject[]> => {
    const response = await api.get('/research/todos');
    return handleListResponse<ResearchProject>(response, 'API.getUserTodos');
  },

  // 将项目标记为待办
  markAsTodo: (projectId: number, priority?: number, notes?: string): Promise<{ message: string }> =>
    api.post(`/research/${projectId}/todo`, { priority, notes }),

  // 取消项目的待办标记
  unmarkTodo: (projectId: number): Promise<{ message: string }> =>
    api.delete(`/research/${projectId}/todo`),

  // 获取项目的待办状态
  getTodoStatus: (projectId: number): Promise<{
    is_todo: boolean;
    marked_at: string | null;
    priority: number | null;
    notes: string | null;
  }> =>
    api.get(`/research/${projectId}/todo-status`),
    
  // 检查项目的依赖关系
  checkProjectDependencies: (id: number): Promise<{
    exists: boolean;
    communication_logs: number;
    collaborators: number;
    can_delete: boolean;
  }> =>
    api.get(`/research/${id}/check-dependencies`),
};



// 认证API
export const authApi = {
  // 用户登录
  login: (credentials: UserLogin): Promise<AuthToken> =>
    api.post('/auth/login', credentials),

  // 获取当前用户信息
  getCurrentUser: (): Promise<User> =>
    api.get('/auth/me'),

  // 用户登出（本地操作）
  logout: (): void => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/auth';
  },

  // 检查登录状态
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },

  // 获取本地缓存的用户信息
  getLocalUser: (): User | null => {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },
};

// 系统配置 API
export const configApi = {
  // 获取配置列表
  getConfigs: (params?: {
    category?: string;
    is_active?: boolean;
  }): Promise<SystemConfig[]> =>
    api.get('/config/', { params }),

  // 获取单个配置
  getConfig: (id: number): Promise<SystemConfig> =>
    api.get(`/config/${id}`),

  // 创建配置
  createConfig: (data: SystemConfigCreate): Promise<SystemConfig> =>
    api.post('/config/', data),

  // 更新配置
  updateConfig: (id: number, data: SystemConfigUpdate): Promise<SystemConfig> =>
    api.put(`/config/${id}`, data),

  // 删除配置
  deleteConfig: (id: number): Promise<{ message: string }> =>
    api.delete(`/config/${id}`),

  // 获取AI配置列表
  getAIProviders: (): Promise<AIProvider[]> =>
    api.get('/config/ai/providers'),

  // 创建AI配置
  createAIProvider: (data: AIProviderCreate): Promise<SystemConfig> =>
    api.post('/config/ai/providers', data),

  // 测试AI连接
  testAIProvider: (data: {
    api_key: string;
    api_url?: string;
    test_prompt?: string;
  }): Promise<AITestResponse> =>
    api.post('/config/ai/test', data),
};

// 备份管理 API
export const backupApi = {
  // 获取备份统计
  getStats: (): Promise<BackupStats> =>
    api.get('/backup/stats'),

  // 获取备份列表
  getBackups: (): Promise<BackupListResponse> =>
    api.get('/backup/list'),

  // 创建备份
  createBackup: (): Promise<BackupCreateResponse> =>
    api.post('/backup/create'),

  // 恢复备份
  restoreBackup: (backupId: string): Promise<{ message: string }> =>
    api.post(`/backup/restore/${backupId}`),

  // 删除备份
  deleteBackup: (backupId: string): Promise<{ message: string }> =>
    api.delete(`/backup/${backupId}`),

  // 下载备份
  downloadBackup: (backupId: string): Promise<Blob> => {
    return api.get(`/backup/download/${backupId}`, {
      responseType: 'blob'
    });
  },
};

// Idea发掘 API (智能版 - 使用系统AI配置)
export const ideaDiscoveryApi = {
  // 智能处理Excel文件（自动使用系统配置的AI）
  processExcel: async (file: File, promptId?: number, customPrompt?: string): Promise<Blob> => {
    const formData = new FormData();
    formData.append('file', file);
    if (promptId) {
      formData.append('prompt_id', promptId.toString());
    }
    if (customPrompt) {
      formData.append('custom_prompt', customPrompt);
    }
    const response = await api.post('/ideas/process-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob'
    });
    // 确保返回纯Blob对象而不是axios响应对象
    return response.data;
  },

  // 健康检查
  healthCheck: (): Promise<{ status: string; service: string }> =>
    api.get('/ideas/health'),
};


// 验证 API
export const validationApi = {
  // 获取项目的依赖关系
  getProjectDependencies: (id: number): Promise<{
    valid: boolean;
    dependencies?: {
      communication_logs: number;
      collaborators: number;
    };
    warnings?: string[];
    can_delete?: boolean;
  }> =>
    api.get(`/validation/project/${id}/dependencies`),

  // 验证项目数据
  validateProject: (data: any): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> =>
    api.post('/validation/project/validate', data),

  // 验证合作者数据
  validateCollaborator: (data: any): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> =>
    api.post('/validation/collaborator/validate', data),

  // 检查数据一致性
  checkConsistency: (): Promise<{
    valid: boolean;
    issues?: Array<{
      type: string;
      description: string;
      severity: 'error' | 'warning';
    }>;
  }> =>
    api.get('/validation/consistency'),
};

// 审计日志 API
export const auditApi = {
  // 获取审计日志列表
  getAuditLogs: (params?: {
    table_name?: string;
    action?: string;
    user_id?: number;
    skip?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<any[]> =>
    api.get('/audit/', { params }),

  // 获取单条审计日志
  getAuditLog: (id: number): Promise<any> =>
    api.get(`/audit/${id}`),

  // 获取审计统计
  getAuditStats: (): Promise<{
    total_actions: number;
    actions_by_type: Record<string, number>;
    actions_by_table: Record<string, number>;
    recent_actions: any[];
  }> =>
    api.get('/audit/stats'),

  // 获取用户操作历史
  getUserActions: (userId: number, params?: {
    skip?: number;
    limit?: number;
  }): Promise<any[]> =>
    api.get(`/audit/user/${userId}`, { params }),
};

// Prompts管理 API
export const promptsApi = {
  // 获取所有prompts列表
  getPrompts: async (): Promise<Prompt[]> => {
    const response = await api.get('/prompts/');
    return handleListResponse<Prompt>(response, 'API.getPrompts');
  },

  // 获取单个prompt
  getPrompt: (id: number): Promise<Prompt> =>
    api.get(`/prompts/${id}`),

  // 创建新prompt
  createPrompt: (data: PromptCreate): Promise<Prompt> =>
    api.post('/prompts/', data),

  // 更新prompt
  updatePrompt: (id: number, data: PromptUpdate): Promise<Prompt> =>
    api.put(`/prompts/${id}`, data),

  // 删除prompt
  deletePrompt: (id: number): Promise<{ success: boolean; message: string }> =>
    api.delete(`/prompts/${id}`),
};

export default api;