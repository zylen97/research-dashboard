/**
 * 灰度色彩系统 - 包豪斯极简主义
 * 严格的黑白灰5级灰度映射
 */

export const GRAYSCALE_SYSTEM = {
  // 文字颜色
  primary: '#333333',      // 主文字、重要信息
  secondary: '#666666',    // 次要文字、辅助信息
  tertiary: '#999999',     // 提示文字、占位符

  // 背景色
  bg_primary: '#FFFFFF',   // 主背景
  bg_secondary: '#F5F5F5', // 次级背景、卡片
  bg_tertiary: '#E8E8E8',  // 三级背景、悬停

  // 边框色
  border_light: '#E8E8E8',   // 轻边框
  border_medium: '#D9D9D9',  // 中边框
  border_strong: '#BFBFBF',  // 强边框

  // 特殊状态
  disabled: '#BFBFBF',     // 禁用状态
  error: '#8C8C8C',        // 错误提示（深灰代替红色）
} as const;

/**
 * 原彩色到灰度的映射关系
 * 用于批量替换
 */
export const COLOR_TO_GRAYSCALE_MAP = {
  // 蓝色#1890ff（进行中、通讯作者、Logo）-> 中等灰度
  '#1890ff': '#666666',

  // 红色#ff4d4f（待办、第一作者、警告）-> 深灰度（强调）
  '#ff4d4f': '#333333',

  // 橙色#faad14（暂停、Idea图标）-> 中浅灰度
  '#faad14': '#8C8C8C',

  // 绿色#52c41a（已完成）-> 浅灰度（弱化）
  '#52c41a': '#999999',

  // 紫色#722ed1（审稿中）-> 中灰度
  '#722ed1': '#737373',
} as const;

/**
 * WCAG AA对比度验证
 * 确保所有颜色组合符合可访问性标准
 */
export const CONTRAST_RATIOS = {
  // #333 on #FFF: 12.63:1 ✓ (AAA)
  primary_on_white: { ratio: 12.63, level: 'AAA' as const },

  // #666 on #FFF: 5.74:1 ✓ (AA)
  secondary_on_white: { ratio: 5.74, level: 'AA' as const },

  // #999 on #FFF: 2.85:1 ✗ (仅用于大字体)
  tertiary_on_white: { ratio: 2.85, level: 'Large Text Only' as const },

  // #333 on #F5F5F5: 11.59:1 ✓ (AAA)
  primary_on_bg: { ratio: 11.59, level: 'AAA' as const },
};
