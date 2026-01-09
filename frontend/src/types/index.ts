// 导出api.ts中的所有类型
export * from './api';
// 导出Ideas相关类型
export * from './ideas';
// 导出Tag类型（从journals.ts导入，同时在内部使用）
import type { Tag } from './journals';
export type { Tag } from './journals';

// API响应类型 - 统一后端响应格式
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

// 分页类型
export interface PaginationParams {
  skip?: number;
  limit?: number;
}

// 合作者类型（极简版 - 只保留2个业务字段）
export interface Collaborator {
  id: number;
  name: string;           // 必填
  background: string;     // 必填

  // 系统字段
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  project_count?: number;
}

export interface CollaboratorCreate {
  name: string;
  background: string;
}

export interface CollaboratorUpdate {
  name?: string;
  background?: string;
}

// 研究项目类型
export interface ResearchProject {
  id: number;
  title: string;
  idea_description: string;
  research_method?: string; // 研究方法（从Ideas转化而来）
  source?: string; // 来源（已废弃，从Ideas转化而来）
  reference_paper?: string; // 参考论文
  reference_journal?: string; // 参考期刊
  target_journal?: string; // 投稿期刊
  status: string;
  progress: number;
  start_date: string;
  expected_completion?: string;
  created_at: string;
  updated_at: string;
  collaborators: Collaborator[];
  communication_logs: CommunicationLog[]; // 论文进度记录数组
  latest_communication?: string;
  actual_start_date?: string;
  is_todo: boolean; // 是否标记为待办事项
  todo_marked_at?: string; // 标记为待办事项的时间

  // 我的身份字段
  my_role: 'first_author' | 'corresponding_author';
}

export interface ResearchProjectCreate {
  title: string;
  idea_description: string;
  research_method?: string;
  source?: string; // 已废弃
  reference_paper?: string;
  reference_journal?: string;
  target_journal?: string; // 投稿期刊
  status?: string;
  progress?: number;
  expected_completion?: string;
  collaborator_ids?: number[];
  is_todo?: boolean; // 是否标记为待办事项
  start_date?: string; // 项目开始时间

  // 我的身份字段（必填）
  my_role: 'first_author' | 'corresponding_author';
}

export interface ResearchProjectUpdate {
  title?: string;
  idea_description?: string;
  research_method?: string;
  source?: string; // 已废弃
  reference_paper?: string;
  reference_journal?: string;
  target_journal?: string; // 投稿期刊
  status?: string;
  progress?: number;
  expected_completion?: string;
  collaborator_ids?: number[];
  is_todo?: boolean; // 是否标记为待办事项
  start_date?: string; // 项目开始时间

  // 我的身份字段（更新时可选）
  my_role?: 'first_author' | 'corresponding_author';
}

// Project→Idea转化响应
export interface ConvertToIdeaResponse {
  message: string;
  idea_id: number;
  project_name: string;
  collaborators_preserved: number;
}

// 论文进度类型
export interface CommunicationLog {
  id: number;
  project_id: number;
  collaborator_id?: number;
  communication_type?: string;  // 后端有默认值 'meeting'
  title: string;
  content: string;
  outcomes?: string;
  communication_date: string;
  created_at: string;
  updated_at: string;
  collaborator?: Collaborator;
}

export interface CommunicationLogCreate {
  collaborator_id?: number;
  communication_type?: string;  // 后端有默认值 'meeting'
  title: string;
  content: string;
  outcomes?: string;
  communication_date?: string;
}

export interface CommunicationLogUpdate {
  communication_type?: string;
  title?: string;
  content?: string;
  outcomes?: string;
  communication_date?: string;
}

// 文件上传响应
export interface FileUploadResponse {
  message: string;
  imported_count: number;
  errors: string[];
}


// 常量
export const COMMUNICATION_TYPES = ['meeting', 'email', 'chat', 'phone'] as const;
export const PROJECT_STATUSES = ['writing', 'submitting', 'published'] as const;


// 已移除认证系统 - User, UserLogin, AuthToken, AuthContextType 已删除

// 系统配置类型
export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  category: string;
  description?: string;
  is_encrypted: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemConfigCreate {
  key: string;
  value: string;
  category: string;
  description?: string;
  is_encrypted?: boolean;
  is_active?: boolean;
}

export interface SystemConfigUpdate {
  value?: string;
  description?: string;
  is_active?: boolean;
}

// AI配置相关类型
export interface AIProvider {
  provider: string;
  name: string;
  is_configured: boolean;
  is_active: boolean;
  config?: {
    api_key?: string;
    api_url?: string;
    model?: string;
    max_tokens?: number;
    temperature?: number;
  };
}

export interface AIProviderCreate {
  provider: string;
  name: string;
  api_key: string;
  api_url?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AITestResponse {
  success: boolean;
  message: string;
  provider: string;
  response_time?: number;
  response?: string;  // 与后端字段名保持一致
}

// 期刊库类型
export interface Journal {
  id: number;
  name: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  reference_count: number;  // 作为参考期刊的引用次数
  target_count: number;     // 作为投稿期刊的引用次数
}

export interface JournalCreate {
  name: string;
  notes?: string;
  tag_ids?: number[];
}

export interface JournalUpdate {
  name?: string;
  notes?: string;
  tag_ids?: number[];
}

// Tag 类型已移至 types/journals.ts，请使用统一的定义

