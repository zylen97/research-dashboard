/**
 * 优化后的类型定义 - 使用TypeScript Utility Types减少重复
 */

// 基础时间戳类型
export interface Timestamps {
  created_at: string;
  updated_at: string;
}

// 基础ID类型
export interface WithId {
  id: number;
}

// 软删除类型
export interface SoftDeletable {
  is_deleted: boolean;
  deleted_at?: string;
}

// ========== 合作者相关类型 ==========

// 合作者基础信息（用于创建和更新）
export interface CollaboratorBase {
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
  is_senior?: boolean;
  is_group?: boolean;
}

// 完整的合作者类型
export interface Collaborator extends CollaboratorBase, WithId, Timestamps, SoftDeletable {
  project_count?: number;
}

// 创建合作者 - 必填字段name，其他可选
export type CollaboratorCreate = Pick<CollaboratorBase, 'name'> & 
  Partial<Omit<CollaboratorBase, 'name'>>;

// 更新合作者 - 所有字段可选
export type CollaboratorUpdate = Partial<CollaboratorBase>;

// ========== 研究项目相关类型 ==========

// 项目基础信息
export interface ResearchProjectBase {
  title: string;
  idea_description: string;
  research_method?: string;
  source?: string;
  status: string;
  progress: number;
  expected_completion?: string;
  is_todo: boolean;
  todo_marked_at?: string;
}

// 完整的研究项目类型
export interface ResearchProject extends ResearchProjectBase, WithId, Timestamps {
  start_date: string;
  actual_start_date?: string;
  collaborators: Collaborator[];
  communication_logs: CommunicationLog[];
  latest_communication?: string;
}

// 创建研究项目 - 必填title和idea_description
export type ResearchProjectCreate = Pick<ResearchProjectBase, 'title' | 'idea_description'> &
  Partial<Omit<ResearchProjectBase, 'title' | 'idea_description'>> & {
    collaborator_ids?: number[];
  };

// 更新研究项目 - 所有字段可选
export type ResearchProjectUpdate = Partial<ResearchProjectBase> & {
  collaborator_ids?: number[];
};

// ========== 交流日志相关类型 ==========

// 交流日志基础信息
export interface CommunicationLogBase {
  communication_type: string;
  title: string;
  content: string;
  outcomes?: string;
  action_items?: string;
  communication_date: string;
}

// 完整的交流日志类型
export interface CommunicationLog extends CommunicationLogBase, WithId, Timestamps {
  project_id: number;
  collaborator_id?: number;
  collaborator?: Collaborator;
}

// 创建交流日志
export type CommunicationLogCreate = CommunicationLogBase & {
  collaborator_id?: number;
};

// 更新交流日志
export type CommunicationLogUpdate = Partial<CommunicationLogBase>;

// ========== Ideas相关类型 ==========

// Idea基础信息
export interface IdeaBase {
  research_question: string;
  research_method: string;
  source_journal: string;
  source_literature: string;
  responsible_person: string;
  maturity: 'mature' | 'immature';
  description?: string;
}

// 完整的Idea类型
export interface Idea extends IdeaBase, WithId, Timestamps {}

// 创建Idea - 所有基础字段必填（除了description）
export type IdeaCreate = IdeaBase;

// 更新Idea - 所有字段可选
export type IdeaUpdate = Partial<IdeaBase>;

// ========== 系统配置相关类型 ==========

// 系统配置基础信息
export interface SystemConfigBase {
  config_key: string;
  config_value: string;
  category: string;
  description?: string;
  is_encrypted?: boolean;
  is_active?: boolean;
}

// 完整的系统配置
export interface SystemConfig extends SystemConfigBase, WithId, Timestamps {}

// 创建系统配置
export type SystemConfigCreate = Pick<SystemConfigBase, 'config_key' | 'config_value' | 'category'> &
  Partial<Omit<SystemConfigBase, 'config_key' | 'config_value' | 'category'>>;

// 更新系统配置
export type SystemConfigUpdate = Partial<SystemConfigBase>;

// ========== AI配置相关类型 ==========

export interface AIProvider {
  provider_name: string;
  api_key: string;
  api_url?: string;
  is_active: boolean;
  created_at: string;
}

export type AIProviderCreate = Omit<AIProvider, 'created_at'>;

// ========== Prompt管理相关类型 ==========

export interface PromptBase {
  name: string;
  content: string;
  description?: string;
  is_active?: boolean;
}

export interface Prompt extends PromptBase, WithId, Timestamps {}

export type PromptCreate = PromptBase;
export type PromptUpdate = Partial<PromptBase>;

// ========== 用户相关类型 ==========

export interface User extends WithId, Timestamps {
  username: string;
  email?: string;
  is_active: boolean;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

// ========== 通用响应类型 ==========

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  timestamp?: string;
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
}

export interface FileUploadResponse {
  message: string;
  imported_count: number;
  errors: string[];
}

export interface BackupStats {
  total_backups: number;
  latest_backup?: string;
  total_size_mb: number;
}

export interface BackupInfo {
  id: string;
  created_at: string;
  size_mb: number;
  description?: string;
}

export interface BackupListResponse {
  backups: BackupInfo[];
  total: number;
}

export interface BackupCreateResponse {
  message: string;
  backup_id: string;
}

export interface AITestResponse {
  success: boolean;
  message: string;
  response?: string;
  error?: string;
}

// ========== 辅助类型工具 ==========

// 从类型中排除时间戳和ID字段
export type WithoutMeta<T> = Omit<T, keyof (WithId & Timestamps)>;

// 创建一个部分更新类型（排除ID和时间戳）
export type PartialUpdate<T> = Partial<WithoutMeta<T>>;

// 创建一个必填某些字段的类型
export type RequiredFields<T, K extends keyof T> = Partial<T> & Pick<T, K>;