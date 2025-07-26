/**
 * 优化后的统一错误处理器
 */
import { message } from 'antd';
import { AxiosError } from 'axios';

// 错误消息映射
const ERROR_MESSAGES: Record<string, string> = {
  // 网络错误
  'Network Error': '网络连接失败，请检查网络设置',
  'timeout': '请求超时，请稍后重试',
  
  // HTTP状态码
  '400': '请求参数错误',
  '401': '未登录或登录已过期',
  '403': '没有权限访问此资源',
  '404': '请求的资源不存在',
  '409': '数据冲突，请刷新后重试',
  '500': '服务器内部错误',
  '502': '网关错误',
  '503': '服务暂时不可用',
  
  // 业务错误（根据后端返回的detail字段）
  'Collaborator not found': '合作者不存在',
  'Project not found': '项目不存在',
  'Idea not found': 'Idea不存在',
  'Duplicate entry': '数据已存在，请勿重复添加',
  'Invalid data format': '数据格式错误',
  'Validation failed': '数据验证失败',
};

// 操作类型映射
const OPERATION_MESSAGES: Record<string, Record<string, string>> = {
  create: {
    success: '创建成功',
    error: '创建失败',
  },
  update: {
    success: '更新成功',
    error: '更新失败',
  },
  delete: {
    success: '删除成功',
    error: '删除失败',
  },
  upload: {
    success: '上传成功',
    error: '上传失败',
  },
  download: {
    success: '下载成功',
    error: '下载失败',
  },
  restore: {
    success: '恢复成功',
    error: '恢复失败',
  },
  convert: {
    success: '转化成功',
    error: '转化失败',
  },
};

/**
 * 从错误对象中提取错误消息
 */
function extractErrorMessage(error: any): string {
  // 优先使用后端返回的详细错误信息
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    // 如果detail是字符串，直接使用
    if (typeof detail === 'string') {
      return ERROR_MESSAGES[detail] || detail;
    }
    // 如果detail是对象（验证错误），格式化显示
    if (typeof detail === 'object' && Array.isArray(detail)) {
      return detail.map((err: any) => err.msg || err.message).join('；');
    }
  }
  
  // 使用后端返回的message字段
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // 使用HTTP状态码对应的错误消息
  if (error.response?.status) {
    const statusMessage = ERROR_MESSAGES[error.response.status.toString()];
    if (statusMessage) {
      return statusMessage;
    }
  }
  
  // 网络错误
  if (error.message) {
    return ERROR_MESSAGES[error.message] || error.message;
  }
  
  // 默认错误消息
  return '操作失败，请稍后重试';
}

/**
 * 统一的错误拦截器
 */
export const errorInterceptorOptimized = (error: AxiosError) => {
  // 如果是401错误，跳转到登录页
  if (error.response?.status === 401) {
    // 避免重复跳转
    if (!window.location.pathname.includes('/auth')) {
      message.error('登录已过期，请重新登录');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
  
  // 对于其他错误，提取错误消息但不直接显示
  // 让各个组件根据需要决定是否显示错误
  const errorMessage = extractErrorMessage(error);
  
  // 将格式化后的错误消息附加到error对象上
  (error as any).formattedMessage = errorMessage;
  
  // 开发环境下打印详细错误信息
  if (process.env['NODE_ENV'] === 'development') {
    console.error('[API Error]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: errorMessage,
    });
  }
  
  return Promise.reject(error);
};

/**
 * 显示操作结果消息
 * @param operation - 操作类型 (create, update, delete等)
 * @param success - 是否成功
 * @param customMessage - 自定义消息
 */
export function showOperationMessage(
  operation: keyof typeof OPERATION_MESSAGES,
  success: boolean,
  customMessage?: string
) {
  const messageType = success ? 'success' : 'error';
  const defaultMessage = OPERATION_MESSAGES[operation]?.[messageType] || 
    (success ? '操作成功' : '操作失败');
  
  const finalMessage = customMessage || defaultMessage;
  
  message[messageType](finalMessage);
}

/**
 * 创建带有自动错误处理的异步函数包装器
 * @param asyncFn - 异步函数
 * @param operation - 操作类型
 * @param options - 选项
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  operation: keyof typeof OPERATION_MESSAGES,
  options?: {
    showSuccess?: boolean;
    successMessage?: string;
    errorMessage?: string;
    onError?: (error: any) => void;
  }
): T {
  const { 
    showSuccess = true, 
    successMessage, 
    errorMessage,
    onError 
  } = options || {};
  
  return (async (...args: Parameters<T>) => {
    try {
      const result = await asyncFn(...args);
      if (showSuccess) {
        showOperationMessage(operation, true, successMessage);
      }
      return result;
    } catch (error: any) {
      const message = error.formattedMessage || errorMessage || 
        OPERATION_MESSAGES[operation]?.['error'] || '操作失败';
      
      showOperationMessage(operation, false, message);
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    }
  }) as T;
}

/**
 * React Hook: 使用错误处理器
 */
export function useErrorHandler() {
  return {
    showError: (error: any, operation?: keyof typeof OPERATION_MESSAGES) => {
      const message = error.formattedMessage || extractErrorMessage(error);
      showOperationMessage(operation || 'create', false, message);
    },
    showSuccess: (operation: keyof typeof OPERATION_MESSAGES, customMessage?: string) => {
      showOperationMessage(operation, true, customMessage);
    },
    withErrorHandler,
  };
}