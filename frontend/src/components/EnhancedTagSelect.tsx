/**
 * 增强型标签选择器
 * 支持从已有标签中选择（多选），也支持输入新标签名自动创建
 */
import React, { useState, useRef } from 'react';
import { Select, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagApi } from '../services/apiOptimized';
import { Tag } from '../types/journals';

interface EnhancedTagSelectProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const EnhancedTagSelect: React.FC<EnhancedTagSelectProps> = ({
  value = [],
  onChange,
  placeholder = '选择或创建标签',
  allowClear = true,
  disabled = false,
  style,
}) => {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState('');
  const isCreatingRef = useRef(false);

  // 查询所有标签
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 创建新标签
  const createMutation = useMutation({
    mutationFn: (name: string) => tagApi.create({ name }),
    onSuccess: (newTag) => {
      // 刷新标签列表
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      // 多选模式：追加到已选列表
      onChange?.([...value, newTag.id]);
      setSearchValue('');
      isCreatingRef.current = false;
    },
    onError: (error: any) => {
      // 判断是否是重复标签名错误
      if (error?.response?.status === 400 || error?.response?.status === 409) {
        message.error('标签已存在');
      } else {
        message.error('创建标签失败');
      }
      isCreatingRef.current = false;
    },
  });

  // 处理搜索值变化
  const handleSearch = (val: string) => {
    setSearchValue(val);
  };

  // 处理选择变化
  const handleChange = (val: number[]) => {
    onChange?.(val);
  };

  // 处理失焦事件 - 只清空搜索值，不自动创建
  const handleBlur = () => {
    setSearchValue('');
  };

  // 处理键盘事件 - 按Enter时创建新标签
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchValue.trim() && !isCreatingRef.current) {
      const existingTag = tags.find(t => t.name.toLowerCase() === searchValue.trim().toLowerCase());
      if (!existingTag) {
        // 新标签，触发创建
        isCreatingRef.current = true;
        createMutation.mutate(searchValue.trim());
      } else {
        // 标签已存在，自动选中
        if (!value.includes(existingTag.id)) {
          onChange?.([...value, existingTag.id]);
        }
        setSearchValue('');
      }
    }
  };

  // 生成选项列表
  const options = tags.map((tag) => ({
    label: tag.name,
    value: tag.id,
  }));

  return (
    <Select
      mode="multiple"
      showSearch
      style={style || { width: '100%' }}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      allowClear={allowClear}
      loading={isLoading || createMutation.isPending}
      disabled={disabled}
      filterOption={(input, option) =>
        (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
      }
      options={options}
      notFoundContent={searchValue.trim() ? `按Enter创建 "${searchValue.trim()}"` : '暂无标签'}
    />
  );
};

export default EnhancedTagSelect;
