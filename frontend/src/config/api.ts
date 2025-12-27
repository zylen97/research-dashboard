// API配置管理
import { getApiBaseUrl, buildApiUrl as buildUrl, ENV } from './environment';

// 导出API配置
export const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  TIMEOUT: ENV.API_TIMEOUT,
  HEADERS: {
    'Content-Type': 'application/json',
  },
} as const;

// 重新导出buildApiUrl以保持向后兼容
export const buildApiUrl = buildUrl;

// API端点常量
export const API_ENDPOINTS = {
  // 研究项目
  RESEARCH: {
    LIST: '/research',
    CREATE: '/research',
    UPDATE: (id: number) => `/research/${id}`,
    DELETE: (id: number) => `/research/${id}`,
    COMMUNICATION_LOGS: (id: number) => `/research/${id}/logs`,
    TOGGLE_TODO: (id: number) => `/research/${id}`,
  },
  // 合作者
  COLLABORATORS: {
    LIST: '/collaborators',
    CREATE: '/collaborators',
    UPDATE: (id: number) => `/collaborators/${id}`,
    DELETE: (id: number) => `/collaborators/${id}`,
  },
  // 想法
  IDEAS: {
    LIST: '/ideas',
    CREATE: '/ideas',
    UPDATE: (id: number) => `/ideas/${id}`,
    DELETE: (id: number) => `/ideas/${id}`,
    STATS: '/ideas/stats/summary',
    SEARCH: '/ideas/search',
    CONVERT_TO_PROJECT: (id: number) => `/ideas/${id}/convert-to-project`,
  },
  // 想法管理
  IDEAS_MANAGEMENT: {
    LIST: '/ideas-management',
    CREATE: '/ideas-management',
    UPDATE: (id: number) => `/ideas-management/${id}`,
    DELETE: (id: number) => `/ideas-management/${id}`,
    HEALTH: '/ideas-management/health',
  },
  // 系统配置
  CONFIG: {
    LIST: '/config',
    CREATE: '/config',
    UPDATE: (id: number) => `/config/${id}`,
    DELETE: (id: number) => `/config/${id}`,
    AI_PROVIDERS: '/config/ai/providers',
    AI_TEST: '/config/ai/test',
  },
  // 备份管理
  BACKUP: {
    STATS: '/backup/stats',
    LIST: '/backup/list',
    CREATE: '/backup/create',
    RESTORE: (id: string) => `/backup/restore/${id}`,
    DELETE: (id: string) => `/backup/${id}`,
    DOWNLOAD: (id: string) => `/backup/download/${id}`,
  },
} as const;

// 网络状态检查
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(buildApiUrl('/'), {
      method: 'GET',
      timeout: 5000,
    } as any);
    return response.ok;
  } catch (error) {
    console.error('API健康检查失败:', error);
    return false;
  }
};

// 日志记录
export const logApiConfig = () => {
  if (ENV.LOG_LEVEL === 'debug' || ENV.LOG_LEVEL === 'info') {
    console.group('📡 API配置信息');
    console.log('基础地址:', API_CONFIG.BASE_URL);
    console.log('环境:', process.env['NODE_ENV']);
    console.log('超时时间:', API_CONFIG.TIMEOUT);
    console.log('API前缀:', ENV.API_PREFIX);
    console.groupEnd();
  }
};

// 开发环境下自动打印配置
if (ENV.LOG_LEVEL === 'debug') {
  logApiConfig();
}