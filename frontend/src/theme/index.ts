import { theme } from 'antd';

// 自定义色彩系统
export const colors = {
  // 主题色
  primary: {
    50: '#e6f4ff',
    100: '#bae0ff',
    200: '#91caff',
    300: '#69b1ff',
    400: '#4096ff',
    500: '#1677ff', // 主色
    600: '#0958d9',
    700: '#003eb3',
    800: '#002c8c',
    900: '#001d66',
  },
  
  // 成功色 - 现代绿色
  success: {
    50: '#f0f9ff',
    500: '#10b981',
    600: '#059669',
  },
  
  // 警告色 - 现代橙色
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // 错误色 - 现代红色
  error: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // 中性色
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

// 亮色主题配置
export const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // 基础色彩
    colorPrimary: colors.primary[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    
    // 背景色
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f5f5f5',
    
    // 文字色
    colorText: colors.gray[900],
    colorTextSecondary: colors.gray[600],
    colorTextTertiary: colors.gray[400],
    
    // 边框色
    colorBorder: colors.gray[200],
    colorBorderSecondary: colors.gray[100],
    
    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    
    // 阴影 - 增强视觉层次
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    boxShadowSecondary: '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 6px 0 rgba(0, 0, 0, 0.04)',
    boxShadowTertiary: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    
    // 字体
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: '#f5f5f5',
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      paddingSM: 12,
      paddingLG: 20,
    },
    Button: {
      borderRadius: 8,
      fontWeight: 500,
      controlHeight: 36,
      primaryShadow: '0 2px 0 rgba(5, 145, 255, 0.1)',
      defaultBorderColor: colors.gray[200],
      defaultShadow: 'none',
    },
    Table: {
      borderRadius: 8,
      headerBg: colors.gray[50],
      headerSplitColor: colors.gray[200],
      rowHoverBg: colors.gray[50],
      fontSize: 13,
    },
    Modal: {
      borderRadiusLG: 16,
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      contentBg: '#ffffff',
      headerBg: '#ffffff',
    },
    Input: {
      borderRadius: 8,
      activeBorderColor: colors.primary[500],
      hoverBorderColor: colors.primary[400],
      controlHeight: 36,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Tag: {
      borderRadiusSM: 6,
      fontSize: 12,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 20,
    },
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 4,
      itemHeight: 40,
    },
    Dropdown: {
      borderRadiusLG: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
    },
  },
};

// 暗色主题配置
export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    // 基础色彩
    colorPrimary: colors.primary[400],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    
    // 背景色
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#262626',
    colorBgLayout: '#141414',
    
    // 文字色
    colorText: '#ffffff',
    colorTextSecondary: colors.gray[300],
    colorTextTertiary: colors.gray[500],
    
    // 边框色
    colorBorder: colors.gray[700],
    colorBorderSecondary: colors.gray[800],
    
    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    
    // 阴影
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.2), 0 1px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    
    // 字体
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#1f1f1f',
      siderBg: '#1f1f1f',
      bodyBg: '#141414',
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
      paddingSM: 12,
      paddingLG: 20,
    },
    Button: {
      borderRadius: 8,
      fontWeight: 500,
      controlHeight: 36,
      primaryShadow: '0 2px 0 rgba(5, 145, 255, 0.2)',
      defaultBorderColor: colors.gray[700],
      defaultShadow: 'none',
    },
    Table: {
      borderRadius: 8,
      headerBg: '#262626',
      headerSplitColor: colors.gray[700],
      rowHoverBg: '#262626',
      fontSize: 13,
    },
    Modal: {
      borderRadiusLG: 16,
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
      contentBg: '#1f1f1f',
      headerBg: '#1f1f1f',
    },
    Input: {
      borderRadius: 8,
      activeBorderColor: colors.primary[400],
      hoverBorderColor: colors.primary[300],
      controlHeight: 36,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Tag: {
      borderRadiusSM: 6,
      fontSize: 12,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 20,
    },
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 4,
      itemHeight: 40,
    },
    Dropdown: {
      borderRadiusLG: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.2), 0 3px 6px -4px rgba(0, 0, 0, 0.3), 0 9px 28px 8px rgba(0, 0, 0, 0.15)',
    },
  },
};

// 主题类型
export type ThemeMode = 'light' | 'dark';

// 获取主题配置
export const getThemeConfig = (mode: ThemeMode) => {
  return mode === 'dark' ? darkTheme : lightTheme;
};