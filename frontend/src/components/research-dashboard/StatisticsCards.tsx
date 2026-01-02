import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
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
  active: number;
  completed: number;
  paused: number;
  todo: number;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ 
  projects, 
  getProjectTodoStatus 
}) => {
  // 计算统计数据
  const stats: ProjectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    paused: projects.filter(p => p.status === 'paused').length,
    todo: projects.filter(p => getProjectTodoStatus(p).is_todo).length,
  };

  return (
    <Row gutter={8} style={{ marginBottom: 12 }}>
      {/* 总项目数 - 默认样式 */}
      <Col xs={12} sm={8} lg={5}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="总项目数"
            value={stats.total}
            valueStyle={{ fontWeight: 400 }}
          />
        </Card>
      </Col>

      {/* 进行中 - 600字重 + 2px边框 + 符号 */}
      <Col xs={12} sm={8} lg={5}>
        <Card
          className="statistics-card hover-shadow"
          style={{ border: `2px solid ${GRAYSCALE_SYSTEM.secondary}` }}
        >
          <Statistic
            title="进行中"
            value={stats.active}
            valueStyle={{ fontWeight: 600, color: GRAYSCALE_SYSTEM.primary }}
            prefix={<span style={{ fontSize: 14, marginRight: 4 }}>●</span>}
          />
        </Card>
      </Col>

      {/* 已完成 - 400字重 + 浅灰背景 + 符号 */}
      <Col xs={12} sm={8} lg={5}>
        <Card
          className="statistics-card hover-shadow"
          style={{ backgroundColor: GRAYSCALE_SYSTEM.bg_secondary }}
        >
          <Statistic
            title="已完成"
            value={stats.completed}
            valueStyle={{ fontWeight: 400, color: GRAYSCALE_SYSTEM.secondary }}
            prefix={<span style={{ fontSize: 14, marginRight: 4 }}>○</span>}
          />
        </Card>
      </Col>

      {/* 暂停 - 400字重 + 2px虚线边框 + 符号 */}
      <Col xs={12} sm={8} lg={5}>
        <Card
          className="statistics-card hover-shadow"
          style={{ border: `2px dashed ${GRAYSCALE_SYSTEM.tertiary}` }}
        >
          <Statistic
            title="暂停"
            value={stats.paused}
            valueStyle={{ fontWeight: 400, color: GRAYSCALE_SYSTEM.tertiary }}
            prefix={<span style={{ fontSize: 14, marginRight: 4 }}>‖</span>}
          />
        </Card>
      </Col>

      {/* 待办事项 - 700字重 + 2px粗边框 + 旗帜图标 */}
      <Col xs={12} sm={8} lg={4}>
        <Card
          className="statistics-card hover-shadow"
          style={{ border: `2px solid ${GRAYSCALE_SYSTEM.primary}` }}
        >
          <Statistic
            title="待办事项"
            value={stats.todo}
            valueStyle={{ fontWeight: 700, color: GRAYSCALE_SYSTEM.primary }}
            prefix={<FlagOutlined style={{ fontSize: 14, color: GRAYSCALE_SYSTEM.primary }} />}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatisticsCards;