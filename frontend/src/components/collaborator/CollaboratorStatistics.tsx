import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { Collaborator } from '../../types';

interface CollaboratorStatisticsProps {
  collaborators: Collaborator[];
  localGroupMarks: Record<number, boolean>;
}

const CollaboratorStatistics: React.FC<CollaboratorStatisticsProps> = ({ 
  collaborators, 
  localGroupMarks 
}) => {
  const activeSeniorCount = collaborators.filter(c => !c.is_deleted && c.is_senior).length;
  const groupCount = collaborators.filter(c => !c.is_deleted && localGroupMarks[c.id!]).length;
  const maleCount = collaborators.filter(c => !c.is_deleted && c.gender === '男').length;
  const femaleCount = collaborators.filter(c => !c.is_deleted && c.gender === '女').length;
  const deletedCount = collaborators.filter(c => c.is_deleted).length;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="高级合作者"
            value={activeSeniorCount}
            valueStyle={{ color: '#faad14', fontSize: '24px' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="小组成员"
            value={groupCount}
            prefix={<TeamOutlined />}
            valueStyle={{ color: '#1890ff', fontSize: '24px' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="男性"
            value={maleCount}
            prefix={<UserOutlined />}
            valueStyle={{ color: '#52c41a', fontSize: '24px' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="女性"
            value={femaleCount}
            prefix={<UserOutlined />}
            valueStyle={{ color: '#ff4d4f', fontSize: '24px' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="已删除"
            value={deletedCount}
            valueStyle={{ color: '#999', fontSize: '24px' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default CollaboratorStatistics;