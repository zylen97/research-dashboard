// 导出api.ts中的所有类型
export * from './api';

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

// 合作者类型
export interface Collaborator {
  id: number;
  name: string;
  gender?: string;
  class_name?: string;
  student_id?: string;
  phone?: string;
  email?: string;
  qq?: string;
  wechat?: string;
  skills?: string;
  research_interests?: string;
  future_plans?: string;
  background?: string;
  contact_info?: string;
  is_senior: boolean;
  is_group?: boolean;   // 是否为小组成员
  is_deleted: boolean;  // 软删除标记
  deleted_at?: string;  // 删除时间
  created_at: string;
  updated_at: string;
  project_count?: number;
}

export interface CollaboratorCreate {
  name: string;
  gender?: string;
  class_name?: string;
  future_plan?: string;
  background?: string;
  contact_info?: string;
  is_senior?: boolean;
  is_group?: boolean;
}

export interface CollaboratorUpdate {
  name?: string;
  gender?: string;
  class_name?: string;
  future_plan?: string;
  background?: string;
  contact_info?: string;
  is_senior?: boolean;
  is_group?: boolean;
}

// 研究项目类型
export interface ResearchProject {
  id: number;
  title: string;
  idea_description: string;
  research_method?: string; // 研究方法（从Ideas转化而来）
  source?: string; // 来源（从Ideas转化而来）
  target_journal?: string; // (拟)投稿期刊
  status: string;
  progress: number;
  start_date: string;
  expected_completion?: string;
  created_at: string;
  updated_at: string;
  collaborators: Collaborator[];
  communication_logs: CommunicationLog[]; // 交流记录数组
  latest_communication?: string;
  actual_start_date?: string;
  is_todo: boolean; // 是否标记为待办事项
  todo_marked_at?: string; // 标记为待办事项的时间
}

export interface ResearchProjectCreate {
  title: string;
  idea_description: string;
  research_method?: string;
  source?: string;
  target_journal?: string; // (拟)投稿期刊
  status?: string;
  progress?: number;
  expected_completion?: string;
  collaborator_ids?: number[];
  is_todo?: boolean; // 是否标记为待办事项
  start_date?: string; // 项目开始时间
}

export interface ResearchProjectUpdate {
  title?: string;
  idea_description?: string;
  research_method?: string;
  source?: string;
  target_journal?: string; // (拟)投稿期刊
  status?: string;
  progress?: number;
  expected_completion?: string;
  collaborator_ids?: number[];
  is_todo?: boolean; // 是否标记为待办事项
  start_date?: string; // 项目开始时间
}


// 交流日志类型
export interface CommunicationLog {
  id: number;
  project_id: number;
  collaborator_id?: number;
  communication_type: string;
  title: string;
  content: string;
  outcomes?: string;
  action_items?: string;
  communication_date: string;
  created_at: string;
  updated_at: string;
  collaborator?: Collaborator;
}

export interface CommunicationLogCreate {
  collaborator_id?: number;
  communication_type: string;
  title: string;
  content: string;
  outcomes?: string;
  action_items?: string;
  communication_date?: string;
}

export interface CommunicationLogUpdate {
  communication_type?: string;
  title?: string;
  content?: string;
  outcomes?: string;
  action_items?: string;
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
export const PROJECT_STATUSES = ['active', 'completed', 'paused', 'reviewing', 'revising'] as const;


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
  created_by_id?: number;
  updated_by_id?: number;
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
  response_content?: string;
}

// Prompt管理类型
export interface Prompt {
  id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PromptCreate {
  name: string;
  content: string;
}

export interface PromptUpdate {
  name?: string;
  content?: string;
}

