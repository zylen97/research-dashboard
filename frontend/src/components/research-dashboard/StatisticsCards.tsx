import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import { ResearchProject } from '../../types';

interface StatisticsCardsProps {
  projects: ResearchProject[];
  getProjectTodoStatus: (project: ResearchProject) => { is_todo: boolean; todo_marked_at: string };
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
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={5}>
        <Card>
          <Statistic title="总项目数" value={stats.total} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={5}>
        <Card>
          <Statistic 
            title="进行中" 
            value={stats.active} 
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={5}>
        <Card>
          <Statistic 
            title="已完成" 
            value={stats.completed} 
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={5}>
        <Card>
          <Statistic 
            title="暂停" 
            value={stats.paused} 
            valueStyle={{ color: '#fa8c16' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic 
            title="待办事项" 
            value={stats.todo} 
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<FlagOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatisticsCards;