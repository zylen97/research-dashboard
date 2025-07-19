import React from 'react';
import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';

interface ThemeToggleProps {
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  style, 
  size = 'middle' 
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip title={theme === 'light' ? '切换到暗黑模式' : '切换到亮色模式'}>
      <Button
        type="text"
        size={size}
        icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
        onClick={toggleTheme}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          ...style,
        }}
      />
    </Tooltip>
  );
};

export default ThemeToggle;