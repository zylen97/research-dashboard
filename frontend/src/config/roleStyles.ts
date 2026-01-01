/**
 * 身份视觉系统 - 包豪斯风格
 * 通过符号、字重、字号、下划线区分3种作者角色
 */

export const ROLE_VISUAL_SYSTEM = {
  first_author: {
    // 第一作者 - 最强调
    fontSize: '13px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    icon: '①',
    label: '第一作者',
    borderBottom: '2px solid #333333',
    color: '#333333',
  },

  corresponding_author: {
    // 通讯作者 - 次强调
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'none' as const,
    letterSpacing: '0.3px',
    icon: '✉',
    label: '通讯作者',
    borderBottom: '1px solid #666666',
    color: '#666666',
  },

  other_author: {
    // 其他作者 - 常规
    fontSize: '12px',
    fontWeight: 400,
    textTransform: 'none' as const,
    letterSpacing: 'normal',
    icon: '·',
    label: '其他作者',
    borderBottom: 'none',
    color: '#999999',
  },
} as const;

// TypeScript类型辅助
export type AuthorRole = keyof typeof ROLE_VISUAL_SYSTEM;
