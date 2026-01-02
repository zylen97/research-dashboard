/**
 * 身份图标映射配置
 * 将原有的符号系统升级为Ant Design图标
 */
import {
  CrownOutlined,      // first_author - 第一作者（皇冠）
  MailOutlined,       // corresponding_author - 通讯作者（邮件）
} from '@ant-design/icons';
import { ROLE_VISUAL_SYSTEM } from './roleStyles';

export const ROLE_ICON_MAP = {
  first_author: CrownOutlined,
  corresponding_author: MailOutlined,
} as const;

// 保留原有符号系统作为备选
export { ROLE_VISUAL_SYSTEM };
