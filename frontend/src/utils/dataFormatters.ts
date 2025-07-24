/**
 * 数据格式化工具 - 提供类型安全的数据处理方法
 */

// API响应格式定义
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  timestamp?: string;
}

// 列表响应格式
export interface ApiListResponse<T> {
  data: T[] | null;
  total?: number;
  success?: boolean;
}

// 类型守卫：检查是否为数组
export const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

// 类型守卫：检查是否为对象
export const isObject = (value: unknown): value is Record<string, any> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

// 类型守卫：检查是否为API响应格式
export const isApiResponse = <T>(value: unknown): value is ApiResponse<T> => {
  return isObject(value) && 'success' in value && 'data' in value;
};

// 类型守卫：检查是否为列表响应格式
export const isApiListResponse = <T>(value: unknown): value is ApiListResponse<T> => {
  return isObject(value) && 'data' in value && (Array.isArray(value.data) || value.data === null);
};

/**
 * 安全地处理列表响应
 * 替代原来的 ensureArray 函数，提供更好的类型安全性
 */
export const handleListResponse = <T>(
  response: unknown,
  context?: string
): T[] => {
  // 如果已经是数组，直接返回
  if (isArray<T>(response)) {
    return response;
  }

  // 如果是API响应格式，提取data字段
  if (isApiResponse<T[]>(response)) {
    if (!response.success) {
      console.warn(`[${context || 'API'}] Response marked as unsuccessful`);
    }
    return handleListResponse<T>(response.data, context);
  }

  // 如果是列表响应格式，处理data字段
  if (isApiListResponse<T>(response)) {
    if (response.data === null || response.data === undefined) {
      if (context) {
        console.warn(`[${context}] Received null/undefined data, returning empty array`);
      }
      return [];
    }
    return response.data;
  }

  // 如果是对象且包含data字段，尝试提取
  if (isObject(response) && 'data' in response) {
    return handleListResponse<T>(response.data, context);
  }

  // 处理null/undefined/其他情况
  if (response === null || response === undefined) {
    if (context) {
      console.warn(`[${context}] Received null/undefined response, returning empty array`);
    }
    return [];
  }

  // 未知格式，记录警告并返回空数组
  console.warn(`[${context || 'API'}] Unexpected response format:`, response);
  return [];
};

/**
 * 安全地处理单个对象响应
 */
export const handleObjectResponse = <T>(
  response: unknown,
  context?: string
): T | null => {
  // 如果是API响应格式，提取data字段
  if (isApiResponse<T>(response)) {
    if (!response.success) {
      console.warn(`[${context || 'API'}] Response marked as unsuccessful`);
      return null;
    }
    return response.data;
  }

  // 如果是对象且包含data字段，尝试提取
  if (isObject(response) && 'data' in response) {
    return handleObjectResponse<T>(response.data, context);
  }

  // 如果已经是目标类型，直接返回
  if (response !== null && response !== undefined) {
    return response as T;
  }

  // 处理null/undefined
  if (context) {
    console.warn(`[${context}] Received null/undefined response`);
  }
  return null;
};

/**
 * 统一的空数据处理
 */
export const handleEmptyData = <T>(
  data: T[] | null | undefined,
  defaultValue: T[] = []
): T[] => {
  if (data === null || data === undefined) {
    return defaultValue;
  }
  if (!Array.isArray(data)) {
    console.warn('Expected array but received:', typeof data);
    return defaultValue;
  }
  return data;
};

/**
 * 日期格式化
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date:', date);
      return '';
    }
    return dateObj.toISOString();
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return '';
  }
};

/**
 * 数字格式化
 */
export const formatNumber = (
  value: number | string | null | undefined,
  defaultValue: number = 0
): number => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? defaultValue : num;
};

/**
 * 布尔值格式化
 */
export const formatBoolean = (
  value: boolean | string | number | null | undefined,
  defaultValue: boolean = false
): boolean => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  
  if (typeof value === 'number') {
    return value !== 0;
  }
  
  return defaultValue;
};