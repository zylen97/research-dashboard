/**
 * 优化后代码的使用示例
 * 展示如何使用优化后的API服务、错误处理和类型定义
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

// 使用优化后的导入
import { simpleIdeasApi } from '../services/apiOptimized';
import { useTableCRUD } from '../hooks/useTableCRUDOptimized';
import { Idea, IdeaCreate, IdeaUpdate } from '../types/optimized';
import { withErrorHandler } from '../utils/errorHandlerOptimized';

/**
 * 示例1：使用优化后的API和Hook
 */
export const IdeasTableExample: React.FC = () => {
  // 使用优化后的API获取数据
  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['ideas'],
    queryFn: () => simpleIdeasApi.getList({ limit: 100 }),
  });

  // 使用优化后的CRUD Hook
  const { create, update, delete: deleteIdea, isCreating } = useTableCRUD<Idea, IdeaCreate, IdeaUpdate>(
    simpleIdeasApi,
    'ideas',
    {
      createSuccessMessage: 'Idea创建成功！',
      updateSuccessMessage: 'Idea更新成功！',
      deleteSuccessMessage: 'Idea已删除！',
    }
  );

  const handleCreate = () => {
    const newIdea: IdeaCreate = {
      research_question: '如何优化React性能？',
      research_method: '性能分析和基准测试',
      source_journal: 'React官方文档',
      source_literature: 'Web性能优化指南',
      responsible_person: '张三',
      maturity: 'immature',
      description: '研究React应用的性能优化技术',
    };

    create(newIdea);
  };

  const handleUpdate = (idea: Idea) => {
    // 使用Partial类型，只需要传递要更新的字段
    const updates: IdeaUpdate = {
      maturity: idea.maturity === 'mature' ? 'immature' : 'mature',
    };

    update({ id: idea.id, data: updates });
  };

  const columns = [
    {
      title: '研究问题',
      dataIndex: 'research_question',
      key: 'research_question',
    },
    {
      title: '负责人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
    },
    {
      title: '成熟度',
      dataIndex: 'maturity',
      key: 'maturity',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Idea) => (
        <Space>
          <Button size="small" onClick={() => handleUpdate(record)}>
            切换成熟度
          </Button>
          <Button size="small" danger onClick={() => deleteIdea(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleCreate}
        loading={isCreating}
        style={{ marginBottom: 16 }}
      >
        创建新Idea
      </Button>
      <Table
        dataSource={ideas}
        columns={columns}
        loading={isLoading}
        rowKey="id"
      />
    </div>
  );
};

/**
 * 示例2：使用错误处理包装器
 */
export const FileUploadExample: React.FC = () => {
  // 使用withErrorHandler包装异步函数
  const handleFileUpload = withErrorHandler(
    async (file: File) => {
      const result = await simpleIdeasApi.getList(); // 这里应该是上传API
      console.log('上传成功', result);
      return result;
    },
    'upload',
    {
      successMessage: '文件上传成功！',
      errorMessage: '文件上传失败，请检查文件格式',
    }
  );

  return (
    <input
      type="file"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          handleFileUpload(file);
        }
      }}
    />
  );
};

/**
 * 示例3：使用优化后的axios辅助函数
 */
import apiClient, { apiHelpers } from '../config/axiosOptimized';

export const DirectApiExample = () => {
  const fetchData = async () => {
    try {
      // 使用辅助函数 - 自动处理响应格式
      const ideas = await apiHelpers.getList<Idea>('/simple-ideas', {
        maturity: 'mature',
        limit: 50,
      });
      
      console.log('成熟的Ideas:', ideas);

      // 获取单个对象
      const singleIdea = await apiHelpers.getOne<Idea>('/simple-ideas/1');
      console.log('单个Idea:', singleIdea);

      // 创建新对象
      const newIdea = await apiHelpers.post<Idea>('/simple-ideas', {
        research_question: '测试问题',
        research_method: '测试方法',
        source_journal: '测试期刊',
        source_literature: '测试文献',
        responsible_person: '测试人员',
        maturity: 'immature',
      });
      
      console.log('创建的Idea:', newIdea);

      // 文件上传
      const file = new File(['test'], 'test.txt');
      const uploadResult = await apiHelpers.upload(
        '/collaborators/upload',
        file,
        'file',
        { type: 'collaborators' }
      );
      
      console.log('上传结果:', uploadResult);

    } catch (error: any) {
      // 错误已经被格式化
      console.error('操作失败:', error.formattedMessage);
    }
  };

  return (
    <Button onClick={fetchData}>
      测试API调用
    </Button>
  );
};

/**
 * 示例4：使用优化后的类型系统
 */
import { 
  CollaboratorCreate, 
  ResearchProjectCreate,
  WithoutMeta,
  PartialUpdate,
  RequiredFields 
} from '../types/optimized';

// 创建合作者 - 只需要必填字段
const createCollaborator = (data: CollaboratorCreate) => {
  // name是必填的，其他都是可选的
  const newCollaborator: CollaboratorCreate = {
    name: '李四',
    gender: '男',
    is_senior: true,
  };
};

// 更新项目 - 使用PartialUpdate工具类型
type ProjectUpdateData = PartialUpdate<ResearchProject>;
const updateData: ProjectUpdateData = {
  title: '新标题',
  progress: 50,
  // id, created_at, updated_at 已被自动排除
};

// 创建自定义类型 - 必填某些字段
type CustomIdeaCreate = RequiredFields<Idea, 'research_question' | 'responsible_person'>;
const customIdea: CustomIdeaCreate = {
  research_question: '必填问题',
  responsible_person: '必填负责人',
  // 其他字段都是可选的
};

export default {
  IdeasTableExample,
  FileUploadExample,
  DirectApiExample,
};