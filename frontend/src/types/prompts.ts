/**
 * 提示词管理类型定义（v4.8）
 */

/**
 * 提示词分类枚举
 */
export type PromptCategory =
  | 'reading'      // 文章精读和迁移
  | 'writing'      // 论文写作
  | 'polishing'    // 论文润色
  | 'reviewer'     // 审稿人
  | 'horizontal';  // 横向课题

/**
 * 提示词分类显示名称映射
 */
export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  reading: '文章精读和迁移',
  writing: '论文写作',
  polishing: '论文润色',
  reviewer: '审稿人',
  horizontal: '横向课题'
};

/**
 * 提示词数据模型
 */
export interface Prompt {
  id: number;
  title: string;
  content: string;
  category: PromptCategory;
  description?: string;
  variables: string[];
  usage_count: number;
  is_favorite: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

/**
 * 创建提示词的数据模型
 */
export interface PromptCreate {
  title: string;
  content: string;
  category: PromptCategory;
  description?: string;
  tag_ids?: number[];
}

/**
 * 更新提示词的数据模型
 */
export interface PromptUpdate {
  title?: string;
  content?: string;
  category?: PromptCategory;
  description?: string;
  tag_ids?: number[];
  is_favorite?: boolean;
  is_active?: boolean;
}

/**
 * 复制提示词请求模型
 */
export interface PromptCopyRequest {
  variables?: Record<string, string>;
}

/**
 * 复制提示词响应模型
 */
export interface PromptCopyResponse {
  content: string;
  title: string;
  variables_used: string[];
}

/**
 * 提示词统计模型
 */
export interface PromptStats {
  total_count: number;
  by_category: Record<string, number>;
  top_prompts: Array<{
    id: number;
    title: string;
    category: string;
    usage_count: number;
  }>;
}

/**
 * 分类统计响应模型
 */
export interface PromptCategoriesResponse {
  categories: Array<{
    value: PromptCategory;
    label: string;
  }>;
  counts: Record<string, number>;
}

/**
 * 从 Tag 类型导入（复用现有类型）
 */
export interface Tag {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 提取变量正则表达式
 */
export const VARIABLE_REGEX = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * 从内容中提取变量
 */
export const extractVariables = (content: string): string[] => {
  const matches = content.match(VARIABLE_REGEX);
  return matches
    ? Array.from(new Set(matches.map((m) => m.slice(1, -1))))
    : [];
};
