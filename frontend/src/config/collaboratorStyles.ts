/**
 * 合作者视觉系统 - 包豪斯风格
 * 通过符号、字重、背景色区分合作者重要性
 */

export const COLLABORATOR_VISUAL_SYSTEM = {
  senior: {
    // 高级合作者
    fontWeight: 600,
    fontSize: '13px',
    icon: '★',
    label: '高级合作者',
    backgroundColor: '#F5F5F5',
    color: '#333333',
    padding: '2px 6px',
    borderRadius: '2px',
  },

  regular: {
    // 普通合作者
    fontWeight: 400,
    fontSize: '13px',
    icon: '',
    label: '普通合作者',
    backgroundColor: 'transparent',
    color: '#666666',
    padding: '0',
    borderRadius: '0',
  },
} as const;

// TypeScript类型辅助
export type CollaboratorLevel = keyof typeof COLLABORATOR_VISUAL_SYSTEM;
