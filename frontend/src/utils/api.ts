/**
 * API工具函数 - 统一错误处理和响应格式化
 */

import { message } from 'antd';

// API错误类型定义
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

/**
 * 统一的API错误处理函数
 */
export const handleApiError = (error: any): ApiError => {
  // 如果是响应错误
  if (error.response) {
    const { status, data } = error.response;
    let errorMessage = '请求失败';
    
    // 根据状态码提供友好的错误信息
    switch (status) {
      case 400:
        errorMessage = data?.message || '请求参数有误';
        break;
      case 401:
        errorMessage = '未登录或登录已过期，请重新登录';
        break;
      case 403:
        errorMessage = '没有权限执行此操作';
        break;
      case 404:
        errorMessage = '请求的资源不存在';
        break;
      case 422:
        errorMessage = data?.message || '数据验证失败';
        break;
      case 429:
        errorMessage = '请求过于频繁，请稍后再试';
        break;
      case 500:
        errorMessage = '服务器内部错误，请稍后重试';
        break;
      case 502:
        errorMessage = '服务器网关错误';
        break;
      case 503:
        errorMessage = '服务暂时不可用';
        break;
      default:
        errorMessage = data?.message || `请求失败 (${status})`;
    }
    
    return {
      message: errorMessage,
      status,
      code: data?.code,
      details: data
    };
  }
  
  // 网络错误
  if (error.request) {
    return {
      message: '网络连接失败，请检查网络设置',
      code: 'NETWORK_ERROR'
    };
  }
  
  // 其他错误
  return {
    message: error.message || '未知错误',
    code: 'UNKNOWN_ERROR'
  };
};

/**
 * 显示API错误消息到用户界面
 */
export const showApiError = (error: any): void => {
  const apiError = handleApiError(error);
  message.error(apiError.message);
};

/**
 * API响应数据格式化
 */
export const formatApiResponse = <T>(response: any): T => {
  // 如果响应包含success字段，返回data部分
  if (response && typeof response === 'object' && 'success' in response) {
    if (!response.success) {
      throw new Error(response.message || 'API调用失败');
    }
    return response.data;
  }
  
  // 否则直接返回响应数据
  return response;
};

/**
 * API调用包装器 - 自动处理错误和显示消息
 */
export const withErrorHandling = async <T>(
  apiCall: Promise<T>,
  options?: {
    showError?: boolean;
    showSuccess?: boolean;
    successMessage?: string;
  }
): Promise<T> => {
  const {
    showError = true,
    showSuccess = false,
    successMessage = '操作成功'
  } = options || {};
  
  try {
    const result = await apiCall;
    
    if (showSuccess) {
      message.success(successMessage);
    }
    
    return result;
  } catch (error) {
    if (showError) {
      showApiError(error);
    }
    throw error;
  }
};

/**
 * 重试API调用
 */
export const retryApiCall = async <T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // 如果是认证错误或客户端错误，不重试
      if (error.response?.status < 500) {
        throw error;
      }
      
      // 最后一次重试失败，抛出错误
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  
  throw lastError;
};

/**
 * 取消令牌管理 - 用于取消API请求
 */
export class ApiCancellation {
  private static controllers = new Map<string, AbortController>();
  
  static create(key: string): AbortSignal {
    // 取消之前的相同请求
    this.cancel(key);
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    
    return controller.signal;
  }
  
  static cancel(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }
  
  static cancelAll(): void {
    for (const [key, controller] of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
  }
}

/**
 * API缓存管理 - 简单的内存缓存
 */
export class ApiCache {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  static set<T>(key: string, data: T, ttl: number = 300000): void { // 默认5分钟缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // 检查缓存是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  static clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  static getCacheKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}