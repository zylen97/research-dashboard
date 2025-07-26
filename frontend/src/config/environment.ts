// 环境配置管理
// 统一管理不同环境下的配置参数

interface EnvironmentConfig {
  API_BASE_URL: string;
  API_PREFIX: string;
  API_TIMEOUT: number;
  USE_MOCK: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

// 环境类型
type Environment = 'development' | 'production' | 'test';

// 环境配置映射
const ENV_CONFIGS: Record<Environment, EnvironmentConfig> = {
  development: {
    API_BASE_URL: 'http://localhost:8080',
    API_PREFIX: '/api',
    API_TIMEOUT: 120000,  // 增加到120秒，支持并发Excel处理
    USE_MOCK: false,
    LOG_LEVEL: 'debug',
  },
  production: {
    API_BASE_URL: 'http://45.149.156.216:8000', // 修复：指向正确的后端端口
    API_PREFIX: '/api',
    API_TIMEOUT: 120000,  // 增加到120秒，支持并发Excel处理
    USE_MOCK: false,
    LOG_LEVEL: 'error',
  },
  test: {
    API_BASE_URL: 'http://localhost:8080',
    API_PREFIX: '/api',
    API_TIMEOUT: 5000,
    USE_MOCK: true,
    LOG_LEVEL: 'info',
  },
};

// 获取当前环境
const getCurrentEnvironment = (): Environment => {
  const env = process.env['NODE_ENV'] as Environment;
  return env || 'production';
};

// 获取环境配置
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = getCurrentEnvironment();
  return ENV_CONFIGS[env];
};

// 获取API基础URL
export const getApiBaseUrl = (): string => {
  const config = getEnvironmentConfig();
  
  // 生产环境使用当前origin
  if (config.API_BASE_URL === '') {
    return window.location.origin;
  }
  
  return config.API_BASE_URL;
};

// 构建完整的API URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl().replace(/\/$/, ''); // 移除末尾斜杠
  const config = getEnvironmentConfig();
  
  // 确保endpoint以/开头
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // 如果endpoint已经包含API_PREFIX，不重复添加
  if (cleanEndpoint.startsWith(config.API_PREFIX)) {
    return `${baseUrl}${cleanEndpoint}`;
  }
  
  return `${baseUrl}${config.API_PREFIX}${cleanEndpoint}`;
};

// 环境信息日志
export const logEnvironmentInfo = (): void => {
  const env = getCurrentEnvironment();
  const config = getEnvironmentConfig();
  
  if (config.LOG_LEVEL === 'debug' || config.LOG_LEVEL === 'info') {
    console.group('🌍 环境配置信息');
    console.log('当前环境:', env);
    console.log('API基础地址:', getApiBaseUrl());
    console.log('API前缀:', config.API_PREFIX);
    console.log('超时时间:', config.API_TIMEOUT);
    console.log('日志级别:', config.LOG_LEVEL);
    console.groupEnd();
  }
};

// 开发环境下自动打印环境信息
if (process.env['NODE_ENV'] === 'development') {
  logEnvironmentInfo();
}

// 导出当前环境配置
export const ENV = getEnvironmentConfig();