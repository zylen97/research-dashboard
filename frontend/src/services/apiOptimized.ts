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
import {
  Paper, PaperCreate, PaperUpdate,
  PaperUploadResponse, BatchAnalyzeResponse, SingleAnalyzeResponse,
  ConvertToIdeaResponse, PapersStatsResponse, PapersQueryParams,
  PromptTemplate, PromptTemplateCreate, PromptTemplateUpdate,
  UserConfig, VolumeStats
} from '../types/papers';
import {
  Prompt, PromptCreate, PromptUpdate,
  PromptCopyRequest, PromptCopyResponse,
  PromptStats, PromptCategoriesResponse
} from '../types/prompts';
import { ResearchMethod, ResearchMethodCreate, ResearchMethodUpdate } from '../types/research-methods';
import { AIConfig, AIConfigUpdate, AITestRequest, AITestResponse as AIConfigTestResponse } from '../types/ai';
import { errorInterceptorOptimized } from '../utils/errorHandlerOptimized';
import { createCRUDApi, createExtendedCRUDApi } from '../utils/apiFactory';
import { handleListResponse } from '../utils/dataFormatters';
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
  errorInterceptorOptimized
);

// 合作者API - 使用工厂函数创建基础CRUD，然后添加额外方法
export const collaboratorApi = {
  ...createCRUDApi<Collaborator, CollaboratorCreate, CollaboratorUpdate>(
    '/collaborators',
    'API.getCollaborators'
  ),
  
  // 重写delete方法以支持permanent参数（与后端保持一致）
  deleteCollaborator: async (id: number, permanent: boolean = false) => {
    const response = await api.delete(`/collaborators/${id}`, {
      params: { permanent }
    });
    return response;
  },
  
  // 额外的方法
  getCollaboratorProjects: async (id: number): Promise<ResearchProject[]> => {
    const { data } = await api.get(`/api/collaborators/${id}/projects`);
    // 响应拦截器已确保返回数组
    return (data || []) as ResearchProject[];
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

  // 方法别名，保持向后兼容
  getCollaborators: () => api.get('/collaborators/'),
};

// 研究项目API - 手动定义以包含所有方法别名
export const researchApi = {
  // 基础CRUD操作（向后兼容别名）
  getProjects: (params?: {
    status?: string;
    my_role?: string;
    research_method?: string;
    target_journal?: string;
    reference_journal?: string;
  }) => api.get('/research/', { params }),
  getList: (params?: any) => api.get('/research/', { params }),
  getById: (id: number) => api.get(`/research/${id}`),
  createProject: (data: ResearchProjectCreate) => api.post('/research/', data),
  create: (data: ResearchProjectCreate) => api.post('/research/', data),
  updateProject: (id: number, data: ResearchProjectUpdate) => api.put(`/research/${id}`, data),
  update: (id: number, data: ResearchProjectUpdate) => api.put(`/research/${id}`, data),
  deleteProject: (id: number) => api.delete(`/research/${id}`),
  delete: (id: number) => api.delete(`/research/${id}`),

  // 论文进度相关
  getCommunicationLogs: async (id: number): Promise<CommunicationLog[]> => {
    const response = await api.get(`/research/${id}/logs`);
    return handleListResponse<CommunicationLog>(response, 'API.getCommunicationLogs');
  },
  createCommunicationLog: (projectId: number, data: CommunicationLogCreate) =>
    api.post(`/research/${projectId}/logs`, data),
  updateCommunicationLog: (projectId: number, logId: number, data: CommunicationLogUpdate) =>
    api.put(`/research/${projectId}/logs/${logId}`, data),
  deleteCommunicationLog: (projectId: number, logId: number) =>
    api.delete(`/research/${projectId}/logs/${logId}`),

  // 进度更新
  updateProgress: (id: number, progress: number) =>
    api.put(`/research/${id}/progress`, null, { params: { progress } }),

  // 待办事项
  getUserTodos: async (): Promise<ResearchProject[]> => {
    const response = await api.get('/research/todos');
    return handleListResponse<ResearchProject>(response, 'API.getUserTodos');
  },
  markAsTodo: (projectId: number, priority?: number, notes?: string) =>
    api.post(`/research/${projectId}/todo`, { priority, notes }),
  unmarkTodo: (projectId: number) => api.delete(`/research/${projectId}/todo`),
  getTodoStatus: (projectId: number) => api.get(`/research/${projectId}/todo-status`),

  // 依赖检查
  checkProjectDependencies: (id: number) => api.get(`/research/${id}/check-dependencies`),

  // 转化为Idea
  convertToIdea: (projectId: number) => api.post(`/research/${projectId}/convert-to-idea`),
};

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
    getJournalPapers: (journalId: number, params?: { skip?: number; limit?: number; status?: string; year?: number; search?: string }) => Promise<{ items: Paper[]; total: number; page: number; page_size: number }>;
    importPapersToJournal: (journalId: number, file: File) => Promise<any>;
    analyzeJournalPapers: (journalId: number, aiConfig?: any, statusFilter?: string, maxConcurrent?: number) => Promise<any>;
    batchDeleteJournalPapers: (journalId: number, ids: number[]) => Promise<{ deleted_count: number; errors: string[] }>;
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

    // 论文相关方法（整合到期刊）
    getJournalPapers: async (journalId: number, params?: { skip?: number; limit?: number; status?: string; year?: number; search?: string }): Promise<{ items: Paper[]; total: number; page: number; page_size: number }> => {
      const response = await api.get(`${basePath}/${journalId}/papers`, { params });
      const data = response.data || response;
      if (data && typeof data === 'object' && 'data' in data && 'items' in data.data) {
        return data.data;
      }
      if (data && typeof data === 'object' && 'items' in data) {
        return data;
      }
      return { items: data as Paper[], total: 0, page: 1, page_size: 20 };
    },

    importPapersToJournal: async (journalId: number, file: File): Promise<any> => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`${basePath}/${journalId}/papers/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    analyzeJournalPapers: async (journalId: number, aiConfig?: any, statusFilter: string = 'pending', maxConcurrent: number = 3): Promise<any> => {
      return api.post(`${basePath}/${journalId}/papers/analyze`, null, {
        params: {
          status_filter: statusFilter,
          max_concurrent: maxConcurrent,
        },
        data: aiConfig,
      });
    },

    batchDeleteJournalPapers: async (journalId: number, ids: number[]): Promise<{ deleted_count: number; errors: string[] }> => {
      return api.post(`${basePath}/${journalId}/papers/batch-delete`, { ids });
    },
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

// 研究方法API（v4.7）
export const researchMethodApi = {
  // 获取所有研究方法
  getMethods: async (): Promise<ResearchMethod[]> => {
    try {
      const response = await api.get('/research-methods/');
      return handleListResponse<ResearchMethod>(response, 'API.getResearchMethods');
    } catch (error) {
      console.error('获取研究方法列表失败:', error);
      return [];
    }
  },

  // 获取单个研究方法
  getMethod: (id: number): Promise<ResearchMethod> =>
    api.get(`/research-methods/${id}`),

  // 创建研究方法
  create: (data: ResearchMethodCreate): Promise<ResearchMethod> =>
    api.post('/research-methods/', data),

  // 更新研究方法
  update: (id: number, data: ResearchMethodUpdate): Promise<ResearchMethod> =>
    api.put(`/research-methods/${id}`, data),

  // 删除研究方法
  delete: (id: number): Promise<{ message: string; method_id: number }> =>
    api.delete(`/research-methods/${id}`),

  // 获取或创建研究方法（用于下拉选择自动创建）
  getOrCreate: (name: string): Promise<ResearchMethod> =>
    api.post('/research-methods/get-or-create', { name }),
};

// 论文管理API
export const paperApi = {
  // 基础CRUD操作
  getPapers: async (params?: PapersQueryParams): Promise<{ items: Paper[]; total: number; page: number; page_size: number }> => {
    const response = await api.get('/papers/', { params });
    // 后端返回 paginated_response 格式: { success: true, message: "...", data: { items, total, page, page_size } }
    const data = response.data || response;
    if (data && typeof data === 'object' && 'data' in data && 'items' in data.data) {
      return data.data as { items: Paper[]; total: number; page: number; page_size: number };
    }
    // 兼容旧格式（如果直接返回items）
    if (data && typeof data === 'object' && 'items' in data) {
      return data as { items: Paper[]; total: number; page: number; page_size: number };
    }
    // 最终回退
    return { items: data as Paper[], total: 0, page: 1, page_size: 20 };
  },

  getPaper: (id: number): Promise<Paper> =>
    api.get(`/papers/${id}`),

  createPaper: (data: PaperCreate): Promise<Paper> =>
    api.post('/papers/', data),

  updatePaper: (id: number, data: PaperUpdate): Promise<Paper> =>
    api.put(`/papers/${id}`, data),

  deletePaper: (id: number): Promise<void> =>
    api.delete(`/papers/${id}`),

  // Excel导入
  importFromExcel: (file: File): Promise<PaperUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/papers/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 批量操作
  batchDelete: (paperIds: number[]): Promise<{ deleted_count: number; errors: string[] }> =>
    api.post('/papers/batch-delete', paperIds),

  updateStatus: (id: number, newStatus: string): Promise<Paper> =>
    api.patch(`/papers/${id}/status`, null, { params: { new_status: newStatus } }),

  // AI分析
  batchAnalyze: (paperIds: number[], maxConcurrent: number = 3): Promise<BatchAnalyzeResponse> =>
    api.post('/papers/batch-analyze', paperIds, { params: { max_concurrent: maxConcurrent } }),

  analyzePaper: (id: number): Promise<SingleAnalyzeResponse> =>
    api.post(`/papers/${id}/analyze`),

  // 转换为Idea
  convertToIdea: (id: number): Promise<ConvertToIdeaResponse> =>
    api.post(`/papers/${id}/convert-to-idea`),

  // 统计
  getStats: (): Promise<PapersStatsResponse> =>
    api.get('/papers/stats/summary'),

  // 增强的批量分析（支持提示词模板）
  batchAnalyzeWithPrompt: (
    paperIds: number[],
    templateName?: string,
    templateVariables?: { user_profile?: string; research_fields?: string[] },
    maxConcurrent: number = 3
  ): Promise<BatchAnalyzeResponse> =>
    api.post('/papers/batch-analyze-with-prompt', {
      paper_ids: paperIds,
      template_name: templateName,
      template_variables: templateVariables,
      max_concurrent: maxConcurrent,
    }),
};

// 提示词模板管理API
export const promptApi = {
  // 获取所有提示词模板
  getTemplates: (): Promise<{ data: PromptTemplate[] }> =>
    api.get('/papers/prompts'),

  // 获取单个模板详情
  getTemplate: (name: string): Promise<{ data: PromptTemplate }> =>
    api.get(`/papers/prompts/${name}`),

  // 创建新模板
  createTemplate: (template: PromptTemplateCreate): Promise<{ data: PromptTemplate }> =>
    api.post('/papers/prompts', template),

  // 更新模板
  updateTemplate: (name: string, template: PromptTemplateUpdate): Promise<{ data: PromptTemplate }> =>
    api.put(`/papers/prompts/${name}`, template),

  // 删除模板
  deleteTemplate: (name: string): Promise<{ message: string }> =>
    api.delete(`/papers/prompts/${name}`),
};

// 全局用户配置API
export const userConfigApi = {
  // 获取用户配置
  getConfig: (): Promise<{ data: UserConfig }> =>
    api.get('/papers/user-config'),

  // 更新用户配置
  updateConfig: (config: UserConfig): Promise<{ data: UserConfig; message: string }> =>
    api.put('/papers/user-config', config),
};

// 期卷号统计API
export const volumeStatsApi = {
  // 获取期刊期卷号统计
  getVolumeStats: (journalId: number): Promise<VolumeStats> =>
    api.get(`/api/journals/${journalId}/volume-stats`),
};

// AI配置管理API
export const aiConfigApi = {
  // 获取当前AI配置
  getConfig: (): Promise<AIConfig> =>
    api.get('/ai-config'),

  // 更新AI配置
  updateConfig: (config: AIConfigUpdate): Promise<{ success: boolean; message: string; updated_fields: string[] }> =>
    api.put('/ai-config', config),

  // 测试AI连接
  testConnection: (request: AITestRequest): Promise<AIConfigTestResponse> =>
    api.post('/ai-config/test', request),
};

// 提示词管理API（v4.8）- 用于管理科研提示词
export const promptsApi = {
  // 获取提示词列表
  getAll: async (params?: {
    category?: string;
    search?: string;
    is_favorite?: boolean;
    is_active?: boolean;
  }): Promise<Prompt[]> => {
    try {
      const response = await api.get('/prompts/', { params });
      return handleListResponse<Prompt>(response, 'API.getPrompts');
    } catch (error) {
      console.error('获取提示词列表失败:', error);
      return [];
    }
  },

  // 获取单个提示词详情
  getById: (id: number): Promise<Prompt> =>
    api.get(`/prompts/${id}`),

  // 创建提示词
  create: (data: PromptCreate): Promise<Prompt> =>
    api.post('/prompts/', data),

  // 更新提示词
  update: (id: number, data: PromptUpdate): Promise<Prompt> =>
    api.put(`/prompts/${id}`, data),

  // 删除提示词
  delete: (id: number): Promise<{ message: string; prompt_id: number }> =>
    api.delete(`/prompts/${id}`),

  // 复制提示词（带变量替换）
  copy: (id: number, request: PromptCopyRequest): Promise<PromptCopyResponse> =>
    api.post(`/prompts/${id}/copy`, request),

  // 切换收藏状态
  toggleFavorite: (id: number): Promise<Prompt> =>
    api.post(`/prompts/${id}/toggle-favorite`),

  // 获取使用统计
  getStats: (): Promise<PromptStats> =>
    api.get('/prompts/stats/usage'),

  // 获取分类统计
  getCategories: (): Promise<PromptCategoriesResponse> =>
    api.get('/prompts/categories'),
};

export default api;