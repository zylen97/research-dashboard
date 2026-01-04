/**
 * 研究方法选择器组件（v4.7）
 * 支持从已有方法中选择，也支持输入新方法名自动创建
 */
import React, { useState, useRef } from 'react';
import { Select, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ResearchMethod {
  id: number;
  name: string;
  usage_count: number;
  created_at: string;
}

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
    queryFn: async () => {
      const response = await fetch('http://localhost:8000/api/research-methods/');
      if (!response.ok) {
        throw new Error('获取研究方法失败');
      }
      return response.json();
    },
  });

  // 自动创建新研究方法
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('http://localhost:8000/api/research-methods/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error('创建研究方法失败');
      }
      return response.json();
    },
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

  // 处理失焦事件
  const handleBlur = () => {
    // 如果搜索值不为空且不是现有方法，且没有在创建中，则创建新方法
    if (
      searchValue.trim() &&
      !methods.find(m => m.name === searchValue.trim()) &&
      !isCreatingRef.current &&
      searchValue.trim() !== value
    ) {
      isCreatingRef.current = true;
      createMutation.mutate(searchValue.trim());
    }
    setSearchValue('');
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
      allowClear={allowClear}
      loading={isLoading || createMutation.isPending}
      disabled={disabled}
      filterOption={false} // 禁用内置过滤，使用自定义逻辑
      options={options}
      notFoundContent={searchValue.trim() ? `"${searchValue.trim()}" 将作为新方法创建` : '暂无数据'}
    />
  );
};

export default ResearchMethodSelect;
