/**
 * API工具函数 - 提供实用功能如响应格式化、重试、缓存等
 */

import { message } from 'antd';
import { showError, ApiError, shouldRetry, parseError } from './errorHandler';

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
      showError(error);
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
      
      // 解析错误类型
      const apiError = parseError(error);
      
      // 如果不应该重试，直接抛出错误
      if (!shouldRetry(apiError)) {
        throw error;
      }
      
      // 最后一次重试失败，抛出错误
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 等待后重试（指数退避）
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
    this.controllers.forEach((controller) => {
      controller.abort();
    });
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