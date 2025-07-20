// API配置管理 - 强制使用3001端口
const getApiBaseUrl = (): string => {
  // 1. 优先使用环境变量
  const envApiUrl = process.env['REACT_APP_API_URL'];
  if (envApiUrl) {
    console.log('使用环境变量API地址:', envApiUrl);
    return envApiUrl;
  }

  // 2. 检查是否在开发环境
  if (process.env['NODE_ENV'] === 'development') {
    console.log('开发环境，使用本地API');
    return 'http://localhost:8080';
  }

  // 3. 生产环境强制使用3001端口
  const apiUrl = 'http://45.149.156.216:3001';
  console.log('生产环境，强制使用3001端口API:', apiUrl);
  return apiUrl;
};

// 导出API配置
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
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
  // 文献
  LITERATURE: {
    LIST: '/api/literature',
    CREATE: '/api/literature',
    UPDATE: (id: number) => `/api/literature/${id}`,
    DELETE: (id: number) => `/api/literature/${id}`,
  },
  // 想法
  IDEAS: {
    LIST: '/api/ideas',
    CREATE: '/api/ideas',
    UPDATE: (id: number) => `/api/ideas/${id}`,
    DELETE: (id: number) => `/api/ideas/${id}`,
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
  console.log('环境变量API地址:', process.env['REACT_APP_API_URL'] || '未设置');
  console.log('超时时间:', API_CONFIG.TIMEOUT);
  console.groupEnd();
};

// 开发环境下自动打印配置
if (process.env['NODE_ENV'] === 'development') {
  logApiConfig();
}