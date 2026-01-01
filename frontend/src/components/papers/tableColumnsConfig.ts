/**
 * 论文表格列配置
 * 统一管理 PapersListTab 和 JournalPapersTab 的列定义
 */

export interface ColumnConfig {
  key: string;
  title: string;
  width: number;
  category: 'core' | 'optional' | 'papersList-only';
  defaultVisible: boolean;
}

/**
 * 可用列配置
 * category 说明:
 * - core: 核心列，始终显示
 * - optional: 可选列，用户可控制显示/隐藏
 * - papersList-only: 仅在 PapersListTab 显示的列
 */
export const AVAILABLE_COLUMNS: ColumnConfig[] = [
  // ===== 核心列（始终显示） =====
  {
    key: 'title',
    title: '标题',
    width: 300,
    category: 'core',
    defaultVisible: true,
  },
  {
    key: 'year',
    title: '年份',
    width: 80,
    category: 'core',
    defaultVisible: true,
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    category: 'core',
    defaultVisible: true,
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    category: 'core',
    defaultVisible: true,
  },

  // ===== 可选列（用户可控制） =====
  {
    key: 'authors',
    title: '作者',
    width: 150,
    category: 'optional',
    defaultVisible: false,
  },
  {
    key: 'abstract',
    title: '摘要',
    width: 300,
    category: 'optional',
    defaultVisible: false,
  },
  {
    key: 'abstract_summary',
    title: '摘要总结',
    width: 250,
    category: 'optional',
    defaultVisible: false,
  },
  {
    key: 'ai_analysis',
    title: 'AI分析',
    width: 200,
    category: 'optional',
    defaultVisible: false,
  },

  // ===== PapersListTab 特有列 =====
  {
    key: 'journal',
    title: '期刊',
    width: 150,
    category: 'core',
    defaultVisible: true,
  },
  {
    key: 'migration_potential',
    title: '迁移潜力',
    width: 100,
    category: 'papersList-only',
    defaultVisible: true,
  },
  {
    key: 'link',
    title: '预览',
    width: 60,
    category: 'papersList-only',
    defaultVisible: true,
  },
];

/**
 * JournalPapersTab 特有列
 */
export const JOURNAL_PAPERS_COLUMNS: ColumnConfig[] = [
  {
    key: 'link',
    title: '预览',
    width: 80,
    category: 'core',
    defaultVisible: true,
  },
];

/**
 * 获取默认可见列
 */
export const getDefaultVisibleColumns = (includeListOnly: boolean = false): string[] => {
  return AVAILABLE_COLUMNS
    .filter(col => col.defaultVisible && (includeListOnly || col.category !== 'papersList-only'))
    .map(col => col.key);
};

/**
 * 根据 localStorage 获取可见列
 */
export const getVisibleColumnsFromStorage = (storageKey: string, includeListOnly: boolean = false): string[] => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Failed to load column visibility from ${storageKey}:`, e);
  }
  return getDefaultVisibleColumns(includeListOnly);
};

/**
 * 保存可见列到 localStorage
 */
export const saveVisibleColumnsToStorage = (storageKey: string, columns: string[]): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(columns));
  } catch (e) {
    console.warn(`Failed to save column visibility to ${storageKey}:`, e);
  }
};

/**
 * localStorage 键名
 */
export const COLUMN_VISIBILITY_KEYS = {
  PAPERS_LIST: 'papersListTab.columns',
  JOURNAL_PAPERS: 'journalPapersTab.columns',
} as const;
