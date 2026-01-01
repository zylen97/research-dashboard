/**
 * 论文状态配置
 * 统一管理论文状态的显示样式和文本
 */

export const PAPER_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  pending: { text: '待分析', color: '#999' },
  analyzed: { text: '已分析', color: '#333' },
};

/**
 * 获取状态配置
 */
export const getStatusConfig = (status: string) => {
  return PAPER_STATUS_CONFIG[status] || { text: status, color: '#999' };
};
