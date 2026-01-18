/**
 * 期刊库类型定义
 */

// ===== 标签类型定义 =====

// 标签基础数据
export interface TagBase {
  name: string;                // 标签名称（唯一）
  description?: string | null;  // 标签描述
  color?: string;              // 前端显示颜色（已废弃，保留字段以兼容后端）
}

// 完整的标签数据（从API返回）
export interface Tag extends TagBase {
  id: number;
  created_at: string;
  updated_at: string;
  journal_count: number;  // 使用该标签的期刊数量
}

// 创建标签请求
export interface TagCreate extends TagBase {}

// 更新标签请求（所有字段可选）
export interface TagUpdate {
  name?: string;
  description?: string | null;
  color?: string;
}

// ===== 期刊类型定义 =====

// 期刊基础数据（创建/更新时使用）
export interface JournalBase {
  name: string;                    // 期刊名称（唯一）
  notes?: string | null;           // 备注
}

// 完整的期刊数据（从API返回）
export interface Journal extends JournalBase {
  id: number;
  created_at: string;
  updated_at: string;

  // 标签关联
  tags: Tag[];  // 关联的标签列表

  // 统计字段（动态计算，v4.2简化）
  reference_count: number;      // 作为参考期刊的引用次数
  target_count: number;         // 作为投稿期刊的引用次数
  issues_count: number;         // 浏览记录数量

  // v3.6 期卷号跟踪字段
  latest_volume?: string | null;   // 最新卷号
  latest_issue?: string | null;    // 最新期号
}

// 创建期刊请求
export interface JournalCreate extends JournalBase {
  tag_ids: number[];  // 关联的标签ID列表（可选）
}

// 更新期刊请求（所有字段可选）
export interface JournalUpdate {
  name?: string;
  notes?: string | null;
  tag_ids?: number[];  // 标签ID列表（完全替换）
}

// 期刊统计详情
export interface JournalStats {
  journal: {
    id: number;
    name: string;
    notes?: string | null;
    tags: Array<{
      id: number;
      name: string;
      color: string;
    }>;
  };
  stats: {
    reference_count: number;
    target_count: number;
    total_count: number;
  };
  breakdown: {
    reference_ideas_count: number;
    reference_projects_count: number;
    target_ideas_count: number;
    target_projects_count: number;
  };
}

// 期刊引用详情
export interface JournalReferences {
  journal_name: string;
  ref_type_filter: 'reference' | 'target' | 'all';
  references: {
    reference_ideas: Array<{
      id: number;
      project_name: string;
      responsible_person: string | null;
      maturity: string;
      created_at: string | null;
    }>;
    reference_projects: Array<{
      id: number;
      title: string;
      status: string;
      created_at: string | null;
    }>;
    target_ideas: Array<{
      id: number;
      project_name: string;
      responsible_person: string | null;
      maturity: string;
      created_at: string | null;
    }>;
    target_projects: Array<{
      id: number;
      title: string;
      status: string;
      created_at: string | null;
    }>;
  };
}

// 批量导入响应
export interface JournalBatchImportResponse {
  message: string;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  skipped_journals: Array<{
    name: string;
    reason: string;
  }>;
  errors: Array<{
    name: string;
    error: string;
  }>;
}

// ===== 网络首发追踪类型定义 =====

// 网络首发追踪记录
export interface OnlineFirstTracking {
  id: number;
  journal_id: number;
  tracked_date: string;  // YYYY-MM-DD格式
  tracked_at: string;    // ISO datetime
  notes?: string | null;
  is_today: boolean;
}
