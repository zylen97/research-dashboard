// 统一样式常量管理
export const styleConstants = {
  // 间距系统
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  // 圆角系统
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },

  // 阴影系统
  shadows: {
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    md: '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 6px 0 rgba(0, 0, 0, 0.04)',
    lg: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 6px 10px -5px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // 动画时长
  transitions: {
    fast: '0.15s',
    normal: '0.3s',
    slow: '0.45s',
  },

  // 动画缓动函数
  easings: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },

  // 响应式断点
  breakpoints: {
    xs: 480,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1600,
  },

  // z-index 层级管理
  zIndices: {
    dropdown: 1050,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
};

// 样式工具函数
export const styleUtils = {
  // 获取间距
  getSpacing: (size: keyof typeof styleConstants.spacing) => 
    `${styleConstants.spacing[size]}px`,

  // 获取圆角
  getBorderRadius: (size: keyof typeof styleConstants.borderRadius) => 
    `${styleConstants.borderRadius[size]}px`,

  // 获取阴影
  getShadow: (size: keyof typeof styleConstants.shadows) => 
    styleConstants.shadows[size],

  // 获取过渡
  getTransition: (props: string[], duration: keyof typeof styleConstants.transitions = 'normal') => 
    props.map(prop => `${prop} ${styleConstants.transitions[duration]} ${styleConstants.easings.standard}`).join(', '),

  // 媒体查询
  media: {
    xs: `@media (max-width: ${styleConstants.breakpoints.xs}px)`,
    sm: `@media (max-width: ${styleConstants.breakpoints.sm}px)`,
    md: `@media (max-width: ${styleConstants.breakpoints.md}px)`,
    lg: `@media (max-width: ${styleConstants.breakpoints.lg}px)`,
    xl: `@media (max-width: ${styleConstants.breakpoints.xl}px)`,
    xxl: `@media (max-width: ${styleConstants.breakpoints.xxl}px)`,
  },
};

// 通用样式对象
export const commonStyles = {
  // 页面头部
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: styleConstants.spacing.lg,
  },

  // 卡片容器
  cardContainer: {
    borderRadius: styleConstants.borderRadius.lg,
    boxShadow: styleConstants.shadows.sm,
    transition: styleUtils.getTransition(['box-shadow', 'transform']),
  },

  // 表格容器
  tableContainer: {
    background: 'var(--ant-color-bg-container)',
    borderRadius: styleConstants.borderRadius.md,
    boxShadow: styleConstants.shadows.sm,
  },

  // 悬浮效果
  hoverEffect: {
    transition: styleUtils.getTransition(['all']),
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: styleConstants.shadows.md,
    },
  },

  // 聚焦效果
  focusEffect: {
    '&:focus': {
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(24, 144, 255, 0.1)',
    },
  },
};

// 导出所有常量和工具
export default {
  ...styleConstants,
  ...styleUtils,
  commonStyles,
};