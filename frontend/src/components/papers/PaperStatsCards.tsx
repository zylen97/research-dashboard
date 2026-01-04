/**
 * 论文统计卡片组件
 * 显示论文总数、待分析、已分析、已转换的统计
 */

import React from 'react';
import { Card, Statistic } from 'antd';

/**
 * 统计数据接口
 */
export interface PaperStats {
  total: number;
  by_status: {
    pending: number;
    analyzed: number;
  };
}

/**
 * 期刊论文统计接口（从期刊详情返回）
 */
export interface JournalPaperStats {
  total_papers: number;
  pending_papers: number;
  analyzed_papers: number;
}

interface PaperStatsCardsProps {
  stats?: PaperStats | JournalPaperStats | null | undefined;
  loading?: boolean;
}

/**
 * 论文统计卡片组件
 * 统一显示论文统计信息
 */
const PaperStatsCards: React.FC<PaperStatsCardsProps> = ({ stats, loading = false }) => {
  if (!stats) return null;

  // 兼容两种数据格式
  const total = 'total' in stats ? stats.total : stats.total_papers;
  const pending = 'by_status' in stats ? stats.by_status.pending : stats.pending_papers;
  const analyzed = 'by_status' in stats ? stats.by_status.analyzed : stats.analyzed_papers;

  const statisticStyle = {
    fontSize: 14,  // 从20改为14，符合统一规范
    fontWeight: 600 as const,
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 8,
      marginBottom: 12,
    }}>
      <Card loading={loading} className="statistics-card hover-shadow">
        <Statistic
          title={<span style={{ fontSize: 10 }}>总论文数</span>}
          value={total}
          valueStyle={statisticStyle}
        />
      </Card>
      <Card loading={loading} className="statistics-card hover-shadow">
        <Statistic
          title={<span style={{ fontSize: 10 }}>待分析</span>}
          value={pending}
          valueStyle={{ ...statisticStyle, color: '#999' }}
        />
      </Card>
      <Card loading={loading} className="statistics-card hover-shadow">
        <Statistic
          title={<span style={{ fontSize: 10 }}>已分析</span>}
          value={analyzed}
          valueStyle={{ ...statisticStyle, color: '#333' }}
        />
      </Card>
    </div>
  );
};

export default PaperStatsCards;
