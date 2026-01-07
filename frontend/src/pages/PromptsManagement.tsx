/**
 * Prompts管理页面（v4.9）
 * 提示词管理面板 - 快速复用为主
 * 左侧：5个模块导航
 * 右侧：提示词卡片列表
 */
import React, { useState } from 'react';
import {
  Button,
  Input,
  message,
  Menu,
  Empty,
  Spin,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { promptsApi } from '../services/apiOptimized';
import { Prompt } from '../types/prompts';
import PromptCard from '../components/PromptCard';
import PromptFormModal from '../components/PromptFormModal';
import PromptCopyModal from '../components/PromptCopyModal';

const { Search } = Input;

// 分类菜单项
const CATEGORY_MENU_ITEMS = [
  { key: 'reading', label: '文章精读和迁移' },
  { key: 'writing', label: '论文写作' },
  { key: 'polishing', label: '论文润色' },
  { key: 'reviewer', label: '审稿人' },
  { key: 'horizontal', label: '横向课题' },
];

const PromptsManagement: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('reading');
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
      const params: { category?: string; search?: string; is_active?: boolean } = {
        is_active: true,
        category: selectedCategory,
      };
      if (searchText) {
        params.search = searchText;
      }
      return promptsApi.getAll(params);
    },
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
      <Menu
        mode="inline"
        selectedKeys={[selectedCategory]}
        onClick={({ key }) => setSelectedCategory(key)}
        style={{ border: 'none' }}
        items={CATEGORY_MENU_ITEMS}
      />
    </div>
  );

  // 渲染提示词卡片列表
  const renderPromptList = () => {
    if (prompts.length === 0 && !isLoading) {
      return (
        <Empty
          description={
            searchText
              ? '没有找到匹配的提示词'
              : '还没有提示词，点击上方按钮创建'
          }
        />
      );
    }

    return (
      <Row gutter={[16, 16]} align="stretch">
        {prompts.map((prompt) => (
          <Col key={prompt.id} span={8}>
            <PromptCard
              prompt={prompt}
              onCopy={openCopyModal}
              onEdit={openEditModal}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 主体布局 */}
      <div style={{ display: 'flex' }}>
        {/* 左侧菜单 */}
        <div style={{ width: 200, flexShrink: 0 }}>{renderSideMenu()}</div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, paddingLeft: 24 }}>
          {/* 搜索栏和新增按钮 */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Search
              placeholder="搜索提示词标题或内容..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', maxWidth: 400 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增提示词
            </Button>
          </div>

          {/* 内容区域 */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
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
