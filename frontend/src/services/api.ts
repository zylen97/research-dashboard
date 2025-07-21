import axios from 'axios';
import {
  Collaborator, CollaboratorCreate, CollaboratorUpdate,
  ResearchProject, ResearchProjectCreate, ResearchProjectUpdate,
  Literature, LiteratureCreate, LiteratureUpdate,
  Idea, IdeaCreate, IdeaUpdate,
  CommunicationLog, CommunicationLogCreate, CommunicationLogUpdate,
  FileUploadResponse, ValidationRequest, ValidationResult,
  IdeasSummary, PaginationParams
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

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    
    // 处理401未授权错误
    if (error.response?.status === 401) {
      // 清除本地认证信息
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      
      // 跳转到登录页面
      window.location.href = '/auth';
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
  convertToIdea: (id: number): Promise<{ message: string; idea_id: number }> =>
    api.put(`/api/literature/${id}/convert-to-idea`),
};

// Idea API
export const ideaApi = {
  // 获取idea列表
  getIdeas: (params?: PaginationParams & {
    status_filter?: string;
    priority_filter?: string;
    source_filter?: string;
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

export default api;