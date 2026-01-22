import React, { useState, useEffect, useMemo } from 'react';
import { Input, Select, Space, Typography, Modal, message } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import type { Journal, Tag as JournalTag, QueryType, QueryTemplate } from '../types/journals';
import QueryPreview from './QueryPreview';
import TemplateBar from './TemplateBar';
import JournalSelector from './JournalSelector';
import { GRAYSCALE_SYSTEM } from '../config/colors';

const { Text } = Typography;
const { Search } = Input;

interface QueryGeneratorPanelProps {
  journals: Journal[];
  tags: JournalTag[];
}

// 判断期刊名称是否包含中文
const isChineseJournal = (name: string): boolean => {
  return /[\u4e00-\u9fff]/.test(name);
};

const QueryGeneratorPanel: React.FC<QueryGeneratorPanelProps> = ({ journals, tags }) => {
  // 标签筛选（用于筛选期刊列表显示）
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);

  // 搜索文本
  const [searchText, setSearchText] = useState('');

  // 已选择的期刊ID列表
  const [selectedJournalIds, setSelectedJournalIds] = useState<number[]>([]);

  // 检索式类型
  const [queryType, setQueryType] = useState<QueryType>('WoS');

  // 保存的模板列表
  const [savedTemplates, setSavedTemplates] = useState<QueryTemplate[]>([]);

  // 应用模板的ID（null表示未应用模板）
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // 从 localStorage 加载模板
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queryTemplates');
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  // 生成检索式
  const generatedQuery = useMemo(() => {
    const selectedJournals = journals.filter(j => selectedJournalIds.includes(j.id));

    if (selectedJournals.length === 0) {
      return '';
    }

    // 根据检索式类型过滤语言
    const filteredJournals = queryType === 'WoS'
      ? selectedJournals.filter(j => !isChineseJournal(j.name))
      : selectedJournals.filter(j => isChineseJournal(j.name));

    if (filteredJournals.length === 0) {
      return `当前选择的期刊中没有${queryType === 'WoS' ? '英文' : '中文'}期刊`;
    }

    if (queryType === 'WoS') {
      const journalNames = filteredJournals.map(j => `"${j.name}"`).join(' OR ');
      return `SO=(${journalNames})`;
    } else {
      const journalNames = filteredJournals.map(j => `'${j.name}'`).join(' + ');
      return `LY=(${journalNames})`;
    }
  }, [selectedJournalIds, journals, queryType]);

  // 单个期刊选择
  const handleJournalToggle = (journalId: number) => {
    setSelectedJournalIds(prev => {
      if (prev.includes(journalId)) {
        return prev.filter(id => id !== journalId);
      } else {
        return [...prev, journalId];
      }
    });
    // 如果手动修改选择，取消活动模板
    setActiveTemplateId(null);
  };

  // 按标签快速全选
  const handleTagQuickSelect = async (tagId: number) => {
    const tagJournals = journals.filter(j => j.tags.some(t => t.id === tagId));

    // 根据检索式类型过滤语言
    const filteredJournals = queryType === 'WoS'
      ? tagJournals.filter(j => !isChineseJournal(j.name))
      : tagJournals.filter(j => isChineseJournal(j.name));

    const newIds = filteredJournals.map(j => j.id);
    setSelectedJournalIds(prev => Array.from(new Set([...prev, ...newIds])));
    setActiveTemplateId(null);
  };

  // 取消标签选择
  const handleTagDeselect = async (tagId: number) => {
    const tagJournals = journals.filter(j => j.tags.some(t => t.id === tagId));
    const tagJournalIds = tagJournals.map(j => j.id);
    setSelectedJournalIds(prev => prev.filter(id => !tagJournalIds.includes(id)));
    setActiveTemplateId(null);
  };

  // 全选当前筛选结果
  const handleSelectAll = () => {
    // 获取当前筛选和过滤后的期刊
    let filteredJournals = journals;

    // 标签筛选
    if (filterTagIds.length > 0) {
      filteredJournals = filteredJournals.filter(journal =>
        journal.tags.some(tag => filterTagIds.includes(tag.id))
      );
    }

    // 搜索筛选
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filteredJournals = filteredJournals.filter(journal =>
        journal.name.toLowerCase().includes(lowerSearch)
      );
    }

    // 根据检索式类型过滤语言
    filteredJournals = filteredJournals.filter(journal => {
      const isChinese = isChineseJournal(journal.name);
      return queryType === 'WoS' ? !isChinese : isChinese;
    });

    const newIds = filteredJournals.map(j => j.id);
    setSelectedJournalIds(prev => Array.from(new Set([...prev, ...newIds])));
    setActiveTemplateId(null);
  };

  // 清空选择
  const handleClearSelection = () => {
    setSelectedJournalIds([]);
    setActiveTemplateId(null);
  };

  // 切换检索式类型时，过滤掉不匹配的期刊
  const handleQueryTypeChange = (newType: QueryType) => {
    setQueryType(newType);

    // 过滤掉不匹配语言类型的期刊
    setSelectedJournalIds(prev => {
      return prev.filter(id => {
        const journal = journals.find(j => j.id === id);
        if (!journal) return false;
        const isChinese = isChineseJournal(journal.name);
        return newType === 'WoS' ? !isChinese : isChinese;
      });
    });
  };

  // 保存模板
  const handleSaveTemplate = () => {
    if (selectedJournalIds.length === 0) {
      message.warning('请先选择期刊');
      return;
    }

    let name = '';

    Modal.confirm({
      title: '保存为模板',
      content: (
        <div>
          <Input
            placeholder="请输入模板名称"
            onChange={e => { name = e.target.value; }}
            autoFocus
            onPressEnter={() => {
              const modal = document.querySelector('.ant-modal-wrap')?.querySelectorAll('.ant-btn-primary')[1] as HTMLButtonElement;
              modal?.click();
            }}
          />
        </div>
      ),
      onOk: () => {
        if (!name || name.trim() === '') {
          message.warning('请输入模板名称');
          return Promise.reject();
        }

        const newTemplate: QueryTemplate = {
          id: Date.now().toString(),
          name: name.trim(),
          journalIds: [...selectedJournalIds],
          queryType,
          createdAt: new Date().toISOString(),
        };

        const templates = [...savedTemplates, newTemplate];
        setSavedTemplates(templates);

        try {
          localStorage.setItem('queryTemplates', JSON.stringify(templates));
          message.success('模板保存成功');
        } catch (error) {
          message.error('模板保存失败');
        }

        setActiveTemplateId(newTemplate.id);
        return Promise.resolve();
      },
    });
  };

  // 应用模板
  const handleApplyTemplate = (template: QueryTemplate) => {
    setSelectedJournalIds(template.journalIds);
    setQueryType(template.queryType);

    if (activeTemplateId === template.id) {
      // 如果已经是活动模板，则取消应用
      setActiveTemplateId(null);
    } else {
      setActiveTemplateId(template.id);
    }
  };

  // 删除模板
  const handleDeleteTemplate = (templateId: string) => {
    const templates = savedTemplates.filter(t => t.id !== templateId);
    setSavedTemplates(templates);

    try {
      localStorage.setItem('queryTemplates', JSON.stringify(templates));
      message.success('模板已删除');
    } catch (error) {
      message.error('模板删除失败');
    }

    if (activeTemplateId === templateId) {
      setActiveTemplateId(null);
    }
  };

  // 获取筛选后的期刊数量
  const filteredCount = useMemo(() => {
    let filtered = journals;

    if (filterTagIds.length > 0) {
      filtered = filtered.filter(j => j.tags.some(t => filterTagIds.includes(t.id)));
    }

    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(j => j.name.toLowerCase().includes(lowerSearch));
    }

    filtered = filtered.filter(j => {
      const isChinese = isChineseJournal(j.name);
      return queryType === 'WoS' ? !isChinese : isChinese;
    });

    return filtered.length;
  }, [journals, filterTagIds, searchText, queryType]);

  return (
    <div>
      {/* 模板工具栏 */}
      <TemplateBar
        templates={savedTemplates}
        activeTemplateId={activeTemplateId}
        onApply={handleApplyTemplate}
        onDelete={handleDeleteTemplate}
        onNew={handleSaveTemplate}
      />

      {/* 筛选控制区 */}
      <div
        style={{
          marginBottom: 16,
          padding: '12px 16px',
          backgroundColor: GRAYSCALE_SYSTEM.bg_secondary,
          borderRadius: '4px',
          border: `1px solid ${GRAYSCALE_SYSTEM.border_light}`,
        }}
      >
        <Space size="middle" wrap>
          {/* 标签筛选 */}
          <div>
            <Text strong style={{ marginRight: 8, fontSize: 13 }}>
              <FilterOutlined /> 标签筛选：
            </Text>
            <Select
              mode="multiple"
              style={{ width: 200 }}
              placeholder="选择标签筛选"
              allowClear
              value={filterTagIds}
              onChange={setFilterTagIds}
              options={tags.map(tag => ({
                label: tag.name,
                value: tag.id,
              }))}
              size="small"
            />
          </div>

          {/* 期刊搜索 */}
          <div>
            <Search
              placeholder="搜索期刊名称"
              allowClear
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
              size="small"
              prefix={<SearchOutlined />}
            />
          </div>
        </Space>
      </div>

      {/* 期刊选择区 + 检索式预览 */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 左侧：期刊选择 */}
        <div style={{ flex: 1 }}>
          <JournalSelector
            journals={journals}
            tags={tags}
            selectedIds={selectedJournalIds}
            filterTagIds={filterTagIds}
            searchText={searchText}
            queryType={queryType}
            onJournalToggle={handleJournalToggle}
            onTagQuickSelect={handleTagQuickSelect}
            onTagDeselect={handleTagDeselect}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
        </div>

        {/* 右侧：检索式预览 */}
        <div style={{ width: 400 }}>
          <QueryPreview
            query={generatedQuery}
            queryType={queryType}
            selectedCount={selectedJournalIds.length}
            totalCount={filteredCount}
            onCopy={() => {}}
            onSaveTemplate={handleSaveTemplate}
            onQueryTypeChange={handleQueryTypeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default QueryGeneratorPanel;
