import { Button, Tag, Space, Typography } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  MessageOutlined, 
  FlagOutlined 
} from '@ant-design/icons';
import { ResearchProject } from '../../../types';

const { Text } = Typography;

export interface ProjectTableActions {
  onEdit: (project: ResearchProject) => void;
  onDelete: (project: ResearchProject) => void;
  onViewLogs: (project: ResearchProject) => void;
  onToggleTodo: (project: ResearchProject) => void;
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
    active: 'processing',
    completed: 'success',
    paused: 'warning',
  };
  return colors[status] || 'default';
};

// 临时识别小组的函数
const isGroupCollaborator = (collaborator: any) => {
  const getLocalGroupMarks = () => {
    try {
      const saved = localStorage.getItem('collaborator-group-marks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };
  
  const localMarks = getLocalGroupMarks();
  
  // 1. 优先使用本地标记状态
  if (localMarks[collaborator.id] !== undefined) {
    return localMarks[collaborator.id];
  }
  
  // 2. 后端支持is_group字段时直接返回
  if (collaborator.is_group !== undefined) {
    return collaborator.is_group;
  }
  
  // 3. 临时逻辑：根据名称和班级信息判断是否为小组
  const groupIndicators = [
    '小组', '团队', '大创团队', '创新大赛小组', 
    '周佳祺 庄晶涵 范佳伟', '田超 王昊 李思佳 凌文杰'
  ];
  return groupIndicators.some(indicator => 
    collaborator.name.includes(indicator) || 
    (collaborator.class_name && collaborator.class_name.includes(indicator))
  );
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
    ellipsis: true,
    render: (title: string, project: ResearchProject) => {
      const todoStatus = getProjectTodoStatus(project);
      return (
        <Text strong style={{ fontSize: '14px' }}>
          {todoStatus.is_todo && '🚩 '}
          {title}
        </Text>
      );
    },
  },
  ...(isMobile ? [] : [{
    title: '项目描述',
    dataIndex: 'idea_description',
    key: 'idea_description',
    width: 250,
    ellipsis: { showTitle: false },
    render: (description: string) => (
      <Text
        ellipsis={{ tooltip: description }}
        style={{ color: '#666' }}
      >
        {description}
      </Text>
    ),
  }]),
  ...(isMobile ? [] : [{
    title: '研究方法',
    dataIndex: 'research_method',
    key: 'research_method',
    width: 150,
    ellipsis: { showTitle: false },
    render: (method: string) => (
      <Text
        ellipsis={{ tooltip: method }}
        style={{ color: '#666' }}
      >
        {method || '-'}
      </Text>
    ),
  }]),
  ...(isMobile ? [] : [{
    title: '来源',
    dataIndex: 'source',
    key: 'source',
    width: 150,
    ellipsis: { showTitle: false },
    render: (source: string) => (
      <Text
        ellipsis={{ tooltip: source }}
        style={{ color: '#666', fontSize: '12px' }}
      >
        {source || '-'}
      </Text>
    ),
  }]),
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: string) => (
      <Tag color={getStatusColor(status)}>
        {status === 'active' ? '进行中' :
         status === 'completed' ? '已完成' :
         status === 'paused' ? '暂停' : status}
      </Tag>
    ),
    filters: [
      { text: '进行中', value: 'active' },
      { text: '已完成', value: 'completed' },
      { text: '暂停', value: 'paused' },
    ],
    onFilter: (value: any, record: ResearchProject) => record.status === value,
  },
  ...(isMobile ? [] : [{
    title: '合作者',
    dataIndex: 'collaborators',
    key: 'collaborators',
    width: 180,
    render: (collaborators: any[]) => {
      return (
        <Space wrap>
          {collaborators
            .sort((a, b) => {
              // 小组优先，然后高级合作者
              const aIsGroup = isGroupCollaborator(a);
              const bIsGroup = isGroupCollaborator(b);
              if (aIsGroup && !bIsGroup) return -1;
              if (!aIsGroup && bIsGroup) return 1;
              return (b.is_senior ? 1 : 0) - (a.is_senior ? 1 : 0);
            })
            .map((collaborator) => {
              const isGroup = isGroupCollaborator(collaborator);
              return (
                <Tag 
                  key={collaborator.id} 
                  color={isGroup ? 'purple' : (collaborator.is_senior ? 'gold' : 'default')}
                  style={{ margin: '2px' }}
                >
                  {isGroup && '👥 '}{collaborator.name}
                  {collaborator.is_senior && !isGroup && ' ⭐'}
                </Tag>
              );
            })}
        </Space>
      );
    },
  }]),
  ...(isMobile ? [] : [{
    title: '交流进度',
    key: 'communication_progress',
    width: 250,
    render: (record: ResearchProject) => {
      // 使用communication_logs数组，正确排序获取最新记录
      const logs = record.communication_logs || [];
      if (logs.length > 0) {
        // 按交流日期排序，获取最新的交流记录（带容错）
        const sortedLogs = [...logs].sort((a, b) => {
          const dateA = new Date(a.communication_date || a.created_at);
          const dateB = new Date(b.communication_date || b.created_at);
          return dateB.getTime() - dateA.getTime();
        });
        const latestLog = sortedLogs[0];
        if (!latestLog) {
          return (
            <Text style={{ fontSize: '13px', color: '#999' }}>
              暂无交流记录
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
          <Text ellipsis={{ tooltip: `${displayText} (共${logs.length}条记录)` }} style={{ fontSize: '13px' }}>
            <MessageOutlined style={{ marginRight: 4, color: '#1890ff' }} />
            {displayText}
          </Text>
        );
      }
      return (
        <Text style={{ fontSize: '13px', color: '#999' }}>
          暂无交流记录
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
            title="交流日志"
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