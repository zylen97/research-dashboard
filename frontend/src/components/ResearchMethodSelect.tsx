/**
 * 研究方法选择器组件（v4.7）
 * 支持从已有方法中选择，也支持输入新方法名自动创建
 */
import React, { useState, useRef } from 'react';
import { Select, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { researchMethodApi } from '../services/apiOptimized';
import { ResearchMethod } from '../types/research-methods';

interface ResearchMethodSelectProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

const ResearchMethodSelect: React.FC<ResearchMethodSelectProps> = ({
  value,
  onChange,
  placeholder = '选择或输入研究方法',
  allowClear = true,
  disabled = false,
}) => {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState('');
  const isCreatingRef = useRef(false);

  // 查询所有研究方法
  const { data: methods = [], isLoading } = useQuery<ResearchMethod[]>({
    queryKey: ['research-methods'],
    queryFn: () => researchMethodApi.getMethods(),
  });

  // 自动创建新研究方法
  const createMutation = useMutation({
    mutationFn: (name: string) => researchMethodApi.getOrCreate(name),
    onSuccess: (data) => {
      // 刷新研究方法列表
      queryClient.invalidateQueries({ queryKey: ['research-methods'] });
      // 设置新创建的方法
      onChange?.(data.name);
      isCreatingRef.current = false;
    },
    onError: () => {
      message.error('创建研究方法失败');
      isCreatingRef.current = false;
    },
  });

  // 处理搜索值变化
  const handleSearch = (val: string) => {
    setSearchValue(val);
  };

  // 处理选择变化
  const handleChange = (val: string | null) => {
    if (val === null) {
      onChange?.(undefined);
      return;
    }

    // 检查是否是现有的方法
    const existingMethod = methods.find(m => m.name === val);
    if (existingMethod) {
      onChange?.(val);
    } else if (!isCreatingRef.current) {
      // 新方法，触发创建
      isCreatingRef.current = true;
      createMutation.mutate(val);
    }
  };

  // 处理失焦事件 - 只清空搜索值，不自动创建
  const handleBlur = () => {
    setSearchValue('');
  };

  // 处理键盘事件 - 按Enter时创建新方法
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchValue.trim() && !methods.find(m => m.name === searchValue.trim()) && !isCreatingRef.current) {
      isCreatingRef.current = true;
      createMutation.mutate(searchValue.trim());
    }
  };

  // 生成选项列表
  const options = methods.map((method) => ({
    label: `${method.name} (${method.usage_count})`,
    value: method.name,
  }));

  // 如果搜索值不为空且不是现有方法，添加为临时选项
  if (searchValue.trim() && !methods.find(m => m.name === searchValue.trim())) {
    options.push({
      label: `创建 "${searchValue.trim()}"`,
      value: searchValue.trim(),
    });
  }

  return (
    <Select
      showSearch
      style={{ width: '100%' }}
      placeholder={placeholder}
      value={value || null}
      onChange={handleChange}
      onSearch={handleSearch}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      allowClear={allowClear}
      loading={isLoading || createMutation.isPending}
      disabled={disabled}
      filterOption={false} // 禁用内置过滤，使用自定义逻辑
      options={options}
      notFoundContent={searchValue.trim() ? `按Enter创建 "${searchValue.trim()}"` : '暂无数据'}
    />
  );
};

export default ResearchMethodSelect;
