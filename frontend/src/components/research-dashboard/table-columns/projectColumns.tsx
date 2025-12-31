import { Button, Tag, Space, Typography } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  MessageOutlined, 
  FlagOutlined,
  EyeOutlined 
} from '@ant-design/icons';
import { ResearchProject } from '../../../types';

const { Text } = Typography;

export interface ProjectTableActions {
  onEdit: (project: ResearchProject) => void;
  onDelete: (project: ResearchProject) => void;
  onViewLogs: (project: ResearchProject) => void;
  onToggleTodo: (project: ResearchProject) => void;
  onPreview: (project: ResearchProject) => void;
}

export interface ProjectColumnProps {
  actions: ProjectTableActions;
  getProjectTodoStatus: (project: ResearchProject) => { 
    is_todo: boolean; 
    marked_at: string | null;
    priority: number | null;
    notes: string | null;
  };
  currentPage: number;
  pageSize: number;
}

// 状态颜色映射
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: 'processing',      // 撰写中 - 蓝色
    completed: 'default',      // 已发表 - 灰色
    paused: 'warning',         // 暂停 - 黄色
    reviewing: 'purple',       // 审稿中 - 紫色
    revising: 'error',         // 返修中 - 红色
  };
  return colors[status] || 'default';
};


export const createProjectColumns = ({
  actions,
  getProjectTodoStatus,
  currentPage,
  pageSize
}: ProjectColumnProps) => {
  const isMobile = window.innerWidth < 768;
  
  return [
  {
    title: '序号',
    key: 'index',
    width: 50,
    fixed: 'left' as const,
    render: (_: any, __: any, index: number) => {
      return (currentPage - 1) * pageSize + index + 1;
    },
  },
  {
    title: '项目名称',
    dataIndex: 'title',
    key: 'title',
    width: 180,
    render: (title: string, project: ResearchProject) => {
      const todoStatus = getProjectTodoStatus(project);
      return (
        <div 
          style={{ 
            fontSize: '14px',
            fontWeight: 'bold',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.5'
          }}
        >
          {todoStatus.is_todo && '🚩 '}
          {title}
        </div>
      );
    },
  },
  ...(isMobile ? [] : [{
    title: '(拟)投稿期刊',
    dataIndex: 'target_journal',
    key: 'target_journal',
    width: 150,
    render: (target_journal: string) => (
      <div
        style={{
          color: '#666',
          fontSize: '13px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }}
        title={target_journal}
      >
        {target_journal || '-'}
      </div>
    ),
  }]),
  ...(isMobile ? [] : [{
    title: '研究方法',
    dataIndex: 'research_method',
    key: 'research_method',
    width: 60,
    render: (method: string) => (
      <div
        style={{ 
          color: '#666',
          fontSize: '13px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }}
        title={method}
      >
        {method || '-'}
      </div>
    ),
  }]),
  ...(isMobile ? [] : [
    {
      title: '参考论文',
      dataIndex: 'reference_paper',
      key: 'reference_paper',
      width: 200,
      render: (text: string) => (
        <div
          style={{
            color: '#666',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.4'
          }}
          title={text}
        >
          {text || '-'}
        </div>
      ),
    },
    {
      title: '参考期刊',
      dataIndex: 'reference_journal',
      key: 'reference_journal',
      width: 150,
      render: (text: string) => (
        <div
          style={{
            color: '#666',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.4'
          }}
          title={text}
        >
          {text || '-'}
        </div>
      ),
    }
  ]),
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 70,
    render: (status: string) => {
      // 防御null/undefined
      if (!status) {
        return <Tag color="default">未知状态</Tag>;
      }
      return (
        <Tag color={getStatusColor(status)}>
          {status === 'active' ? '撰写中' :
           status === 'completed' ? '已发表' :
           status === 'paused' ? '暂停' :
           status === 'reviewing' ? '审稿中' :
           status === 'revising' ? '返修中' : status}
        </Tag>
      );
    },
  },
  // 🆕 我的身份列
  {
    title: '我的身份',
    dataIndex: 'my_role',
    key: 'my_role',
    width: 100,
    render: (my_role: string) => {
      const roleConfig = {
        first_author: { text: '第一作者', color: 'red', icon: '🥇' },
        corresponding_author: { text: '通讯作者', color: 'blue', icon: '✉️' },
        other_author: { text: '其他作者', color: 'default', icon: '👥' },
      };
      const config = roleConfig[my_role as keyof typeof roleConfig] || roleConfig.other_author;

      return (
        <Tag color={config.color} style={{ fontWeight: 'bold', fontSize: '12px' }}>
          {config.icon} {config.text}
        </Tag>
      );
    },
  },
  ...(isMobile ? [] : [{
    title: '合作者',
    dataIndex: 'collaborators',
    key: 'collaborators',
    width: 180,
    render: (collaborators: any[]) => {
      // 只按is_senior排序
      const sortedCollaborators = collaborators.sort((a, b) =>
        (b.is_senior ? 1 : 0) - (a.is_senior ? 1 : 0)
      );

      return (
        <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
          {sortedCollaborators.map((collaborator, index) => {
            const color = collaborator.is_senior ? '#1890ff' : '#666';

            return (
              <span key={collaborator.id}>
                <span style={{ color }}>
                  {collaborator.name}
                  {collaborator.is_senior && ' ⭐'}
                </span>
                {index < sortedCollaborators.length - 1 && ', '}
              </span>
            );
          })}
        </div>
      );
    },
  }]),
  ...(isMobile ? [] : [{
    title: '论文进度',
    key: 'communication_progress',
    width: 200,
    render: (record: ResearchProject) => {
      // 使用communication_logs数组，正确排序获取最新记录
      const logs = record.communication_logs || [];
      if (logs.length > 0) {
        // 按进度日期排序，获取最新的论文进度记录（带容错）
        const sortedLogs = [...logs].sort((a, b) => {
          const dateA = new Date(a.communication_date || a.created_at);
          const dateB = new Date(b.communication_date || b.created_at);
          return dateB.getTime() - dateA.getTime();
        });
        const latestLog = sortedLogs[0];
        if (!latestLog) {
          return (
            <Text style={{ fontSize: '13px', color: '#999' }}>
              暂无进度记录
            </Text>
          );
        }
        // 格式化日期显示
        const communicationDate = new Date(latestLog.communication_date);
        const dateStr = communicationDate.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\//g, '-');
        const displayText = `${dateStr}: ${latestLog.title}`;
        return (
          <div 
            style={{ 
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.4'
            }}
            title={`${displayText} (共${logs.length}条记录)`}
          >
            <MessageOutlined style={{ marginRight: 4, color: '#1890ff' }} />
            {displayText}
          </div>
        );
      }
      return (
        <Text style={{ fontSize: '13px', color: '#999' }}>
          暂无进度记录
        </Text>
      );
    },
  }]),
  {
    title: '操作',
    key: 'actions',
    width: 150,
    fixed: 'right' as const,
    render: (_: any, project: ResearchProject) => {
      const todoStatus = getProjectTodoStatus(project);
      return (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => actions.onPreview(project)}
            title="预览详情"
          />
          <Button
            type="text"
            icon={<FlagOutlined />}
            onClick={() => actions.onToggleTodo(project)}
            title={todoStatus.is_todo ? "取消待办标记" : "标记为待办"}
            style={{
              color: todoStatus.is_todo ? '#ff4d4f' : '#8c8c8c',
            }}
          />
          <Button
            type="text"
            icon={<MessageOutlined />}
            onClick={() => actions.onViewLogs(project)}
            title="论文进度"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => actions.onEdit(project)}
            title="编辑"
          />
          <Button
            type="text"
            icon={<DeleteOutlined />}
            danger
            title="删除"
            onClick={() => actions.onDelete(project)}
          />
        </Space>
      );
    },
  },
];
};