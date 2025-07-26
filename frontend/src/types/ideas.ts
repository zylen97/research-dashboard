/**
 * Ideas管理类型定义 - 重新设计版本
 */

// Idea基础信息
export interface IdeaBase {
  project_name: string;           // 项目名称
  project_description?: string;   // 项目描述（可选）
  research_method: string;        // 研究方法
  source?: string;               // 来源信息（可选）
  responsible_person: string;     // 负责人
  maturity: 'mature' | 'immature'; // 成熟度
}

// 完整的Idea类型
export interface Idea extends IdeaBase {
  id: number;
  created_at: string;
  updated_at: string;
}

// 创建Idea的数据
export interface IdeaCreate extends IdeaBase {}

// 更新Idea的数据
export interface IdeaUpdate extends Partial<IdeaBase> {}

// 转化响应
export interface ConvertToProjectResponse {
  message: string;
  project_id: number;
  project_title: string;
}

// 成熟度选项
export const MATURITY_OPTIONS = [
  { value: 'immature', label: '不成熟' },
  { value: 'mature', label: '成熟' }
] as const;