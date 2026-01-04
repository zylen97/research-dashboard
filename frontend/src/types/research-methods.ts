/**
 * 研究方法类型定义
 */

export interface ResearchMethod {
  id: number;
  name: string;
  usage_count: number;
  created_at: string;
}

export interface ResearchMethodCreate {
  name: string;
}

export interface ResearchMethodUpdate {
  name?: string;
}
