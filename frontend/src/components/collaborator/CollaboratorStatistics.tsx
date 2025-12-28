import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { UserOutlined, StarOutlined, DeleteOutlined } from '@ant-design/icons';
import { Collaborator } from '../../types';

interface CollaboratorStatisticsProps {
  collaborators: Collaborator[];
}

/**
 * 合作者统计卡片（简化版）
 * 只显示：总数、高级合作者、已删除
 */
const CollaboratorStatistics: React.FC<CollaboratorStatisticsProps> = ({
  collaborators
}) => {
  const totalCount = collaborators.filter(c => !c.is_deleted).length;
  const activeSeniorCount = collaborators.filter(c => !c.is_deleted && c.is_senior).length;
  const deletedCount = collaborators.filter(c => c.is_deleted).length;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} md={8}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="合作者总数"
            value={totalCount}
            prefix={<UserOutlined />}
            valueStyle={{ color: '#1890ff', fontSize: '24px' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="高级合作者"
            value={activeSeniorCount}
            prefix={<StarOutlined />}
            valueStyle={{ color: '#faad14', fontSize: '24px' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card className="statistics-card hover-shadow">
          <Statistic
            title="已删除"
            value={deletedCount}
            prefix={<DeleteOutlined />}
            valueStyle={{ color: '#999', fontSize: '24px' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default CollaboratorStatistics;
