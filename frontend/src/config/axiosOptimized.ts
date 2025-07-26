/**
 * 优化后的Axios配置 - 统一响应处理
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from './api';
import { ENV } from './environment';
import { errorInterceptorOptimized } from '../utils/errorHandlerOptimized';

// 统一的API响应格式
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  timestamp?: string;
}

// 判断是否为列表响应
function isListResponse(data: any): boolean {
  return (
    Array.isArray(data) || 
    (data && typeof data === 'object' && 
     'data' in data && 
     (Array.isArray(data.data) || data.data === null))
  );
}

// 处理列表响应
function handleListResponse(data: any): any[] {
  // 如果已经是数组，直接返回
  if (Array.isArray(data)) {
    return data;
  }
  
  // 如果是包含data字段的对象
  if (data && typeof data === 'object' && 'data' in data) {
    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (data.data === null || data.data === undefined) {
      if (ENV.LOG_LEVEL === 'debug') {
        console.warn('[API] Received null/undefined data, returning empty array');
      }
      return [];
    }
  }
  
  // 未知格式，返回空数组
  if (ENV.LOG_LEVEL === 'debug') {
    console.warn('[API] Unexpected response format:', data);
  }
  return [];
}

/**
 * 创建优化的Axios实例
 */
export function createOptimizedAxiosInstance(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: API_CONFIG.HEADERS,
  });

  // 请求拦截器
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // 自动添加API前缀
      if (config.url && !config.url.startsWith(ENV.API_PREFIX) && !config.url.startsWith('http')) {
        config.url = ENV.API_PREFIX + config.url;
      }
      
      // 添加认证token
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // 开发环境日志
      if (ENV.LOG_LEVEL === 'debug') {
        console.log('[API Request]', {
          url: config.url,
          method: config.method,
          params: config.params,
          data: config.data,
        });
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器 - 统一处理响应格式
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // 对于blob类型的响应，直接返回
      if (response.config.responseType === 'blob') {
        return response;
      }
      
      const data = response.data;
      
      // 开发环境日志
      if (ENV.LOG_LEVEL === 'debug') {
        console.log('[API Response]', {
          url: response.config.url,
          status: response.status,
          data: data,
        });
      }
      
      // 处理统一的API响应格式
      if (data && typeof data === 'object' && 'success' in data) {
        const apiResponse = data as ApiResponse;
        if (!apiResponse.success) {
          // 如果响应标记为失败，抛出错误
          const error: any = new Error(apiResponse.message || 'API call failed');
          error.response = {
            ...response,
            data: apiResponse,
          };
          throw error;
        }
        
        // 如果是成功的响应，返回data字段
        response.data = apiResponse.data !== undefined ? apiResponse.data : apiResponse;
      }
      
      // 自动处理列表响应
      if (isListResponse(response.data)) {
        const processedData = handleListResponse(response.data);
        // 保留原始响应的其他信息（如total）
        if (data && typeof data === 'object' && 'total' in data) {
          (processedData as any).__total = data.total;
        }
        response.data = processedData;
      }
      
      return response;
    },
    errorInterceptorOptimized
  );

  return instance;
}

// 创建默认实例
const apiClient = createOptimizedAxiosInstance();

// 辅助函数：获取列表数据的总数
export function getListTotal(data: any): number | undefined {
  if (data && typeof data === 'object' && '__total' in data) {
    return data.__total;
  }
  return undefined;
}

// 导出一些便捷方法
export const apiHelpers = {
  /**
   * 发起GET请求并自动处理列表响应
   */
  getList: async <T>(url: string, params?: any): Promise<T[]> => {
    const response = await apiClient.get<T[]>(url, { params });
    return response.data;
  },
  
  /**
   * 发起GET请求获取单个对象
   */
  getOne: async <T>(url: string, params?: any): Promise<T> => {
    const response = await apiClient.get<T>(url, { params });
    return response.data;
  },
  
  /**
   * 发起POST请求
   */
  post: async <T>(url: string, data?: any, config?: any): Promise<T> => {
    const response = await apiClient.post<T>(url, data, config);
    return response.data;
  },
  
  /**
   * 发起PUT请求
   */
  put: async <T>(url: string, data?: any, config?: any): Promise<T> => {
    const response = await apiClient.put<T>(url, data, config);
    return response.data;
  },
  
  /**
   * 发起DELETE请求
   */
  delete: async <T = any>(url: string, config?: any): Promise<T> => {
    const response = await apiClient.delete<T>(url, config);
    return response.data;
  },
  
  /**
   * 上传文件
   */
  upload: async <T = any>(url: string, file: File, fieldName: string = 'file', additionalData?: any): Promise<T> => {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }
    
    const response = await apiClient.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  /**
   * 下载文件
   */
  download: async (url: string, filename?: string): Promise<void> => {
    const response = await apiClient.get(url, {
      responseType: 'blob',
    });
    
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default apiClient;