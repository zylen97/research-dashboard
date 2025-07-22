import React from 'react';

/**
 * 格式化文本，保留换行符
 */
export function formatTextWithLineBreaks(text: string | null | undefined): React.ReactNode {
  if (!text) return '-';
  
  return text.split('\n').map((line, index, array) => (
    <React.Fragment key={index}>
      {line}
      {index < array.length - 1 && <br />}
    </React.Fragment>
  ));
}

/**
 * 获取优先级对应的颜色
 */
export function getPriorityColor(priority: string): string {
  const colorMap: Record<string, string> = {
    high: '#ff4d4f',
    medium: '#faad14',
    low: '#52c41a',
  };
  return colorMap[priority] || '#1890ff';
}

/**
 * 获取状态对应的颜色
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    active: '#52c41a',
    completed: '#1890ff',
    paused: '#faad14',
    cancelled: '#ff4d4f',
  };
  return colorMap[status] || '#d9d9d9';
}

/**
 * 获取难度对应的颜色
 */
export function getDifficultyColor(difficulty: string): string {
  const colorMap: Record<string, string> = {
    easy: '#52c41a',
    medium: '#faad14',
    hard: '#ff4d4f',
  };
  return colorMap[difficulty] || '#1890ff';
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}