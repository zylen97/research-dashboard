/**
 * 论文表格列渲染器
 * 提供可复用的列渲染函数
 */

import { Typography, Tooltip, Tag } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Paper } from '../../types/papers';
import { PAPER_STATUS_CONFIG } from '../../config/paperStatusConfig';

const { Text } = Typography;

// 迁移潜力映射常量
const POTENTIAL_MAP: Record<string, { text: string; color: string }> = {
  high: { text: '高', color: '#52c41a' },
  medium: { text: '中', color: '#faad14' },
  low: { text: '低', color: '#d9d9d9' },
};

// ===== 基础渲染器 =====

/**
 * 渲染作者列
 */
export const renderAuthors = (authors: string | null) => {
  if (!authors) return '-';
  return (
    <Tooltip title={authors}>
      <Text ellipsis style={{ maxWidth: 140 }}>
        {authors}
      </Text>
    </Tooltip>
  );
};

/**
 * 渲染摘要列
 */
export const renderAbstract = (abstract: string | null) => {
  if (!abstract) return '-';
  const preview = abstract.length > 100 ? abstract.slice(0, 100) + '...' : abstract;
  return (
    <Tooltip title={abstract}>
      <Text ellipsis style={{ maxWidth: 280 }}>
        {preview}
      </Text>
    </Tooltip>
  );
};

/**
 * 渲染摘要总结列
 */
export const renderAbstractSummary = (summary: string | null) => {
  if (!summary) return '-';
  return (
    <Tooltip title={summary}>
      <Text
        ellipsis
        style={{ maxWidth: 230 }}
      >
        {summary}
      </Text>
    </Tooltip>
  );
};

/**
 * 解析 AI 分析结果
 */
export const parseAIAnalysis = (paper: Paper) => {
  if (!paper.ai_analysis_result) return null;
  try {
    return JSON.parse(paper.ai_analysis_result);
  } catch {
    return null;
  }
};

/**
 * 渲染 AI 分析列
 * 显示迁移潜力和核心 idea 摘要
 */
export const renderAIAnalysis = (record: Paper) => {
  const analysis = parseAIAnalysis(record);
  if (!analysis) return '-';

  const potential = POTENTIAL_MAP[analysis.migration_potential] || POTENTIAL_MAP['medium'];
  const coreIdea = analysis.core_idea?.slice(0, 50) + (analysis.core_idea?.length > 50 ? '...' : '');

  return (
    <div>
      <Tag color={potential?.color || '#999'}>{potential?.text || '未知'}</Tag>
      <Tooltip title={analysis.core_idea}>
        <Text ellipsis style={{ maxWidth: 120 }}>
          {coreIdea}
        </Text>
      </Tooltip>
    </div>
  );
};

/**
 * 渲染状态列
 */
export const renderStatus = (status: string) => {
  const config = PAPER_STATUS_CONFIG[status] || { text: status, color: '#999' };
  return <span style={{ color: config.color }}>{config.text}</span>;
};

/**
 * 渲染迁移潜力列
 */
export const renderMigrationPotential = (potential: string | null) => {
  if (!potential) return '-';
  const config = POTENTIAL_MAP[potential];
  return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
};

/**
 * 渲染预览链接列
 */
export const renderPreviewLink = (link: string | null) => {
  if (!link) return '-';
  return (
    <a href={link} target="_blank" rel="noopener noreferrer">
      <LinkOutlined />
    </a>
  );
};

/**
 * 渲染年份列
 */
export const renderYear = (year: number | null) => {
  return year ?? '-';
};

// ===== 列定义构建器 =====

/**
 * 可选列的键名类型
 */
export type OptionalColumnKey = 'authors' | 'volume' | 'issue' | 'abstract' | 'abstract_summary' | 'ai_analysis' | 'migration_potential' | 'link';

/**
 * 创建可选列的列定义
 * 返回一个对象，key 为列名，value 为列配置
 */
export const createOptionalColumnDefinitions = (): Record<OptionalColumnKey, Exclude<ColumnsType<Paper>[number], { children?: any }>> => {
  return {
    authors: {
      title: '作者',
      dataIndex: 'authors',
      key: 'authors',
      ellipsis: true,
      render: renderAuthors,
    },
    volume: {
      title: '卷',
      dataIndex: 'volume',
      key: 'volume',
      render: (volume: string | null) => volume || '-',
    },
    issue: {
      title: '期',
      dataIndex: 'issue',
      key: 'issue',
      render: (issue: string | null) => issue || '-',
    },
    abstract: {
      title: '摘要',
      dataIndex: 'abstract',
      key: 'abstract',
      ellipsis: true,
      render: renderAbstract,
    },
    abstract_summary: {
      title: '摘要总结',
      dataIndex: 'abstract_summary',
      key: 'abstract_summary',
      ellipsis: true,
      render: renderAbstractSummary,
    },
    ai_analysis: {
      title: 'AI分析',
      key: 'ai_analysis',
      render: (_: unknown, record: Paper) => renderAIAnalysis(record),
    },
    migration_potential: {
      title: '迁移潜力',
      dataIndex: 'migration_potential',
      key: 'migration_potential',
      render: renderMigrationPotential,
    },
    link: {
      title: '预览',
      dataIndex: 'link',
      key: 'link',
      render: renderPreviewLink,
    },
  };
};
