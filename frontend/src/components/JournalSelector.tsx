import React, { useMemo } from 'react';
import { Card, Checkbox, Button, Space, Typography, Empty, Collapse, Tag } from 'antd';
import { CheckOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Journal, Tag as JournalTag, QueryType } from '../types/journals';
import { GRAYSCALE_SYSTEM } from '../config/colors';

const { Text } = Typography;
const { Panel } = Collapse;

interface JournalSelectorProps {
  journals: Journal[];
  tags: JournalTag[];
  selectedIds: number[];
  filterTagIds: number[];
  searchText: string;
  queryType: QueryType;
  onJournalToggle: (id: number) => void;
  onTagQuickSelect: (tagId: number) => void;
  onTagDeselect: (tagId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

// 判断期刊名称是否包含中文
const isChineseJournal = (name: string): boolean => {
  return /[\u4e00-\u9fff]/.test(name);
};

const JournalSelector: React.FC<JournalSelectorProps> = ({
  journals,
  tags,
  selectedIds,
  filterTagIds,
  searchText,
  queryType,
  onJournalToggle,
  onTagQuickSelect,
  onTagDeselect,
  onSelectAll,
  onClearSelection,
}) => {
  // 根据筛选条件过滤期刊
  const filteredJournals = useMemo(() => {
    let result = journals;

    // 标签筛选
    if (filterTagIds.length > 0) {
      result = result.filter(journal =>
        journal.tags.some(tag => filterTagIds.includes(tag.id))
      );
    }

    // 搜索筛选
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(journal =>
        journal.name.toLowerCase().includes(lowerSearch)
      );
    }

    // 根据检索式类型过滤语言
    result = result.filter(journal => {
      const isChinese = isChineseJournal(journal.name);
      return queryType === 'WoS' ? !isChinese : isChinese;
    });

    return result;
  }, [journals, filterTagIds, searchText, queryType]);

  // 按标签分组期刊
  const groupedJournals = useMemo(() => {
    // 获取所有有期刊的标签
    const tagsWithJournals = tags
      .filter(tag => filteredJournals.some(j => j.tags.some(t => t.id === tag.id)))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    return tagsWithJournals.map(tag => ({
      tag,
      journals: filteredJournals.filter(j => j.tags.some(t => t.id === tag.id)),
    }));
  }, [filteredJournals, tags]);

  // 无标签的期刊
  const journalsWithoutTag = useMemo(() => {
    return filteredJournals.filter(j => j.tags.length === 0);
  }, [filteredJournals]);

  const allSelectedCount = useMemo(() => {
    return filteredJournals.filter(j => selectedIds.includes(j.id)).length;
  }, [filteredJournals, selectedIds]);

  const isAllSelected = allSelectedCount === filteredJournals.length && filteredJournals.length > 0;
  const isIndeterminate = allSelectedCount > 0 && !isAllSelected;

  // 按标签快速选择的处理
  const handleTagCheckboxChange = (tagId: number, checked: boolean) => {
    if (checked) {
      onTagQuickSelect(tagId);
    } else {
      onTagDeselect(tagId);
    }
  };

  // 获取标签中已选择的数量
  const getTagSelectedCount = (tagId: number): number => {
    return filteredJournals.filter(j =>
      j.tags.some(t => t.id === tagId) && selectedIds.includes(j.id)
    ).length;
  };

  // 获取标签下的期刊总数
  const getTagJournalCount = (tagId: number): number => {
    return filteredJournals.filter(j => j.tags.some(t => t.id === tagId)).length;
  };

  // 判断标签是否全选
  const isTagFullySelected = (tagId: number): boolean => {
    const tagJournals = filteredJournals.filter(j => j.tags.some(t => t.id === tagId));
    return tagJournals.length > 0 && tagJournals.every(j => selectedIds.includes(j.id));
  };

  // 判断标签是否部分选中
  const isTagPartiallySelected = (tagId: number): boolean => {
    const selectedCount = getTagSelectedCount(tagId);
    const totalCount = getTagJournalCount(tagId);
    return selectedCount > 0 && selectedCount < totalCount;
  };

  if (filteredJournals.length === 0) {
    return (
      <Card size="small">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#999' }}>
              {queryType === 'WoS' ? '没有找到英文期刊' : '没有找到中文期刊'}
            </span>
          }
        />
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={
        <Space>
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            onChange={e => {
              if (e.target.checked) {
                onSelectAll();
              } else {
                onClearSelection();
              }
            }}
          >
            全选
          </Checkbox>
          <Text type="secondary" style={{ fontSize: 12 }}>
            已选 {allSelectedCount} / 共 {filteredJournals.length} 个
          </Text>
        </Space>
      }
      extra={
        <Button
          size="small"
          type="text"
          icon={<DeleteOutlined />}
          onClick={onClearSelection}
          disabled={selectedIds.length === 0}
        >
          清空选择
        </Button>
      }
    >
      <Collapse
        defaultActiveKey={groupedJournals.map(g => g.tag.id.toString())}
        ghost
        size="small"
      >
        {groupedJournals.map(({ tag, journals: tagJournals }) => {
          const tagSelectedCount = getTagSelectedCount(tag.id);
          const tagTotalCount = tagJournals.length;
          const isFullySelected = isTagFullySelected(tag.id);
          const isPartiallySelected = isTagPartiallySelected(tag.id);

          return (
            <Panel
              key={tag.id}
              header={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
                  <Space>
                    <Checkbox
                      checked={isFullySelected}
                      indeterminate={isPartiallySelected}
                      onChange={e => handleTagCheckboxChange(tag.id, e.target.checked)}
                    >
                      <Tag color="blue" style={{ margin: 0 }}>
                        {tag.name}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ({tagSelectedCount}/{tagTotalCount})
                      </Text>
                    </Checkbox>
                  </Space>
                  <Button
                    size="small"
                    type="text"
                    icon={isFullySelected ? <DeleteOutlined /> : <PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagCheckboxChange(tag.id, !isFullySelected);
                    }}
                  >
                    {isFullySelected ? '取消' : '全选'}
                  </Button>
                </div>
              }
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {tagJournals.map(journal => {
                  const isSelected = selectedIds.includes(journal.id);
                  return (
                    <div
                      key={journal.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? GRAYSCALE_SYSTEM.bg_tertiary : 'transparent',
                        border: isSelected ? `1px solid ${GRAYSCALE_SYSTEM.border_strong}` : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => onJournalToggle(journal.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected ? GRAYSCALE_SYSTEM.bg_tertiary : GRAYSCALE_SYSTEM.bg_secondary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected ? GRAYSCALE_SYSTEM.bg_tertiary : 'transparent';
                      }}
                    >
                      <Space>
                        <Checkbox checked={isSelected} onChange={() => onJournalToggle(journal.id)}>
                          <Text style={{ fontSize: 13 }}>
                            {journal.name}
                          </Text>
                        </Checkbox>
                        {isSelected && <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
                      </Space>
                    </div>
                  );
                })}
              </Space>
            </Panel>
          );
        })}

        {/* 无标签的期刊 */}
        {journalsWithoutTag.length > 0 && (
          <Panel
            key="no-tag"
            header={
              <Space>
                <Tag style={{ margin: 0 }}>未分类</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({journalsWithoutTag.filter(j => selectedIds.includes(j.id)).length}/{journalsWithoutTag.length})
                </Text>
              </Space>
            }
          >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {journalsWithoutTag.map(journal => {
                  const isSelected = selectedIds.includes(journal.id);
                  return (
                    <div
                      key={journal.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? GRAYSCALE_SYSTEM.bg_tertiary : 'transparent',
                        border: isSelected ? `1px solid ${GRAYSCALE_SYSTEM.border_strong}` : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => onJournalToggle(journal.id)}
                    >
                      <Checkbox checked={isSelected} onChange={() => onJournalToggle(journal.id)}>
                        <Text style={{ fontSize: 13 }}>{journal.name}</Text>
                      </Checkbox>
                    </div>
                  );
                })}
              </Space>
            </Panel>
          )}
      </Collapse>
    </Card>
  );
};

export default JournalSelector;
