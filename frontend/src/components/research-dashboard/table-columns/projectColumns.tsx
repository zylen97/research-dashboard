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
    completed: 'default',      // 存档 - 灰色
    paused: 'warning',         // 暂停 - 黄色
    reviewing: 'purple',       // 审稿中 - 紫色
    revising: 'error',         // 返修中 - 红色
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
  ...(isMobile ? [] : [{
    title: '来源',
    dataIndex: 'source',
    key: 'source',
    width: 200,
    render: (source: string) => (
      <div
        style={{ 
          color: '#666', 
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }}
        title={source}
      >
        {source || '-'}
      </div>
    ),
  }]),
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 70,
    render: (status: string) => (
      <Tag color={getStatusColor(status)}>
        {status === 'active' ? '撰写中' :
         status === 'completed' ? '存档' :
         status === 'paused' ? '暂停' :
         status === 'reviewing' ? '审稿中' :
         status === 'revising' ? '返修中' : status}
      </Tag>
    ),
  },
  ...(isMobile ? [] : [{
    title: '合作者',
    dataIndex: 'collaborators',
    key: 'collaborators',
    width: 180,
    render: (collaborators: any[]) => {
      const sortedCollaborators = collaborators.sort((a, b) => {
        // 小组优先，然后高级合作者
        const aIsGroup = isGroupCollaborator(a);
        const bIsGroup = isGroupCollaborator(b);
        if (aIsGroup && !bIsGroup) return -1;
        if (!aIsGroup && bIsGroup) return 1;
        return (b.is_senior ? 1 : 0) - (a.is_senior ? 1 : 0);
      });
      
      return (
        <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
          {sortedCollaborators.map((collaborator, index) => {
            const isGroup = isGroupCollaborator(collaborator);
            let color = '#666'; // 默认颜色
            let prefix = '';
            
            if (isGroup) {
              color = '#722ed1'; // 紫色
              prefix = '👥 ';
            } else if (collaborator.is_senior) {
              color = '#1890ff'; // 深蓝色
            }
            
            return (
              <span key={collaborator.id}>
                <span style={{ color }}>
                  {prefix}{collaborator.name}
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
    title: '交流进度',
    key: 'communication_progress',
    width: 200,
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