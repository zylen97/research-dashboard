import api from './api';

// API设置数据模型
export interface APISettings {
  api_key: string;
  api_base: string;
  model: string;
}

export interface APITestRequest {
  api_key: string;
  api_base: string;
  model: string;
}

export interface APITestResponse {
  success: boolean;
  message: string;
  details?: {
    status_code?: number;
    model?: string;
    response?: string;
    error?: string;
  };
}

export interface Model {
  id: string;
  name: string;
  description: string;
}

// Settings API 服务
export const settingsApi = {
  // 获取当前用户的API设置
  getSettings: () => 
    api.get<APISettings>('/settings/'),

  // 更新API设置
  updateApiSettings: (data: APISettings) =>
    api.put<APISettings>('/settings/api', data),

  // 测试API连接
  testConnection: (data: APITestRequest) =>
    api.post<APITestResponse>('/settings/test', data),

  // 获取可用模型列表
  getModels: () =>
    api.get<{ models: Model[] }>('/settings/models'),
};