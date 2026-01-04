/**
 * 手风琴期刊筛选器
 * 支持标签筛选和期刊选择，混合模式：可从期刊库选择，也可手动输入
 */
import React, { useState } from 'react';
import { Collapse, Select, AutoComplete, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { journalApi, tagApi } from '../services/apiOptimized';
import type { Journal, Tag } from '../types/journals';

interface AccordionJournalFilterProps {
  targetJournal?: string;
  referenceJournal?: string;
  onTargetJournalChange?: (value: string | undefined) => void;
  onReferenceJournalChange?: (value: string | undefined) => void;
}

const AccordionJournalFilter: React.FC<AccordionJournalFilterProps> = ({
  targetJournal,
  referenceJournal,
  onTargetJournalChange,
  onReferenceJournalChange,
}) => {
  // 投稿期刊的标签筛选状态
  const [targetTagIds, setTargetTagIds] = useState<number[]>([]);
  // 参考期刊的标签筛选状态
  const [referenceTagIds, setReferenceTagIds] = useState<number[]>([]);

  // 查询所有标签（共享）
  const { data: tags = [], isLoading: tagsLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 根据标签筛选查询投稿期刊
  const { data: targetJournals = [] } = useQuery<Journal[]>({
    queryKey: ['journals', 'target', targetTagIds],
    queryFn: () => {
      const params: { tag_ids?: string } = {};
      if (targetTagIds.length > 0) {
        params.tag_ids = targetTagIds.join(',');
      }
      return journalApi.getJournals(params);
    },
  });

  // 根据标签筛选查询参考期刊
  const { data: referenceJournals = [] } = useQuery<Journal[]>({
    queryKey: ['journals', 'reference', referenceTagIds],
    queryFn: () => {
      const params: { tag_ids?: string } = {};
      if (referenceTagIds.length > 0) {
        params.tag_ids = referenceTagIds.join(',');
      }
      return journalApi.getJournals(params);
    },
  });

  // 生成AutoComplete的选项（混合模式：期刊库 + 手动输入）
  const getAutoCompleteOptions = (journals: Journal[], inputValue: string) => {
    const options = journals.map((journal) => ({
      label: journal.name,
      value: journal.name,
    }));

    // 如果输入的值不在期刊库中，添加为手动输入选项
    if (inputValue && !journals.find(j => j.name.toLowerCase() === inputValue.toLowerCase())) {
      options.push({
        label: `手动输入: "${inputValue}"`,
        value: inputValue,
      });
    }

    return options;
  };

  // 标签选择器的选项
  const tagOptions = tags.map((tag) => ({
    label: `${tag.name} (${tag.journal_count})`,
    value: tag.id,
  }));

  return (
    <Collapse
      defaultActiveKey={[]}
      ghost
      items={[
        {
          key: 'target',
          label: '投稿期刊筛选',
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {/* 标签筛选器 */}
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="按标签筛选（可选）"
                value={targetTagIds}
                onChange={setTargetTagIds}
                allowClear
                loading={tagsLoading}
                maxTagCount={2}
                options={tagOptions}
                filterOption={(input, option) =>
                  (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                }
              />

              {/* 期刊选择器（混合模式） */}
              <AutoComplete
                style={{ width: '100%' }}
                placeholder="选择或输入期刊名"
                value={targetJournal || null}
                onChange={(val) => onTargetJournalChange?.(val ?? undefined)}
                options={getAutoCompleteOptions(targetJournals, targetJournal || '')}
                allowClear
                filterOption={(input, option) => {
                  const label = option?.label?.toString() || '';
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
              />
            </Space>
          ),
        },
        {
          key: 'reference',
          label: '参考期刊筛选',
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {/* 标签筛选器 */}
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="按标签筛选（可选）"
                value={referenceTagIds}
                onChange={setReferenceTagIds}
                allowClear
                loading={tagsLoading}
                maxTagCount={2}
                options={tagOptions}
                filterOption={(input, option) =>
                  (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                }
              />

              {/* 期刊选择器（混合模式） */}
              <AutoComplete
                style={{ width: '100%' }}
                placeholder="选择或输入期刊名"
                value={referenceJournal || null}
                onChange={(val) => onReferenceJournalChange?.(val ?? undefined)}
                options={getAutoCompleteOptions(referenceJournals, referenceJournal || '')}
                allowClear
                filterOption={(input, option) => {
                  const label = option?.label?.toString() || '';
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
              />
            </Space>
          ),
        },
      ]}
    />
  );
};

export default AccordionJournalFilter;
