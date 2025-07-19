import { Button, Tag, Space, Typography } from 'antd';

const { Text } = Typography;
import { 
  EditOutlined, 
  DeleteOutlined, 
  MessageOutlined, 
  FlagOutlined 
} from '@ant-design/icons';
import { ResearchProject } from '../../../types';

export interface ProjectTableActions {
  onEdit: (project: ResearchProject) => void;
  onDelete: (project: ResearchProject) => void;
  onViewLogs: (project: ResearchProject) => void;
  onToggleTodo: (project: ResearchProject) => void;
}

export interface ProjectColumnProps {
  actions: ProjectTableActions;
  getProjectTodoStatus: (project: ResearchProject) => { is_todo: boolean; todo_marked_at: string };
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
}: ProjectColumnProps) => [
  {
    title: '序号',
    key: 'index',
    width: 60,
    fixed: 'left' as const,
    render: (_: any, __: any, index: number) => {
      return (currentPage - 1) * pageSize + index + 1;
    },
  },
  {
    title: '项目名称',
    dataIndex: 'title',
    key: 'title',
    width: 200,
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
  {
    title: '项目描述',
    dataIndex: 'idea_description',
    key: 'idea_description',
    width: 300,
    ellipsis: { showTitle: false },
    render: (description: string) => (
      <Text
        ellipsis={{ tooltip: description }}
        style={{ color: '#666' }}
      >
        {description}
      </Text>
    ),
  },
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
  {
    title: '合作者',
    dataIndex: 'collaborators',
    key: 'collaborators',
    width: 200,
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
  },
  {
    title: '交流进度',
    key: 'communication_progress',
    width: 250,
    render: (record: ResearchProject) => {
      if (record.latest_communication) {
        return (
          <Text ellipsis={{ tooltip: record.latest_communication }} style={{ fontSize: '13px' }}>
            <MessageOutlined style={{ marginRight: 4, color: '#1890ff' }} />
            {record.latest_communication}
          </Text>
        );
      }
      return (
        <Text style={{ fontSize: '13px', color: '#999' }}>
          暂无交流记录
        </Text>
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
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