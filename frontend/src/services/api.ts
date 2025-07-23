import axios from 'axios';
import {
  Collaborator, CollaboratorCreate, CollaboratorUpdate,
  ResearchProject, ResearchProjectCreate, ResearchProjectUpdate,
  Literature, LiteratureCreate, LiteratureUpdate,
  Idea, IdeaCreate, IdeaUpdate,
  CommunicationLog, CommunicationLogCreate, CommunicationLogUpdate,
  FileUploadResponse, ValidationRequest, ValidationResult,
  IdeasSummary, PaginationParams,
  BatchMatchingRequest, BatchMatchingResponse, PredefinedPrompt,
  User, UserLogin, AuthToken, SystemConfig, SystemConfigCreate, SystemConfigUpdate,
  AIProvider, AIProviderCreate, AITestResponse, BackupStats,
  BackupListResponse, BackupCreateResponse
} from '../types';

// API基础配置
import { API_CONFIG } from '../config/api';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
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
        throw new Error(data.message || 'API call failed');
      }
      return data.data || data;
    }
    
    // 否则直接返回数据
    return data;
  },
  (error) => {
    console.error('API Error:', error);
    
    // 处理具体的HTTP状态码
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // 清除本地认证信息
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          
          // 跳转到登录页面
          window.location.href = '/auth';
          break;
          
        case 403:
          console.error('无权访问该资源');
          break;
          
        case 404:
          console.error('请求的资源不存在');
          break;
          
        case 422:
          console.error('请求数据验证失败:', data);
          break;
          
        case 500:
          console.error('服务器内部错误');
          break;
          
        default:
          console.error(`API调用失败: ${status}`);
      }
    } else if (error.request) {
      console.error('网络错误或请求超时');
    } else {
      console.error('API调用配置错误:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// 合作者API
export const collaboratorApi = {
  // 获取合作者列表
  getCollaborators: (params?: PaginationParams): Promise<Collaborator[]> =>
    api.get('/api/collaborators/', { params }),

  // 获取单个合作者
  getCollaborator: (id: number): Promise<Collaborator> =>
    api.get(`/api/collaborators/${id}`),

  // 创建合作者
  createCollaborator: (data: CollaboratorCreate): Promise<Collaborator> =>
    api.post('/api/collaborators/', data),

  // 更新合作者
  updateCollaborator: (id: number, data: CollaboratorUpdate): Promise<Collaborator> =>
    api.put(`/api/collaborators/${id}`, data),

  // 删除合作者
  deleteCollaborator: (id: number): Promise<{ message: string }> =>
    api.delete(`/api/collaborators/${id}`),

  // 获取合作者参与的项目
  getCollaboratorProjects: (id: number): Promise<ResearchProject[]> =>
    api.get(`/api/collaborators/${id}/projects`),

  // 上传合作者文件
  uploadCollaboratorsFile: (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/collaborators/upload', formData, {
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
    api.post(`/api/collaborators/clean-names?keyword=${keyword}`),
  
  // 批量创建合作者
  createCollaboratorsBatch: (collaborators: CollaboratorCreate[]): Promise<{
    message: string;
    created_count: number;
  }> =>
    api.post('/api/collaborators/create-batch', collaborators),
  
  // 创建合作者组
  createCollaboratorGroup: (groupName: string, memberNames: string[]): Promise<{
    message: string;
    updated_count: number;
    not_found: string[];
  }> =>
    api.post('/api/collaborators/create-group', {
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
    api.get(`/api/validation/collaborator/${id}/dependencies`),
};

// 研究项目API
export const researchApi = {
  // 获取研究项目列表
  getProjects: (params?: PaginationParams & { status_filter?: string }): Promise<ResearchProject[]> =>
    api.get('/api/research/', { params }),

  // 获取单个研究项目
  getProject: (id: number): Promise<ResearchProject> =>
    api.get(`/api/research/${id}`),

  // 创建研究项目
  createProject: (data: ResearchProjectCreate): Promise<ResearchProject> =>
    api.post('/api/research/', data),

  // 更新研究项目
  updateProject: (id: number, data: ResearchProjectUpdate): Promise<ResearchProject> =>
    api.put(`/api/research/${id}`, data),

  // 删除研究项目
  deleteProject: (id: number): Promise<{ message: string }> =>
    api.delete(`/api/research/${id}`),

  // 获取项目交流日志
  getCommunicationLogs: (id: number): Promise<CommunicationLog[]> =>
    api.get(`/api/research/${id}/logs`),

  // 创建交流日志
  createCommunicationLog: (projectId: number, data: CommunicationLogCreate): Promise<CommunicationLog> => {
    console.log('API调用参数:', { projectId, data });
    return api.post(`/api/research/${projectId}/logs`, data);
  },

  // 更新交流日志
  updateCommunicationLog: (projectId: number, logId: number, data: CommunicationLogUpdate): Promise<CommunicationLog> =>
    api.put(`/api/research/${projectId}/logs/${logId}`, data),

  // 删除交流日志
  deleteCommunicationLog: (projectId: number, logId: number): Promise<{ message: string }> =>
    api.delete(`/api/research/${projectId}/logs/${logId}`),

  // 更新项目进度
  updateProgress: (id: number, progress: number): Promise<{ message: string; progress: number }> =>
    api.put(`/api/research/${id}/progress`, null, { params: { progress } }),

  // 切换待办状态
  toggleTodoStatus: (id: number, is_todo: boolean): Promise<ResearchProject> =>
    api.put(`/api/research/${id}`, { is_todo }),
};

// 文献API
export const literatureApi = {
  // 获取文献列表
  getLiterature: (params?: PaginationParams & { 
    status_filter?: string; 
    validation_status?: string;
  }): Promise<Literature[]> =>
    api.get('/api/literature/', { params }),

  // 获取单个文献
  getLiteratureItem: (id: number): Promise<Literature> =>
    api.get(`/api/literature/${id}`),

  // 创建文献
  createLiterature: (data: LiteratureCreate): Promise<Literature> =>
    api.post('/api/literature/', data),

  // 更新文献
  updateLiterature: (id: number, data: LiteratureUpdate): Promise<Literature> =>
    api.put(`/api/literature/${id}`, data),

  // 删除文献
  deleteLiterature: (id: number): Promise<{ message: string }> =>
    api.delete(`/api/literature/${id}`),

  // 上传文献文件
  uploadLiteratureFile: (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/literature/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // 验证文献
  validateLiterature: (data: ValidationRequest): Promise<ValidationResult[]> =>
    api.post('/api/literature/validate', data),

  // 转换文献为idea
  convertToIdea: (id: number, ideaData?: any): Promise<{ message: string; idea_id: number }> =>
    api.put(`/api/literature/${id}/convert-to-idea`, ideaData),

  // 批量AI匹配文献 - 使用类型安全的接口
  batchMatchLiterature: (data: BatchMatchingRequest): Promise<BatchMatchingResponse> =>
    api.post('/api/literature/batch-match', data),

  // 获取预定义的匹配提示词
  getPredefinedPrompts: (): Promise<PredefinedPrompt[]> =>
    api.get('/api/literature/prompts'),
};

// Idea API
export const ideaApi = {
  // 获取idea列表
  getIdeas: (params?: PaginationParams & {
    status_filter?: string;
    priority_filter?: string;
    source_filter?: string;
    group_filter?: string;
  }): Promise<Idea[]> =>
    api.get('/api/ideas/', { params }),

  // 获取单个idea
  getIdea: (id: number): Promise<Idea> =>
    api.get(`/api/ideas/${id}`),

  // 创建idea
  createIdea: (data: IdeaCreate): Promise<Idea> =>
    api.post('/api/ideas/', data),

  // 更新idea
  updateIdea: (id: number, data: IdeaUpdate): Promise<Idea> =>
    api.put(`/api/ideas/${id}`, data),

  // 删除idea
  deleteIdea: (id: number): Promise<{ message: string }> =>
    api.delete(`/api/ideas/${id}`),

  // 更新优先级
  updatePriority: (id: number, priority: string): Promise<{ message: string; priority: string }> =>
    api.put(`/api/ideas/${id}/priority`, null, { params: { priority } }),

  // 更新状态
  updateStatus: (id: number, status: string): Promise<{ message: string; status: string }> =>
    api.put(`/api/ideas/${id}/status`, null, { params: { status_value: status } }),

  // 转换为研究项目
  convertToProject: (id: number, collaboratorIds: number[] = []): Promise<{
    message: string;
    project_id: number;
    project: ResearchProject;
  }> =>
    api.post(`/api/ideas/${id}/convert-to-project`, null, { 
      params: { collaborator_ids: collaboratorIds }
    }),

  // 获取统计信息
  getSummary: (): Promise<IdeasSummary> =>
    api.get('/api/ideas/stats/summary'),

  // 搜索ideas
  searchIdeas: (query: string): Promise<Idea[]> =>
    api.get('/api/ideas/search', { params: { q: query } }),
};

// 认证API
export const authApi = {
  // 用户登录
  login: (credentials: UserLogin): Promise<AuthToken> =>
    api.post('/api/auth/login', credentials),

  // 获取当前用户信息
  getCurrentUser: (): Promise<User> =>
    api.get('/api/auth/me'),

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
    api.get('/api/config/', { params }),

  // 获取单个配置
  getConfig: (id: number): Promise<SystemConfig> =>
    api.get(`/api/config/${id}`),

  // 创建配置
  createConfig: (data: SystemConfigCreate): Promise<SystemConfig> =>
    api.post('/api/config/', data),

  // 更新配置
  updateConfig: (id: number, data: SystemConfigUpdate): Promise<SystemConfig> =>
    api.put(`/api/config/${id}`, data),

  // 删除配置
  deleteConfig: (id: number): Promise<{ message: string }> =>
    api.delete(`/api/config/${id}`),

  // 获取AI提供商列表
  getAIProviders: (): Promise<AIProvider[]> =>
    api.get('/api/config/ai/providers'),

  // 创建AI提供商配置
  createAIProvider: (data: AIProviderCreate): Promise<SystemConfig> =>
    api.post('/api/config/ai/providers', data),

  // 测试AI提供商连接
  testAIProvider: (data: {
    provider: string;
    test_prompt?: string;
  }): Promise<AITestResponse> =>
    api.post('/api/config/ai/test', data),
};

// 备份管理 API
export const backupApi = {
  // 获取备份统计
  getStats: (): Promise<BackupStats> =>
    api.get('/api/backup/stats'),

  // 获取备份列表
  getBackups: (): Promise<BackupListResponse> =>
    api.get('/api/backup/list'),

  // 创建备份
  createBackup: (): Promise<BackupCreateResponse> =>
    api.post('/api/backup/create'),

  // 恢复备份
  restoreBackup: (backupId: string): Promise<{ message: string }> =>
    api.post(`/api/backup/restore/${backupId}`),

  // 删除备份
  deleteBackup: (backupId: string): Promise<{ message: string }> =>
    api.delete(`/api/backup/${backupId}`),

  // 下载备份
  downloadBackup: (backupId: string): Promise<Blob> => {
    return api.get(`/api/backup/download/${backupId}`, {
      responseType: 'blob'
    });
  },
};

export default api;