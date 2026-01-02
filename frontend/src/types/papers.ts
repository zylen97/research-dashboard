/**
 * 论文管理类型定义
 */

import type { Journal } from './journals';

// ===== 论文状态枚举 =====

export type PaperStatus = 'pending' | 'analyzed' | 'converted';

export type MigrationPotential = 'high' | 'medium' | 'low';

// ===== AI分析结果类型 =====

export interface AIAnalysisResult {
  core_idea: string;                    // 核心idea总结
  migration_potential: MigrationPotential;  // 迁移潜力
  reason: string;                       // 判断理由
  innovation_points: string[];          // 创新点列表
  // v2_detailed版本额外字段
  technical_relevance?: MigrationPotential;
  method_novelty?: MigrationPotential;
  data_feasibility?: MigrationPotential;
  implementation_difficulty?: MigrationPotential;
  risks?: string[];
}

// ===== 论文类型定义 =====

// 论文基础数据
export interface PaperBase {
  title: string;                    // 论文标题
  authors?: string | null;          // 作者列表
  abstract?: string | null;         // 摘要
  keywords?: string | null;         // 关键词
  year?: number | null;             // 发表年份
  volume?: string | null;           // 卷
  issue?: string | null;            // 期
  pages?: string | null;            // 页码
  doi?: string | null;              // DOI
  journal_id?: number | null;       // 关联期刊ID
  // 翻译字段 (v3.5)
  link?: string | null;             // 文献预览URL
  title_translation?: string | null;  // 标题翻译
  abstract_translation?: string | null;  // 摘要翻译
  abstract_summary?: string | null;     // 摘要总结
}

// 创建论文请求
export interface PaperCreate extends PaperBase {}

// 更新论文请求（所有字段可选）
export interface PaperUpdate {
  title?: string;
  authors?: string | null;
  abstract?: string | null;
  keywords?: string | null;
  year?: number | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  journal_id?: number | null;
  status?: PaperStatus;
  // 翻译字段 (v3.5)
  link?: string | null;
  title_translation?: string | null;
  abstract_translation?: string | null;
  abstract_summary?: string | null;
}

// 完整的论文数据（从API返回）
export interface Paper extends PaperBase {
  id: number;

  // AI分析字段
  ai_analysis_result?: string | null;       // AI分析完整结果（JSON字符串）
  migration_potential?: MigrationPotential | null;  // 迁移潜力
  core_idea_summary?: string | null;        // 核心idea摘要
  innovation_points?: string | null;        // 创新点（JSON字符串）
  ai_analyzed_at?: string | null;           // AI分析时间

  // 状态管理
  source: string;                   // 来源
  import_batch_id?: string | null;  // 导入批次ID
  status: PaperStatus;              // 状态

  // 系统字段
  created_at: string;
  updated_at: string;
  created_by: number;

  // 关联的期刊
  journal?: Journal | null;
}

// 解析后的AI分析结果（从ai_analysis_result解析）
export interface ParsedAIAnalysis {
  core_idea: string;
  migration_potential: MigrationPotential;
  reason: string;
  innovation_points: string[];
  technical_relevance?: MigrationPotential;
  method_novelty?: MigrationPotential;
  data_feasibility?: MigrationPotential;
  implementation_difficulty?: MigrationPotential;
  risks?: string[];
}

// ===== API响应类型 =====

// 文件上传响应
export interface PaperUploadResponse {
  message: string;
  imported_count: number;
  errors: string[];
}

// 批量删除响应
export interface BatchDeleteResponse {
  deleted_count: number;
  errors: string[];
}

// 批量分析响应
export interface BatchAnalyzeResponse {
  total: number;
  success: number;
  failed: number;
  details: Array<{
    paper_id: number;
    success: boolean;
    analysis?: AIAnalysisResult;
    error?: string;
  }>;
}

// 单篇分析响应
export interface SingleAnalyzeResponse {
  paper_id: number;
  success: boolean;
  analysis?: AIAnalysisResult;
  error?: string;
}

// 论文转Idea响应
export interface ConvertToIdeaResponse {
  idea_id: number;
  paper_id: number;
}

// 论文统计响应
export interface PapersStatsResponse {
  total: number;
  by_status: {
    pending: number;
    analyzed: number;
    converted: number;
  };
  by_potential: {
    high: number;
    medium: number;
    low: number;
  };
}

// ===== 查询参数类型 =====

export type PaperSortField = 'created_at' | 'year' | 'volume' | 'issue';

export type SortOrder = 'asc' | 'desc';

export interface PapersQueryParams {
  skip?: number;
  limit?: number;
  status?: PaperStatus;
  migration_potential?: MigrationPotential;
  journal_id?: number;
  batch_id?: string;
  search?: string;
  sort_by?: PaperSortField;
  sort_order?: SortOrder;
}

// ===== 提示词模板类型 =====

// 提示词模板
export interface PromptTemplate {
  name: string;                    // 模板名称（唯一标识）
  content: string;                 // 提示词内容（支持变量替换）
  variables: string[];             // 变量列表（自动提取）
  is_default: boolean;             // 是否为默认模板
  created_at?: string;             // 创建时间
  updated_at?: string;             // 更新时间
}

// 创建提示词模板请求
export interface PromptTemplateCreate {
  name: string;
  content: string;
  is_default?: boolean;
}

// 更新提示词模板请求
export interface PromptTemplateUpdate {
  content?: string;
  is_default?: boolean;
}

// ===== 全局用户配置类型 =====

export interface UserConfig {
  user_profile: string;            // 用户研究背景描述
  research_fields: string[];       // 研究领域列表
}

// ===== 期卷号统计类型 =====

// 期号统计项
export interface IssueStatItem {
  issue: string;   // 期号
  count: number;   // 论文数量
}

// 卷号统计项
export interface VolumeStatItem {
  volume: string;              // 卷号
  count: number;               // 该卷论文总数
  year: number;                // 年份
  issues: IssueStatItem[];     // 该卷包含的期号列表
}

// 覆盖项（按年份分组）
export interface CoverageItem {
  volume: string;  // 卷号
  issue: string;   // 期号
  count: number;   // 论文数量
}

export interface VolumeStats {
  journal_id: number;
  journal_name: string;
  total_papers: number;           // 总论文数
  volumes: VolumeStatItem[];       // 卷号列表（含期号）
  issues: IssueStatItem[];         // 所有期号列表（扁平）
  coverage_by_year: Record<number, CoverageItem[]>;  // 按年份分组的卷期覆盖
  latest_volume: string | null;    // 最新卷号
  latest_issue: string | null;     // 最新期号
  total_volumes: number;           // 总卷数（去重）
  total_issues: number;            // 总期数（去重）
  // 数据库字段（v3.6）
  db_latest_volume: string | null;
  db_latest_issue: string | null;
  db_paper_count: number;
}
