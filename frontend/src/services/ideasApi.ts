/**
 * Ideas API服务 - 重新设计版本
 */
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { ENV } from '../config/environment';
import { Idea, IdeaCreate, IdeaUpdate, ConvertToProjectResponse } from '../types/ideas';

// 创建axios实例
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    if (config.url && !config.url.startsWith(ENV.API_PREFIX) && !config.url.startsWith('http')) {
      config.url = ENV.API_PREFIX + config.url;
    }
    
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Ideas API Error:', error);
    return Promise.reject(error);
  }
);

export const ideasApi = {
  // 获取Ideas列表
  getIdeas: async (params?: {
    skip?: number;
    limit?: number;
    maturity?: string;
    responsible_person?: string;
  }): Promise<Idea[]> => {
    const response = await api.get('/ideas', { params });
    return response.data;
  },

  // 获取单个Idea
  getIdea: async (id: number): Promise<Idea> => {
    const response = await api.get(`/ideas/${id}`);
    return response.data;
  },

  // 创建Idea
  createIdea: async (data: IdeaCreate): Promise<Idea> => {
    const response = await api.post('/ideas', data);
    return response.data;
  },

  // 更新Idea
  updateIdea: async (id: number, data: IdeaUpdate): Promise<Idea> => {
    const response = await api.put(`/ideas/${id}`, data);
    return response.data;
  },

  // 删除Idea
  deleteIdea: async (id: number): Promise<void> => {
    await api.delete(`/ideas/${id}`);
  },

  // 转化为研究项目
  convertToProject: async (id: number): Promise<ConvertToProjectResponse> => {
    const response = await api.post(`/ideas/${id}/convert-to-project`);
    return response.data;
  },
};