/**
 * 状态图标映射配置
 * 将原有的符号系统升级为Ant Design图标
 */
import {
  PlayCircleOutlined,     // active - 撰写中
  FileSearchOutlined,     // reviewing - 审稿中
  EditOutlined,           // revising - 返修中
  PauseCircleOutlined,    // paused - 暂停
  CheckCircleOutlined,    // completed - 已发表
} from '@ant-design/icons';
import { STATUS_VISUAL_SYSTEM } from './statusStyles';

export const STATUS_ICON_MAP = {
  active: PlayCircleOutlined,
  reviewing: FileSearchOutlined,
  revising: EditOutlined,
  paused: PauseCircleOutlined,
  completed: CheckCircleOutlined,
} as const;

// 保留原有符号系统作为备选
export { STATUS_VISUAL_SYSTEM };
