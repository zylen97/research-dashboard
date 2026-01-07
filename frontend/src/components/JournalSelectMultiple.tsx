/**
 * 期刊选择器组件（v5.0）
 * 支持手动选择期刊和标签快捷填充
 */
import React from 'react';
import { Select, Space, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { journalApi, tagApi } from '../services/apiOptimized';
import type { Journal, Tag as TagType } from '../types/journals';

const { Option } = Select;

interface JournalSelectMultipleProps {
  value?: string; // 逗号分隔的期刊名
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const JournalSelectMultiple: React.FC<JournalSelectMultipleProps> = ({
  value,
  onChange,
  placeholder = '选择期刊',
  disabled = false,
}) => {
  // 解析已选期刊列表
  const selectedJournals = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  // 查询所有标签
  const { data: tags = [], isLoading: tagsLoading } = useQuery<TagType[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 查询所有期刊
  const { data: allJournals = [], isLoading: allJournalsLoading } = useQuery<Journal[]>({
    queryKey: ['journals', 'all'],
    queryFn: () => journalApi.getJournals({}),
  });

  // 点击标签快捷填充
  const handleTagClick = async (tagId: number) => {
    // 获取该标签的所有期刊
    const tagJournals = allJournals.filter(j =>
      j.tags?.some(t => t.id === tagId)
    );
    if (tagJournals.length > 0) {
      const journalNames = tagJournals.map(j => j.name).sort();
      // 合并到已选期刊（去重）
      const merged = Array.from(new Set([...selectedJournals, ...journalNames]));
      onChange?.(merged.join(', '));
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {/* 标签快捷选择 */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#999', marginRight: 8 }}>快捷填充：</span>
        {!tagsLoading && tags.map((tag) => (
          <Tag
            key={tag.id}
            style={{ cursor: 'pointer' }}
            onClick={() => handleTagClick(tag.id)}
          >
            {tag.name} ({tag.journal_count})
          </Tag>
        ))}
      </div>

      {/* 期刊多选 */}
      <Select
        mode="multiple"
        showSearch
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={selectedJournals}
        onChange={(vals) => onChange?.(vals.join(', '))}
        disabled={disabled}
        loading={allJournalsLoading}
        filterOption={(input, option) =>
          (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
        }
        maxTagCount="responsive"
        allowClear
      >
        {allJournals.map((journal) => (
          <Option key={journal.id} value={journal.name}>
            {journal.name}
          </Option>
        ))}
      </Select>
    </Space>
  );
};

export default JournalSelectMultiple;
