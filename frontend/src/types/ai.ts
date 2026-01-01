/**
 * AI配置相关类型定义
 */

// AI提供商类型
export type AIProvider = 'openai' | 'chatanywhere';

// AI配置（响应格式 - 不包含API密钥）
export interface AIConfig {
  provider: AIProvider;
  model: string;
  base_url?: string;
  temperature: number;
  max_tokens: number;
  has_api_key: boolean;
}

// AI配置更新请求（包含API密钥）
export interface AIConfigUpdate {
  provider?: AIProvider;
  api_key?: string;
  model?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
}

// AI测试请求
export interface AITestRequest extends AIConfigUpdate {
  provider: AIProvider;
  api_key: string;
  model: string;
}

// AI测试响应
export interface AITestResponse {
  success: boolean;
  message: string;
  response_time_ms?: number;
  sample_response?: string;
  error?: string;
}

// 预设的AI提供商配置
export const AI_PRESETS: Record<AIProvider, {
  name: string;
  default_base_url: string;
  default_models: string[];
  default_model: string;
}> = {
  openai: {
    name: 'OpenAI',
    default_base_url: 'https://api.openai.com/v1',
    default_models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4o'],
    default_model: 'gpt-3.5-turbo',
  },
  chatanywhere: {
    name: 'ChatAnywhere',
    default_base_url: 'https://api.chatanywhere.tech/v1',
    default_models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4o'],
    default_model: 'gpt-3.5-turbo',
  },
};

// 推荐的模型配置选项
export const MODEL_OPTIONS = [
  { label: 'GPT-3.5 Turbo (快速/经济)', value: 'gpt-3.5-turbo' },
  { label: 'GPT-4 (强大/昂贵)', value: 'gpt-4' },
  { label: 'GPT-4 Turbo (平衡)', value: 'gpt-4-turbo-preview' },
  { label: 'GPT-4O (最新)', value: 'gpt-4o' },
];
