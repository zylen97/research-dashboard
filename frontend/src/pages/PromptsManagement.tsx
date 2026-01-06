/**
 * Prompts管理页面（v4.8）
 * 提示词管理面板 - 快速复用为主
 * 左侧：5个模块导航 + 收藏 + 统计
 * 右侧：提示词卡片列表
 */
import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Space,
  Tag,
  message,
  Menu,
  Divider,
  Empty,
  Spin,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  StarFilled,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { promptsApi } from '../services/apiOptimized';
import {
  Prompt,
  PromptCategory,
  PROMPT_CATEGORY_LABELS,
} from '../types/prompts';
import PromptCard from '../components/PromptCard';
import PromptFormModal from '../components/PromptFormModal';
import PromptCopyModal from '../components/PromptCopyModal';

const { Search } = Input;

// 分类菜单项
const CATEGORY_MENU_ITEMS = [
  { key: 'all', label: '全部提示词', icon: <FileTextOutlined /> },
  { key: 'reading', label: '文章精读和迁移' },
  { key: 'writing', label: '论文写作' },
  { key: 'polishing', label: '论文润色' },
  { key: 'reviewer', label: '审稿人' },
  { key: 'horizontal', label: '横向课题' },
];

// 特殊菜单项
const SPECIAL_MENU_ITEMS = [
  { key: 'favorite', label: '我的收藏', icon: <StarFilled /> },
  { key: 'stats', label: '使用统计', icon: <EyeOutlined /> },
];

const PromptsManagement: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [copyingPromptId, setCopyingPromptId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // 获取提示词列表
  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ['prompts', selectedCategory, searchText],
    queryFn: () => {
      const params: { category?: string; search?: string; is_favorite?: boolean; is_active?: boolean } = {
        is_active: true,
      };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (searchText) {
        params.search = searchText;
      }
      return promptsApi.getAll(params);
    },
  });

  // 获取统计信息
  const { data: stats } = useQuery({
    queryKey: ['prompts-stats'],
    queryFn: () => promptsApi.getStats(),
  });

  // 删除提示词
  const deleteMutation = useMutation({
    mutationFn: (id: number) => promptsApi.delete(id),
    onSuccess: () => {
      message.success('提示词删除成功');
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  // 切换收藏
  const toggleFavoriteMutation = useMutation({
    mutationFn: (id: number) => promptsApi.toggleFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });

  // 打开新增模态框
  const openCreateModal = () => {
    setEditingPrompt(null);
    setFormModalVisible(true);
  };

  // 打开编辑模态框
  const openEditModal = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormModalVisible(true);
  };

  // 打开复制模态框
  const openCopyModal = (promptId: number) => {
    setCopyingPromptId(promptId);
    setCopyModalVisible(true);
  };

  // 渲染左侧菜单
  const renderSideMenu = () => (
    <div style={{ borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
      {/* 分类菜单 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#666' }}>
          分类导航
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedCategory]}
          onClick={({ key }) => setSelectedCategory(key)}
          style={{ border: 'none' }}
          items={CATEGORY_MENU_ITEMS}
        />
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* 特殊菜单项 */}
      <div>
        <Menu
          mode="inline"
          selectedKeys={selectedCategory === 'favorite' ? ['favorite'] : selectedCategory === 'stats' ? ['stats'] : []}
          onClick={({ key }) => setSelectedCategory(key)}
          style={{ border: 'none' }}
          items={SPECIAL_MENU_ITEMS}
        />
      </div>

      {/* 分类统计 */}
      {stats && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <div>
            <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#666' }}>
              分类统计
            </div>
            {Object.entries(stats.by_category).map(([cat, count]) => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <Tag style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory(cat)}>
                  {PROMPT_CATEGORY_LABELS[cat as PromptCategory]}: {count}
                </Tag>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // 渲染统计面板
  const renderStatsPanel = () => {
    if (!stats) return null;

    return (
      <div style={{ padding: 24 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总提示词"
                value={stats.total_count}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="总使用次数"
                value={stats.top_prompts.reduce((sum, p) => sum + p.usage_count, 0)}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="最常用提示词"
                value={stats.top_prompts[0]?.usage_count || 0}
                prefix={<StarFilled />}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Card title="最常用的提示词" size="small">
          {stats.top_prompts.map((prompt, index) => (
            <div key={prompt.id} style={{ marginBottom: 8 }}>
              <Tag color={index < 3 ? 'gold' : 'default'}>
                #{index + 1}
              </Tag>
              <span style={{ marginLeft: 8 }}>{prompt.title}</span>
              <Tag style={{ marginLeft: 8 }}>{PROMPT_CATEGORY_LABELS[prompt.category as PromptCategory]}</Tag>
              <Tag style={{ marginLeft: 8 }}>{prompt.usage_count} 次使用</Tag>
            </div>
          ))}
        </Card>
      </div>
    );
  };

  // 渲染提示词卡片列表
  const renderPromptList = () => {
    // 过滤提示词
    let filteredPrompts = prompts;

    // 收藏过滤
    if (selectedCategory === 'favorite') {
      filteredPrompts = prompts.filter((p) => p.is_favorite);
    }

    if (filteredPrompts.length === 0 && !isLoading) {
      return (
        <Empty
          description={
            selectedCategory === 'favorite'
              ? '还没有收藏的提示词'
              : searchText
              ? '没有找到匹配的提示词'
              : '还没有提示词，点击右上角创建'
          }
        />
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {filteredPrompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onCopy={openCopyModal}
            onEdit={openEditModal}
            onDelete={(id) => deleteMutation.mutate(id)}
            onToggleFavorite={(id) => toggleFavoriteMutation.mutate(id)}
          />
        ))}
      </Space>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Prompts 管理</h2>
          <div style={{ color: '#999', marginTop: 4 }}>科研提示词库 - 快速复用</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新增提示词
        </Button>
      </div>

      {/* 主体布局 */}
      <div style={{ display: 'flex' }}>
        {/* 左侧菜单 */}
        <div style={{ width: 200, flexShrink: 0 }}>{renderSideMenu()}</div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, paddingLeft: 24 }}>
          {/* 搜索栏 */}
          {selectedCategory !== 'stats' && (
            <div style={{ marginBottom: 16 }}>
              <Search
                placeholder="搜索提示词标题或内容..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
          )}

          {/* 内容区域 */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          ) : selectedCategory === 'stats' ? (
            renderStatsPanel()
          ) : (
            renderPromptList()
          )}
        </div>
      </div>

      {/* 表单模态框 */}
      {formModalVisible && (
        <PromptFormModal
          visible={formModalVisible}
          prompt={editingPrompt}
          onCancel={() => setFormModalVisible(false)}
          onSuccess={() => {
            setFormModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['prompts'] });
          }}
        />
      )}

      {/* 复制模态框 */}
      {copyModalVisible && copyingPromptId && (
        <PromptCopyModal
          visible={copyModalVisible}
          promptId={copyingPromptId}
          onCancel={() => setCopyModalVisible(false)}
        />
      )}
    </div>
  );
};

export default PromptsManagement;
