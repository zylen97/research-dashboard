// API配置管理 - 自适应版本
const getApiBaseUrl = (): string => {
  // 1. 开发环境使用本地后端
  if (process.env['NODE_ENV'] === 'development') {
    console.log('开发环境，使用本地API');
    return 'http://localhost:8080';
  }

  // 2. 生产环境始终使用当前origin
  // 这样能自动适应任何部署场景：80、443、3000、3001等任何端口
  console.log('生产环境，使用当前origin:', window.location.origin);
  return window.location.origin;
};

// 导出API配置 - 使用getter确保动态获取BASE_URL
export const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
} as const;

// 构建完整的API URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, ''); // 移除末尾斜杠
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// API端点常量
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/api/auth/login',
    ME: '/api/auth/me',
  },
  // 研究项目
  RESEARCH: {
    LIST: '/api/research',
    CREATE: '/api/research',
    UPDATE: (id: number) => `/api/research/${id}`,
    DELETE: (id: number) => `/api/research/${id}`,
    COMMUNICATION_LOGS: (id: number) => `/api/research/${id}/logs`,
    TOGGLE_TODO: (id: number) => `/api/research/${id}`,
  },
  // 合作者
  COLLABORATORS: {
    LIST: '/api/collaborators',
    CREATE: '/api/collaborators',
    UPDATE: (id: number) => `/api/collaborators/${id}`,
    DELETE: (id: number) => `/api/collaborators/${id}`,
  },
  // 想法
  IDEAS: {
    LIST: '/api/ideas',
    CREATE: '/api/ideas',
    UPDATE: (id: number) => `/api/ideas/${id}`,
    DELETE: (id: number) => `/api/ideas/${id}`,
    STATS: '/api/ideas/stats/summary',
    SEARCH: '/api/ideas/search',
    CONVERT_TO_PROJECT: (id: number) => `/api/ideas/${id}/convert-to-project`,
  },
  // 系统配置
  CONFIG: {
    LIST: '/api/config',
    CREATE: '/api/config',
    UPDATE: (id: number) => `/api/config/${id}`,
    DELETE: (id: number) => `/api/config/${id}`,
    AI_PROVIDERS: '/api/config/ai/providers',
    AI_TEST: '/api/config/ai/test',
  },
  // 备份管理
  BACKUP: {
    STATS: '/api/backup/stats',
    LIST: '/api/backup/list',
    CREATE: '/api/backup/create',
    RESTORE: (id: string) => `/api/backup/restore/${id}`,
    DELETE: (id: string) => `/api/backup/${id}`,
    DOWNLOAD: (id: string) => `/api/backup/download/${id}`,
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
  console.group('📡 API配置信息');
  console.log('基础地址:', API_CONFIG.BASE_URL);
  console.log('环境:', process.env['NODE_ENV']);
  console.log('超时时间:', API_CONFIG.TIMEOUT);
  console.groupEnd();
};

// 开发环境下自动打印配置
if (process.env['NODE_ENV'] === 'development') {
  logApiConfig();
}