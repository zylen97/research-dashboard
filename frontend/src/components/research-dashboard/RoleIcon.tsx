/**
 * 身份图标组件
 * 图标+文字+Tooltip的组合展示
 */
import React from 'react';
import { Space, Tooltip } from 'antd';
import { ROLE_ICON_MAP } from '../../config/roleIcons';
import { ROLE_VISUAL_SYSTEM, AuthorRole } from '../../config/roleStyles';

interface RoleIconProps {
  role: AuthorRole;
  showLabel?: boolean;
  showIcon?: boolean;
}

export const RoleIcon: React.FC<RoleIconProps> = ({
  role,
  showLabel = true,
  showIcon = true
}) => {
  const Icon = ROLE_ICON_MAP[role];
  const config = ROLE_VISUAL_SYSTEM[role];

  return (
    <Tooltip title={config.label}>
      <Space size={4}>
        {showIcon && (
          <Icon
            style={{
              fontSize: '16px',
              color: config.color,
            }}
          />
        )}
        {showLabel && <span>{config.label}</span>}
      </Space>
    </Tooltip>
  );
};
