/**
 * 状态视觉系统 - 包豪斯风格
 * 通过符号、字重、边框样式区分4种项目状态
 */

export const STATUS_VISUAL_SYSTEM = {
  writing: {
    // 撰写 - 中等强调
    textWeight: 500,
    borderStyle: 'solid' as const,
    borderWidth: '2px',
    borderColor: '#666666',
    backgroundColor: '#FFFFFF',
    icon: '●', // 实心圆
    label: '撰写',
  },

  submitting: {
    // 投稿 - 强调（最深灰度，使用原返修中样式）
    textWeight: 600,
    borderStyle: 'solid' as const,
    borderWidth: '2px',
    borderColor: '#333333',
    backgroundColor: '#FAFAFA',
    icon: '◆', // 实心菱形
    label: '投稿',
  },

  published: {
    // 发表 - 弱化
    textWeight: 400,
    borderStyle: 'solid' as const,
    borderWidth: '1px',
    borderColor: '#D9D9D9',
    backgroundColor: '#F5F5F5',
    icon: '○', // 空心圆
    label: '发表',
  },
} as const;

// TypeScript类型辅助
export type ProjectStatus = keyof typeof STATUS_VISUAL_SYSTEM;
