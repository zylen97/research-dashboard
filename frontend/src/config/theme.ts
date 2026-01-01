/**
 * 包豪斯风格主题配置
 * 极简黑白灰单色系统 + 理性排版
 */
import type { ThemeConfig } from 'antd';

export const bauHausTheme: ThemeConfig = {
  token: {
    // === 色彩系统 ===
    // 主色：深灰（代替蓝色）
    colorPrimary: '#333333',
    colorSuccess: '#666666',    // 成功 -> 中灰
    colorWarning: '#8C8C8C',    // 警告 -> 中浅灰
    colorError: '#333333',      // 错误 -> 深灰（通过边框样式区分）
    colorInfo: '#666666',       // 信息 -> 中灰

    // 文字颜色
    colorText: '#333333',
    colorTextSecondary: '#666666',
    colorTextTertiary: '#999999',
    colorTextQuaternary: '#BFBFBF',

    // 背景色
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FAFAFA',
    colorBgLayout: '#F5F5F5',
    colorBgSpotlight: '#E8E8E8',

    // 边框颜色
    colorBorder: '#E8E8E8',
    colorBorderSecondary: '#F0F0F0',

    // === 排版系统 ===
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeHeading1: 32,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,

    // 字重
    fontWeightStrong: 600,

    // 行高
    lineHeight: 1.5715,
    lineHeightHeading1: 1.2,
    lineHeightHeading2: 1.3,
    lineHeightHeading3: 1.4,

    // === 间距系统（包豪斯：理性的栅格） ===
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,
    marginXXL: 48,

    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingMD: 20,
    paddingLG: 24,
    paddingXL: 32,

    // === 边框系统（细线条） ===
    lineWidth: 1,
    lineWidthBold: 2,
    lineType: 'solid',

    // === 圆角系统（极简：保持锐利） ===
    borderRadius: 2,          // 基础圆角：2px（接近直角）
    borderRadiusLG: 4,        // 大圆角：4px
    borderRadiusSM: 2,        // 小圆角：2px
    borderRadiusXS: 1,        // 极小圆角：1px

    // === 阴影系统（移除所有阴影） ===
    boxShadow: 'none',
    boxShadowSecondary: 'none',
    boxShadowTertiary: 'none',

    // === 动画系统（保持克制） ===
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0.0, 0, 0.2, 1)',

    // === 控件高度 ===
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
  },

  components: {
    // === Button 按钮 ===
    Button: {
      primaryShadow: 'none',
      dangerShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 500,
      borderRadius: 2,
      controlHeight: 32,
      paddingContentHorizontal: 16,

      // 主按钮：深灰底+白字
      colorPrimary: '#333333',
      colorPrimaryHover: '#1a1a1a',
      colorPrimaryActive: '#000000',

      // 危险按钮：深灰+粗边框
      colorError: '#333333',
      colorErrorHover: '#1a1a1a',
      colorErrorBorderHover: '#333333',
    },

    // === Tag 标签（关键组件） ===
    Tag: {
      defaultBg: '#F5F5F5',
      defaultColor: '#333333',
      borderRadiusSM: 2,
      fontSizeSM: 12,
      lineHeight: 1.5,

      // 移除预设颜色的背景
      colorSuccess: '#666666',
      colorError: '#333333',
      colorWarning: '#8C8C8C',
    },

    // === Card 卡片 ===
    Card: {
      boxShadow: 'none',
      borderRadiusLG: 4,
      paddingLG: 24,
      headerFontSize: 16,
      headerFontSizeSM: 14,

      // 使用细边框代替阴影
      lineWidth: 1,
      colorBorderSecondary: '#E8E8E8',
    },

    // === Table 表格 ===
    Table: {
      headerBg: '#FAFAFA',
      headerColor: '#333333',
      headerSplitColor: '#E8E8E8',
      borderColor: '#E8E8E8',
      rowHoverBg: '#F5F5F5',

      // 移除阴影
      boxShadow: 'none',
      boxShadowSecondary: 'none',

      // 紧凑间距
      padding: 12,
      paddingSM: 8,
      paddingXS: 4,
    },

    // === Input 输入框 ===
    Input: {
      activeShadow: 'none',
      errorActiveShadow: 'none',
      warningActiveShadow: 'none',

      // 聚焦时使用边框强调
      activeBorderColor: '#333333',
      hoverBorderColor: '#666666',

      borderRadius: 2,
      paddingBlock: 4,
      paddingInline: 11,
    },

    // === Select 选择器 ===
    Select: {
      optionActiveBg: '#F5F5F5',
      optionSelectedBg: '#E8E8E8',
      optionSelectedColor: '#333333',

      clearBg: '#FFFFFF',
      selectorBg: '#FFFFFF',

      // 移除阴影
      boxShadow: 'none',
      boxShadowSecondary: 'none',
    },

    // === Modal 模态框 ===
    Modal: {
      borderRadiusLG: 4,
      boxShadow: 'none',
      contentBg: '#FFFFFF',
      headerBg: '#FAFAFA',
    },

    // === Statistic 统计数值 ===
    Statistic: {
      titleFontSize: 14,
      contentFontSize: 24,
    },

    // === Menu 菜单 ===
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#F5F5F5',
      itemSelectedColor: '#333333',
      itemHoverBg: '#FAFAFA',
      itemHoverColor: '#333333',
      itemActiveBg: '#E8E8E8',

      // 移除高亮颜色
      itemColor: '#666666',
      iconSize: 16,
      iconMarginInlineEnd: 10,
    },

    // === Layout 布局 ===
    Layout: {
      headerBg: '#FFFFFF',
      bodyBg: '#F5F5F5',
      siderBg: '#FFFFFF',

      // 使用边框分隔
      headerPadding: '0 16px',
      headerHeight: 48,
    },

    // === Typography 排版 ===
    Typography: {
      titleMarginTop: '1.2em',
      titleMarginBottom: '0.5em',
    },
  },

  // 全局CSS变量覆盖
  cssVar: true,
  hashed: false,
};

export default bauHausTheme;
