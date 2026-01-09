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

/**
 * 变量类型枚举
 */
export type VariableType =
  | 'journal-multiple'  // 期刊（单选或多选，支持标签快捷选择）
  | 'text-large'        // 大文本
  | 'text';             // 普通文本

/**
 * 变量配置接口
 */
export interface VariableConfig {
  name: string;           // 变量名
  type: VariableType;     // 变量类型
  label: string;          // 显示标签
  rows?: number;          //TextArea 行数（text-large 类型）
  tagName?: string;       // 标签名（journal-tag 类型）
}

/**
 * 预定义变量配置
 */
const VARIABLE_CONFIG: Record<string, Omit<VariableConfig, 'name'>> = {
  // 期刊相关（支持手动选择和标签快捷选择）
  journals: {
    type: 'journal-multiple',
    label: '期刊',
  },
};

/**
 * 根据变量名获取变量配置
 */
export const getVariableConfig = (variableName: string): VariableConfig => {
  // 预定义变量
  if (VARIABLE_CONFIG[variableName]) {
    const config = VARIABLE_CONFIG[variableName]!;
    return {
      name: variableName,
      type: config.type!,
      label: config.label!,
      ...(config.rows !== undefined && { rows: config.rows }),
    };
  }

  // 默认为普通文本
  return {
    name: variableName,
    type: 'text',
    label: variableName,
  };
};

/**
 * 解析变量及其配置（支持text自动编号）
 */
export const parseVariablesWithConfig = (content: string): VariableConfig[] => {
  const variableNames = extractVariables(content);

  // 统计text类型的数量
  let textCount = 0;

  return variableNames.map(name => {
    // 特殊处理：如果是名为"text"的变量，进行自动编号
    if (name === 'text') {
      textCount++;
      return {
        name: `text${textCount}`,
        type: 'text' as VariableType,
        label: `文本${textCount}`,
      };
    }

    // 其他变量使用原有配置
    return getVariableConfig(name);
  });
};
