import React from 'react';
import { Card, Statistic } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import { ResearchProject } from '../../types';
import { GRAYSCALE_SYSTEM } from '../../config/colors';

interface StatisticsCardsProps {
  projects: ResearchProject[];
  getProjectTodoStatus: (project: ResearchProject) => { 
    is_todo: boolean; 
    marked_at: string | null;
    priority: number | null;
    notes: string | null;
  };
}

interface ProjectStats {
  total: number;
  writing: number;
  submitting: number;
  published: number;
  todo: number;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({
  projects,
  getProjectTodoStatus
}) => {
  // 计算统计数据
  const stats: ProjectStats = {
    total: projects.length,
    writing: projects.filter(p => p.status === 'writing').length,
    submitting: projects.filter(p => p.status === 'submitting').length,
    published: projects.filter(p => p.status === 'published').length,
    todo: projects.filter(p => getProjectTodoStatus(p).is_todo).length,
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 8,
      marginBottom: 12
    }}>
      {/* 总项目数 - 默认样式 */}
      <Card className="statistics-card hover-shadow">
        <Statistic
          title="总项目数"
          value={stats.total}
          valueStyle={{ fontWeight: 400, fontSize: 20 }}
        />
      </Card>

      {/* 进行中 - 600字重 + 2px边框 + 符号 */}
      <Card
        className="statistics-card hover-shadow"
        style={{ border: `2px solid ${GRAYSCALE_SYSTEM.secondary}` }}
      >
        <Statistic
          title="撰写中"
          value={stats.writing}
          valueStyle={{ fontWeight: 600, color: GRAYSCALE_SYSTEM.primary, fontSize: 20 }}
          prefix={<span style={{ fontSize: 16, marginRight: 4 }}>●</span>}
        />
      </Card>

      {/* 投稿中 - 600字重 + 2px边框 + 符号 */}
      <Card
        className="statistics-card hover-shadow"
        style={{ border: `2px solid ${GRAYSCALE_SYSTEM.primary}` }}
      >
        <Statistic
          title="投稿中"
          value={stats.submitting}
          valueStyle={{ fontWeight: 600, color: GRAYSCALE_SYSTEM.primary, fontSize: 20 }}
          prefix={<span style={{ fontSize: 16, marginRight: 4 }}>◆</span>}
        />
      </Card>

      {/* 已发表 - 400字重 + 浅灰背景 + 符号 */}
      <Card
        className="statistics-card hover-shadow"
        style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary }}
      >
        <Statistic
          title="已发表"
          value={stats.published}
          valueStyle={{ fontWeight: 400, color: GRAYSCALE_SYSTEM.secondary, fontSize: 20 }}
          prefix={<span style={{ fontSize: 16, marginRight: 4 }}>○</span>}
        />
      </Card>

      {/* 待办事项 - 700字重 + 2px粗边框 + 旗帜图标 */}
      <Card
        className="statistics-card hover-shadow"
        style={{ border: `2px solid ${GRAYSCALE_SYSTEM.primary}` }}
      >
        <Statistic
          title="待办事项"
          value={stats.todo}
          valueStyle={{ fontWeight: 700, color: GRAYSCALE_SYSTEM.primary, fontSize: 20 }}
          prefix={<FlagOutlined style={{ fontSize: 16, color: GRAYSCALE_SYSTEM.primary }} />}
        />
      </Card>
    </div>
  );
};

export default StatisticsCards;