/**
 * 状态图标映射配置
 * 将原有的符号系统升级为Ant Design图标
 */
import {
  EditOutlined,           // writing - 撰写中
  FileSearchOutlined,     // reviewing - 审稿中
  SyncOutlined,           // revising - 返修中
  CheckCircleOutlined,    // published - 已发表
  CheckOutlined,          // completed - 已完成（但未发表）
} from '@ant-design/icons';
import { STATUS_VISUAL_SYSTEM } from './statusStyles';

export const STATUS_ICON_MAP = {
  writing: EditOutlined,
  reviewing: FileSearchOutlined,
  revising: SyncOutlined,
  published: CheckCircleOutlined,
  completed: CheckOutlined,
} as const;

// 保留原有符号系统作为备选
export { STATUS_VISUAL_SYSTEM };
