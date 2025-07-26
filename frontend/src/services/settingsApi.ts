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

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  message?: string;
}

// Settings API 服务
export const settingsApi = {
  // 获取当前用户的API设置
  getSettings: (): Promise<APISettings> => 
    api.get('/settings/'),

  // 更新API设置
  updateApiSettings: (data: APISettings): Promise<APISettings> =>
    api.put('/settings/api', data),

  // 测试API连接
  testConnection: (data: APITestRequest): Promise<APITestResponse> =>
    api.post('/settings/test', data),

  // 获取可用模型列表
  getModels: (): Promise<{ models: Model[] }> =>
    api.get('/settings/models'),

  // 发送聊天消息
  sendChatMessage: (message: string): Promise<ChatResponse> =>
    api.post('/settings/chat', { message }),
};