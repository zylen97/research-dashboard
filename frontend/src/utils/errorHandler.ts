/**
 * 统一的错误处理模块
 */

import { message } from 'antd';
import { AxiosError } from 'axios';

// 错误类型枚举
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// API错误类型定义
export interface ApiError {
  message: string;
  type: ErrorType;
  status?: number;
  code?: string;
  details?: any;
  timestamp: Date;
}

// 错误消息映射
const ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数有误',
  401: '未登录或登录已过期，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  422: '数据验证失败',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '服务器网关错误',
  503: '服务暂时不可用',
};

// 将HTTP状态码映射到错误类型
const STATUS_TO_ERROR_TYPE: Record<number, ErrorType> = {
  400: ErrorType.VALIDATION_ERROR,
  401: ErrorType.AUTHENTICATION_ERROR,
  403: ErrorType.AUTHORIZATION_ERROR,
  404: ErrorType.NOT_FOUND_ERROR,
  422: ErrorType.VALIDATION_ERROR,
  429: ErrorType.RATE_LIMIT_ERROR,
  500: ErrorType.SERVER_ERROR,
  502: ErrorType.SERVER_ERROR,
  503: ErrorType.SERVER_ERROR,
};

/**
 * 将错误对象转换为统一的API错误格式
 */
export const parseError = (error: any): ApiError => {
  const timestamp = new Date();

  // 处理Axios错误
  if (error.isAxiosError) {
    const axiosError = error as AxiosError<any>;
    
    if (axiosError.response) {
      // 服务器响应错误
      const { status, data } = axiosError.response;
      const errorType = STATUS_TO_ERROR_TYPE[status] || ErrorType.UNKNOWN_ERROR;
      const errorMessage = data?.message || data?.detail || ERROR_MESSAGES[status] || `请求失败 (${status})`;
      
      return {
        message: errorMessage,
        type: errorType,
        status,
        code: data?.code,
        details: data,
        timestamp,
      };
    } else if (axiosError.request) {
      // 网络错误
      return {
        message: '网络连接失败，请检查网络设置',
        type: ErrorType.NETWORK_ERROR,
        code: 'NETWORK_ERROR',
        timestamp,
      };
    } else {
      // 请求配置错误
      return {
        message: axiosError.message || '请求配置错误',
        type: ErrorType.UNKNOWN_ERROR,
        code: 'CONFIG_ERROR',
        timestamp,
      };
    }
  }

  // 处理普通错误对象
  if (error instanceof Error) {
    return {
      message: error.message,
      type: ErrorType.UNKNOWN_ERROR,
      code: 'UNKNOWN_ERROR',
      timestamp,
    };
  }

  // 处理字符串错误
  if (typeof error === 'string') {
    return {
      message: error,
      type: ErrorType.UNKNOWN_ERROR,
      code: 'STRING_ERROR',
      timestamp,
    };
  }

  // 未知错误类型
  return {
    message: '未知错误',
    type: ErrorType.UNKNOWN_ERROR,
    code: 'UNKNOWN_ERROR',
    details: error,
    timestamp,
  };
};

/**
 * 显示错误消息
 */
export const showError = (error: ApiError | any): void => {
  const apiError = error.type ? error : parseError(error);
  message.error(apiError.message);
};

/**
 * 错误处理中间件 - 用于axios响应拦截器
 */
export const errorInterceptor = (error: any): Promise<never> => {
  const apiError = parseError(error);
  
  // 特殊处理认证错误
  if (apiError.type === ErrorType.AUTHENTICATION_ERROR) {
    // 清除本地认证信息
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    // 只在非登录页面时跳转
    if (!window.location.pathname.includes('/auth')) {
      window.location.href = '/';
    }
  }
  
  // 开发环境打印详细错误信息
  if (process.env['NODE_ENV'] === 'development') {
    console.error('[API Error]', {
      message: apiError.message,
      type: apiError.type,
      status: apiError.status,
      details: apiError.details,
      timestamp: apiError.timestamp,
    });
  }
  
  return Promise.reject(apiError);
};

/**
 * 错误重试判断
 */
export const shouldRetry = (error: ApiError): boolean => {
  // 只对服务器错误和网络错误进行重试
  return error.type === ErrorType.SERVER_ERROR || 
         error.type === ErrorType.NETWORK_ERROR;
};

/**
 * 格式化错误消息用于显示
 */
export const formatErrorMessage = (error: ApiError): string => {
  if (error.type === ErrorType.VALIDATION_ERROR && error.details?.errors) {
    // 格式化验证错误
    const errors = error.details.errors;
    if (Array.isArray(errors)) {
      return errors.join(', ');
    } else if (typeof errors === 'object') {
      return Object.values(errors).flat().join(', ');
    }
  }
  
  return error.message;
};