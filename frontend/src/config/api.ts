// API配置管理 - 增强版本，解决CORS重定向问题
const getApiBaseUrl = (): string => {
  // 1. 开发环境使用本地后端
  if (process.env['NODE_ENV'] === 'development') {
    console.log('开发环境，使用本地API');
    return 'http://localhost:8080';
  }

  // 2. 生产环境使用当前origin，但确保包含完整的协议和端口
  const origin = window.location.origin;
  
  // 验证origin是否包含端口号（用于诊断CORS问题）
  if (origin.includes(':3001')) {
    console.log('✅ 生产环境API配置正确:', origin);
  } else {
    console.warn('⚠️ 检测到异常的origin配置:', origin);
  }
  
  return origin;
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
    LOGIN: '/auth/login',
    ME: '/auth/me',
  },
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