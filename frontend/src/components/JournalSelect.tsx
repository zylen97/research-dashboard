/**
 * 期刊选择器组件（v4.8）
 * 支持通过标签筛选期刊，支持输入新期刊名自动创建
 */
import React, { useState, useRef } from 'react';
import { Select, Space, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi, tagApi } from '../services/apiOptimized';
import type { Journal, Tag } from '../types/journals';

interface JournalSelectProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

const JournalSelect: React.FC<JournalSelectProps> = ({
  value,
  onChange,
  placeholder = '从期刊库选择',
  allowClear = true,
  disabled = false,
}) => {
  const queryClient = useQueryClient();
  // 标签筛选状态
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  // 搜索和创建状态
  const [searchValue, setSearchValue] = useState('');
  const isCreatingRef = useRef(false);

  // 查询所有标签
  const { data: tags = [], isLoading: tagsLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 根据标签筛选查询期刊
  const { data: journals = [], isLoading: journalsLoading } = useQuery<Journal[]>({
    queryKey: ['journals', selectedTagIds],
    queryFn: () => {
      const params: { tag_ids?: string } = {};
      if (selectedTagIds.length > 0) {
        params.tag_ids = selectedTagIds.join(',');
      }
      return journalApi.getJournals(params);
    },
  });

  // 创建新期刊
  const createMutation = useMutation({
    mutationFn: (name: string) => journalApi.create({
      name: name.trim(),
      tag_ids: selectedTagIds,  // 继承当前筛选的标签
      notes: null,
    }),
    onSuccess: (newJournal) => {
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      onChange?.(newJournal.name);
      setSearchValue('');
      isCreatingRef.current = false;
      message.success('期刊创建成功');
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        message.error('期刊已存在');
      } else {
        message.error('创建期刊失败');
      }
      isCreatingRef.current = false;
    },
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {/* 标签筛选器 */}
      <Select
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="筛选标签（可选）"
        value={selectedTagIds}
        onChange={setSelectedTagIds}
        allowClear
        loading={tagsLoading}
        maxTagCount={3}
        options={tags.map((tag) => ({
          label: `${tag.name} (${tag.journal_count})`,
          value: tag.id,
        }))}
        filterOption={(input, option) =>
          (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
        }
      />

      {/* 期刊选择器 */}
      <Select
        showSearch
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={value || null}
        onChange={(val) => {
          if (!val) {
            onChange?.(undefined);
            return;
          }
          const existing = journals.find((j: Journal) => j.name === val);
          if (existing) {
            onChange?.(val);
          } else if (!isCreatingRef.current) {
            isCreatingRef.current = true;
            createMutation.mutate(val);
          }
        }}
        onSearch={setSearchValue}
        onBlur={() => setSearchValue('')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && searchValue.trim() && !journals.find((j: Journal) => j.name === searchValue.trim()) && !isCreatingRef.current) {
            isCreatingRef.current = true;
            createMutation.mutate(searchValue.trim());
          }
        }}
        allowClear={allowClear}
        loading={journalsLoading || createMutation.isPending}
        disabled={disabled}
        filterOption={false}
        options={(() => {
          const opts = journals.map((journal: Journal) => ({
            label: journal.name,
            value: journal.name,
          }));
          if (searchValue.trim() && !journals.find((j: Journal) => j.name === searchValue.trim())) {
            opts.push({
              label: `创建 "${searchValue.trim()}"`,
              value: searchValue.trim(),
            });
          }
          return opts;
        })()}
        notFoundContent={searchValue.trim() ? `按Enter创建 "${searchValue.trim()}"` : '无匹配期刊'}
      />
    </Space>
  );
};

export default JournalSelect;
