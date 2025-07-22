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
}

export interface CollaboratorUpdate {
  name?: string;
  gender?: string;
  class_name?: string;
  future_plan?: string;
  background?: string;
  contact_info?: string;
  is_senior?: boolean;
}

// 研究项目类型
export interface ResearchProject {
  id: number;
  title: string;
  idea_description: string;
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
  status?: string;
  progress?: number;
  expected_completion?: string;
  collaborator_ids?: number[];
  is_todo?: boolean; // 是否标记为待办事项
}

export interface ResearchProjectUpdate {
  title?: string;
  idea_description?: string;
  status?: string;
  progress?: number;
  expected_completion?: string;
  collaborator_ids?: number[];
  is_todo?: boolean; // 是否标记为待办事项
}

// 文献类型
export interface Literature {
  id: number;
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  abstract?: string;
  keywords?: string;
  citation_count: number;
  validation_status: string;
  validation_score?: number;
  validation_reason?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LiteratureCreate {
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  abstract?: string;
  keywords?: string;
  citation_count?: number;
}

export interface LiteratureUpdate {
  title?: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  abstract?: string;
  keywords?: string;
  citation_count?: number;
  validation_status?: string;
  validation_score?: number;
  validation_reason?: string;
  status?: string;
  notes?: string;
}

// Idea类型
export interface Idea {
  id: number;
  title: string;
  description: string;
  source: string;
  source_literature_id?: number;
  user_id: number;
  difficulty_level?: string;
  estimated_duration?: string;
  required_skills?: string;
  potential_impact?: string;
  status: string;
  priority: string;
  tags?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  source_literature?: Literature;
}

export interface IdeaCreate {
  title: string;
  description: string;
  source: string;
  source_literature_id?: number;
  difficulty_level?: string;
  estimated_duration?: string;
  required_skills?: string;
  potential_impact?: string;
  priority?: string;
  tags?: string;
}

export interface IdeaUpdate {
  title?: string;
  description?: string;
  difficulty_level?: string;
  estimated_duration?: string;
  required_skills?: string;
  potential_impact?: string;
  status?: string;
  priority?: string;
  tags?: string;
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

// 验证请求和响应
export interface ValidationRequest {
  literature_ids: number[];
  prompt: string;
}

export interface ValidationResult {
  literature_id: number;
  status: string;
  score?: number;
  reason: string;
  ai_response?: string;
}

// 批量AI匹配相关类型
export interface BatchMatchingRequest {
  literature_ids: number[];
  prompt_template: string;
  ai_provider: string;
}

export interface MatchingResult {
  literature_id: number;
  status: string;
  score?: number;
  reason: string;
  ai_response?: string;
}

export interface BatchMatchingResponse {
  success: boolean;
  message: string;
  results: MatchingResult[];
  total_processed: number;
  successful_count: number;
  error_count: number;
}

// AI提示词模板类型
export interface PredefinedPrompt {
  id: string;
  name: string;
  template: string;
}

// 统计类型
export interface IdeasSummary {
  total_ideas: number;
  status_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
  source_breakdown: Record<string, number>;
}

// 常量
export const COMMUNICATION_TYPES = ['meeting', 'email', 'chat', 'phone'] as const;
export const PROJECT_STATUSES = ['active', 'completed', 'paused'] as const;
export const LITERATURE_STATUSES = ['imported', 'reviewed', 'converted_to_idea'] as const;
export const VALIDATION_STATUSES = ['pending', 'validated', 'rejected'] as const;
export const IDEA_STATUSES = ['pool', 'in_development', 'converted_to_project'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
export const IMPACT_LEVELS = ['low', 'medium', 'high'] as const;

// 导出API相关类型
export * from './api';

// 用户类型
export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}



export interface UserLogin {
  username: string;
  password: string;
}


// 认证令牌响应 - 与后端Token模型匹配
export interface AuthToken {
  access_token: string;
  token_type: string;  // 默认"bearer"
  expires_in: number;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: UserLogin) => Promise<AuthToken>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

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

// 备份管理相关类型
export interface BackupStats {
  total_backups: number;
  total_size: number;
  oldest_backup: BackupItem | null;
  newest_backup: BackupItem | null;
  average_size: number;
  max_backups: number;
  current_environment: string;
}

export interface BackupItem {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  created: string;
  createdFormatted: string;
  details?: string;
  collaborators_count?: number;
  projects_count?: number;
  logs_count?: number;
}

export interface BackupListResponse {
  data: BackupItem[];
  total: number;
}

export interface BackupCreateResponse {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  created: string;
  createdFormatted: string;
}