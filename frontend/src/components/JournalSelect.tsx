/**
 * 期刊选择器组件
 * 支持通过标签筛选期刊，可清空选择
 */
import React, { useState } from 'react';
import { Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
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
  // 标签筛选状态
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

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
        onChange={(val) => onChange?.(val ?? undefined)}
        allowClear={allowClear}
        loading={journalsLoading}
        disabled={disabled}
        filterOption={(input, option) => {
          const journalName = option?.label?.toString() || '';
          return journalName.toLowerCase().includes(input.toLowerCase());
        }}
        options={journals.map((journal: Journal) => ({
          label: journal.name,
          value: journal.name,
        }))}
      />
    </Space>
  );
};

export default JournalSelect;
