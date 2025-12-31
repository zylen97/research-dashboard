/**
 * Ideas管理类型定义 - 负责人外键化版本
 */

import { Collaborator } from './index';

// Idea基础信息
export interface IdeaBase {
  project_name: string;           // 项目名称
  project_description: string;    // 项目描述（必填）
  research_method: string;        // 研究方法
  source?: string;               // 来源信息（已废弃，使用reference_paper和reference_journal）
  reference_paper?: string;       // 参考论文（可选）
  reference_journal?: string;     // 参考期刊（可选）
  responsible_person_id: number;  // 负责人ID（外键关联collaborators表）
  maturity: 'mature' | 'immature'; // 成熟度
}

// 完整的Idea类型（包含关联的负责人对象）
export interface Idea extends IdeaBase {
  id: number;
  created_at: string;
  updated_at: string;

  // 关联的负责人对象（从后端返回完整的Collaborator对象）
  responsible_person: Collaborator;
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
  responsible_person_added?: string;  // 添加的负责人姓名
}

// 成熟度选项
export const MATURITY_OPTIONS = [
  { value: 'immature', label: '不成熟' },
  { value: 'mature', label: '成熟' }
] as const;