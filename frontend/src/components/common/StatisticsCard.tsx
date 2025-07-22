import React from 'react';
import { Card, Statistic } from 'antd';

interface StatisticsCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  color?: string;
  className?: string;
  suffix?: string;
  precision?: number;
  loading?: boolean;
}

export const StatisticsCard: React.FC<StatisticsCardProps> = ({
  title,
  value,
  icon,
  color,
  className = '',
  suffix,
  precision = 0,
  loading = false,
}) => {
  return (
    <Card className={`statistics-card hover-shadow ${className}`} loading={loading}>
      <Statistic
        title={title}
        value={value}
        valueStyle={{ color }}
        prefix={icon}
        suffix={suffix}
        precision={precision}
      />
    </Card>
  );
};