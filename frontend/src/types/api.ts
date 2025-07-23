// API响应的通用接口
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

// 备份相关的API响应类型
export interface BackupStatsResponse {
  total_backups: number;
  total_size: number;
  oldest_backup: BackupItem | null;
  newest_backup: BackupItem | null;
  average_size: number;
  max_backups: number;
  current_environment: string;
}

export interface BackupItem {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  created: string;
  createdFormatted: string;
  details?: string;
  collaborators_count?: number;  // 合作者数量
  projects_count?: number;       // 项目数量  
  logs_count?: number;           // 交流日志数量
}

export interface BackupListResponse {
  data: BackupItem[];
  total: number;
}

export interface BackupCreateResponse {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  created: string;
  createdFormatted: string;
}

export interface BackupStats {
  total_backups: number;
  total_size: number;
  oldest_backup: BackupItem | null;
  newest_backup: BackupItem | null;
  average_size: number;
  max_backups: number;
  current_environment: string;
}