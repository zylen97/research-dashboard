// 环境配置管理
export interface EnvironmentConfig {
  apiUrl: string;
  environment: 'development' | 'production' | 'test';
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  showDevTools: boolean;
  mockAuth: boolean;
}

const getEnvConfig = (): EnvironmentConfig => {
  const env = process.env['REACT_APP_ENVIRONMENT'] || 'development';
  
  return {
    apiUrl: process.env['REACT_APP_API_URL'] || 'http://localhost:8080',
    environment: env as 'development' | 'production' | 'test',
    debug: process.env['REACT_APP_DEBUG'] === 'true',
    logLevel: (process.env['REACT_APP_LOG_LEVEL'] || 'info') as 'debug' | 'info' | 'warn' | 'error',
    showDevTools: process.env['REACT_APP_SHOW_DEV_TOOLS'] === 'true',
    mockAuth: process.env['REACT_APP_MOCK_AUTH'] === 'true',
  };
};

export const config = getEnvConfig();

// 日志工具
export const logger = {
  debug: (...args: any[]) => {
    if (config.logLevel === 'debug' && config.debug) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (['debug', 'info'].includes(config.logLevel)) {
      console.info('[INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
};

// 环境检测工具
export const isProduction = () => config.environment === 'production';
export const isDevelopment = () => config.environment === 'development';
export const isTest = () => config.environment === 'test';