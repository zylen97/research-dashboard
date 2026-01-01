/**
 * 列筛选器组件
 * 允许用户选择显示/隐藏表格列
 */

import React from 'react';
import { Dropdown, Button, Checkbox, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ColumnConfig } from './tableColumnsConfig';

interface ColumnFilterProps {
  availableColumns: ColumnConfig[];
  visibleColumns: string[];
  onChange: (keys: string[]) => void;
  storageKey?: string;  // 预留参数，当前未使用
}

/**
 * 列筛选器组件
 */
const ColumnFilter: React.FC<ColumnFilterProps> = ({
  availableColumns,
  visibleColumns,
  onChange,
  storageKey: _storageKey,
}) => {
  // 过滤出可选列（排除 core 列，因为它们始终显示）
  const optionalColumns = availableColumns.filter(col => col.category === 'optional');

  const handleChange = (columnKey: string, checked: boolean) => {
    let newVisibleColumns: string[];
    if (checked) {
      newVisibleColumns = [...visibleColumns, columnKey];
    } else {
      newVisibleColumns = visibleColumns.filter(key => key !== columnKey);
    }
    onChange(newVisibleColumns);
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div style={{ padding: '4px 0', fontWeight: 'bold' }}>
          显示列
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    ...optionalColumns.map(col => ({
      key: col.key,
      label: (
        <Checkbox
          checked={visibleColumns.includes(col.key)}
          onChange={(e) => handleChange(col.key, e.target.checked)}
        >
          {col.title}
        </Checkbox>
      ),
    })),
    { type: 'divider' },
    {
      key: 'actions',
      label: (
        <Space>
          <Button
            size="small"
            onClick={() => {
              const allOptional = optionalColumns.map(col => col.key);
              onChange([...visibleColumns.filter(v => !optionalColumns.some(o => o.key === v)), ...allOptional]);
            }}
          >
            全选
          </Button>
          <Button
            size="small"
            onClick={() => {
              const onlyCore = visibleColumns.filter(v => !optionalColumns.some(o => o.key === v));
              onChange(onlyCore);
            }}
          >
            清空
          </Button>
        </Space>
      ),
      disabled: true,
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button icon={<SettingOutlined />} size="small">
        列设置
      </Button>
    </Dropdown>
  );
};

/**
 * 使用列筛选器的 Hook
 * 自动处理 localStorage 持久化
 */
export const useColumnVisibility = (
  storageKey: string,
  _includeListOnly: boolean = false
) => {
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>(() => {
    // 从 localStorage 读取初始值
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(`Failed to load column visibility from ${storageKey}:`, e);
    }
    // 默认值：只显示核心列
    return [];
  });

  // 当 visibleColumns 变化时，保存到 localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn(`Failed to save column visibility to ${storageKey}:`, e);
    }
  }, [visibleColumns, storageKey]);

  return { visibleColumns, setVisibleColumns };
};

export default ColumnFilter;
