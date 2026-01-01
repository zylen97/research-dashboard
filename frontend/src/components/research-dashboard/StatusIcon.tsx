/**
 * 状态图标组件
 * 图标+文字+Tooltip的组合展示
 */
import React from 'react';
import { Space, Tooltip } from 'antd';
import { STATUS_ICON_MAP } from '../../config/statusIcons';
import { STATUS_VISUAL_SYSTEM, ProjectStatus } from '../../config/statusStyles';

interface StatusIconProps {
  status: ProjectStatus;
  showLabel?: boolean;  // 是否显示文字标签
}

export const StatusIcon: React.FC<StatusIconProps> = ({
  status,
  showLabel = true
}) => {
  const Icon = STATUS_ICON_MAP[status];
  const config = STATUS_VISUAL_SYSTEM[status];

  const iconElement = (
    <Icon
      style={{
        fontSize: '16px',
        color: config.borderColor,  // 使用原配色方案
      }}
    />
  );

  return (
    <Tooltip title={config.label}>
      <Space size={4}>
        {iconElement}
        {showLabel && <span>{config.label}</span>}
      </Space>
    </Tooltip>
  );
};
