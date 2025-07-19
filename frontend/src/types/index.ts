// API响应类型
export interface ApiResponse<T> {
  data: T;
  message?: string;
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
  future_plan?: string;
  background?: string;
  contact_info?: string;
  is_senior?: boolean;
  is_group?: boolean; // 是否为小组/团队
  created_at: string;
  updated_at: string;
}

export interface CollaboratorCreate {
  name: string;
  gender?: string;
  class_name?: string;
  future_plan?: string;
  background?: string;
  contact_info?: string;
  is_group?: boolean;
}

export interface CollaboratorUpdate {
  name?: string;
  gender?: string;
  class_name?: string;
  future_plan?: string;
  background?: string;
  contact_info?: string;
  is_group?: boolean;
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
  latest_communication?: string;
  actual_start_date?: string;
  is_todo?: boolean; // 是否标记为待办事项
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
  difficulty_level?: string;
  estimated_duration?: string;
  required_skills?: string;
  potential_impact?: string;
  status: string;
  priority: string;
  tags?: string;
  created_at: string;
  updated_at: string;
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
  project_id: number;
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