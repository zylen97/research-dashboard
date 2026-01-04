/**
 * 紧凑型期刊筛选器
 * 标签筛选通过Popover展开，期刊选择直接显示
 */
import React, { useState } from 'react';
import { AutoComplete, Button, Popover, Select, Space, Badge } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { journalApi, tagApi } from '../services/apiOptimized';
import type { Journal, Tag } from '../types/journals';

interface CompactJournalFilterProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

const CompactJournalFilter: React.FC<CompactJournalFilterProps> = ({
  value,
  onChange,
  placeholder = '选择或输入期刊',
  disabled = false,
}) => {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [popoverVisible, setPopoverVisible] = useState(false);

  // 查询所有标签
  const { data: tags = [], isLoading: tagsLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => tagApi.getTags(),
  });

  // 根据标签筛选查询期刊
  const { data: journals = [] } = useQuery<Journal[]>({
    queryKey: ['journals', 'compact', selectedTagIds],
    queryFn: () => {
      const params: { tag_ids?: string } = {};
      if (selectedTagIds.length > 0) {
        params.tag_ids = selectedTagIds.join(',');
      }
      return journalApi.getJournals(params);
    },
  });

  // 生成AutoComplete选项（混合模式：期刊库 + 手动输入）
  const getJournalOptions = () => {
    const options = journals.map((journal) => ({
      label: journal.name,
      value: journal.name,
    }));

    // 如果有输入值且不在期刊库中，添加手动输入选项
    if (value && !journals.find(j => j.name.toLowerCase() === value.toLowerCase())) {
      options.push({
        label: `手动输入: "${value}"`,
        value: value,
      });
    }

    return options;
  };

  // 清空标签筛选
  const handleClearTags = () => {
    setSelectedTagIds([]);
  };

  // 确认标签筛选
  const handleConfirmTags = () => {
    setPopoverVisible(false);
  };

  // 标签筛选Popover内容
  const tagFilterContent = (
    <div style={{ minWidth: 220 }}>
      <Select
        mode="multiple"
        placeholder="选择标签筛选"
        value={selectedTagIds}
        onChange={setSelectedTagIds}
        loading={tagsLoading}
        allowClear
        options={tags.map((tag) => ({
          label: `${tag.name} (${tag.journal_count})`,
          value: tag.id,
        }))}
        style={{ width: '100%', marginBottom: 12 }}
        maxTagCount={3}
      />
      <Space>
        <Button size="small" onClick={handleClearTags}>
          清空
        </Button>
        <Button size="small" type="primary" onClick={handleConfirmTags}>
          确定
        </Button>
      </Space>
    </div>
  );

  return (
    <Space.Compact style={{ width: '100%' }}>
      {/* 标签筛选按钮 */}
      <Popover
        placement="bottomLeft"
        title="按标签筛选期刊"
        trigger="click"
        open={popoverVisible}
        onOpenChange={setPopoverVisible}
        content={tagFilterContent}
      >
        <Badge count={selectedTagIds.length} size="small" offset={[-5, 5]}>
          <Button
            icon={<TagOutlined />}
            type={selectedTagIds.length > 0 ? "primary" : "default"}
            disabled={disabled}
            style={{ minWidth: 36 }}
          />
        </Badge>
      </Popover>

      {/* 期刊选择/输入 */}
      <AutoComplete
        style={{ flex: 1 }}
        placeholder={placeholder}
        value={value || null}
        onChange={(val) => onChange?.(val ?? undefined)}
        options={getJournalOptions()}
        allowClear
        disabled={disabled}
        filterOption={(input, option) => {
          const label = option?.label?.toString() || '';
          return label.toLowerCase().includes(input.toLowerCase());
        }}
      />
    </Space.Compact>
  );
};

export default CompactJournalFilter;
