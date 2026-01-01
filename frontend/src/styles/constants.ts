import React from 'react';

// 样式常量
export const styleConstants = {
  // 间距系统
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // 圆角
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },

  // 阴影
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },

  // 控件宽度
  controlWidths: {
    SELECT_NORMAL: 200,    // 普通下拉框
    SELECT_SMALL: 120,     // 小型下拉框（状态）
    SEARCH: 250,           // 搜索框
    INPUT_NORMAL: 200,     // 普通输入框
  },
};

// 通用样式
export const commonStyles = {
  // 卡片容器样式
  cardContainer: {
    marginBottom: styleConstants.spacing.lg,
    borderRadius: styleConstants.borderRadius.md,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  } as React.CSSProperties,
};
