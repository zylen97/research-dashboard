import React from 'react';
import { Card, Button, Space } from 'antd';
import { styleConstants, commonStyles } from './constants';

// 页面容器组件
export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="content-wrapper">
    {children}
  </div>
);

// 页面头部组件
export const PageHeader: React.FC<{
  title: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, actions }) => (
  <div className="page-header">
    {title}
    {actions && <Space>{actions}</Space>}
  </div>
);

// 统计卡片容器
export const StatsContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ marginBottom: styleConstants.spacing.lg }}>
    {children}
  </div>
);

// 内容卡片组件
export const ContentCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = '', style }) => (
  <Card 
    className={`hover-shadow ${className}`}
    style={{
      ...commonStyles.cardContainer,
      ...style
    }}
  >
    {children}
  </Card>
);

// 表格容器组件
export const TableContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`table-container ${className}`}>
    {children}
  </div>
);

// 筛选栏组件
export const FilterBar: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div className="filter-bar" style={style}>
    {children}
  </div>
);

// 操作按钮组
export const ActionButtons: React.FC<{
  children: React.ReactNode;
  size?: 'small' | 'middle' | 'large';
}> = ({ children, size = 'small' }) => (
  <Space size={size} className="action-buttons">
    {children}
  </Space>
);

// 统一的筛选区域组件
export const FilterSection: React.FC<{
  actionButtons?: React.ReactNode;
  filterControls: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ actionButtons, filterControls, style }) => (
  <div
    className="filter-section"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: styleConstants.spacing.md,
      flexWrap: 'wrap',
      ...style
    }}
  >
    {actionButtons && <ActionButtons>{actionButtons}</ActionButtons>}
    <FilterBar>{filterControls}</FilterBar>
  </div>
);

// 悬浮按钮
export const FloatButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  type?: 'primary' | 'default';
  style?: React.CSSProperties;
}> = ({ icon, onClick, type = 'primary', style }) => (
  <Button
    type={type}
    shape="circle"
    icon={icon}
    size="large"
    onClick={onClick}
    style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      boxShadow: styleConstants.shadows.lg,
      ...style
    }}
  />
);

// 空状态组件
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div style={{
    textAlign: 'center',
    padding: `${styleConstants.spacing.xxl}px ${styleConstants.spacing.lg}px`,
  }}>
    {icon && (
      <div style={{ 
        fontSize: 48, 
        color: 'var(--ant-color-text-tertiary)',
        marginBottom: styleConstants.spacing.lg 
      }}>
        {icon}
      </div>
    )}
    <div style={{ 
      fontSize: 16, 
      fontWeight: 500,
      marginBottom: styleConstants.spacing.sm 
    }}>
      {title}
    </div>
    {description && (
      <div style={{ 
        color: 'var(--ant-color-text-secondary)',
        marginBottom: styleConstants.spacing.lg 
      }}>
        {description}
      </div>
    )}
    {action}
  </div>
);

// 加载骨架屏
export const LoadingSkeleton: React.FC<{
  rows?: number;
}> = ({ rows = 3 }) => (
  <div style={{ padding: styleConstants.spacing.lg }}>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        style={{
          height: 20,
          background: 'var(--ant-color-fill-tertiary)',
          borderRadius: styleConstants.borderRadius.sm,
          marginBottom: styleConstants.spacing.md,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    ))}
  </div>
);

// 导出所有组件
export default {
  PageContainer,
  PageHeader,
  StatsContainer,
  ContentCard,
  TableContainer,
  FilterBar,
  ActionButtons,
  FilterSection,
  FloatButton,
  EmptyState,
  LoadingSkeleton,
};