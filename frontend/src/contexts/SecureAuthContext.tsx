/**
 * 🔒 Secure Authentication Context
 * 安全的认证上下文 - 替代不安全的localStorage Token存储
 * 
 * 改进：
 * 1. 使用httpOnly cookies存储refresh token
 * 2. 内存存储access token（页面刷新时重新获取）
 * 3. 自动token刷新机制
 * 4. 安全的登出处理
 * 5. 防XSS和CSRF攻击
 * 
 * 创建时间：2025-07-24
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { message } from 'antd';
import axios, { AxiosError } from 'axios';

// 类型定义
interface User {
  id: number;
  username: string;
  email?: string;
  role?: string;
  must_change_password?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiry: number | null;
}

interface LoginCredentials {
  username: string;
  password: string;
  remember_me?: boolean;
}

interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  checkSession: () => Promise<void>;
}

// Action types
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string; expiresAt: number } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN_SUCCESS'; payload: { accessToken: string; expiresAt: number } }
  | { type: 'REFRESH_TOKEN_FAILURE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SESSION_EXPIRED' };

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        sessionExpiry: action.payload.expiresAt,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        accessToken: null,
        sessionExpiry: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        accessToken: null,
        sessionExpiry: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'REFRESH_TOKEN_SUCCESS':
      return {
        ...state,
        accessToken: action.payload.accessToken,
        sessionExpiry: action.payload.expiresAt,
        isAuthenticated: true,
        error: null,
      };

    case 'REFRESH_TOKEN_FAILURE':
      return {
        ...state,
        user: null,
        accessToken: null,
        sessionExpiry: null,
        isAuthenticated: false,
        error: 'Session expired, please login again',
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SESSION_EXPIRED':
      return {
        ...state,
        user: null,
        accessToken: null,
        sessionExpiry: null,
        isAuthenticated: false,
        error: 'Your session has expired. Please login again.',
      };

    default:
      return state;
  }
};

// Initial state
const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionExpiry: null,
};

// Context
const SecureAuthContext = createContext<AuthContextType | undefined>(undefined);

// Secure API client
class SecureApiClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseURL = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8080' 
      : window.location.origin;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    const config = {
      method,
      url: `${this.baseURL}/api${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
      },
      withCredentials: true, // 重要：发送cookies
      timeout: 10000,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response?.status === 401) {
          // Token可能过期，清除认证状态
          throw new Error('UNAUTHORIZED');
        }
      }
      throw error;
    }
  }

  async login(credentials: LoginCredentials) {
    return this.request<{
      access_token: string;
      token_type: string;
      expires_in: number;
      user: User;
    }>('POST', '/auth/login', credentials);
  }

  async refreshToken() {
    return this.request<{
      access_token: string;
      expires_in: number;
    }>('POST', '/auth/refresh');
  }

  async logout() {
    return this.request('POST', '/auth/logout');
  }

  async getCurrentUser() {
    return this.request<User>('GET', '/auth/me');
  }
}

// Hook to use auth context
export const useSecureAuth = (): AuthContextType => {
  const context = useContext(SecureAuthContext);
  if (!context) {
    throw new Error('useSecureAuth must be used within a SecureAuthProvider');
  }
  return context;
};

// Provider component
interface SecureAuthProviderProps {
  children: React.ReactNode;
}

export const SecureAuthProvider: React.FC<SecureAuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const apiClient = new SecureApiClient();

  // Set access token in API client when it changes
  useEffect(() => {
    apiClient.setAccessToken(state.accessToken);
  }, [state.accessToken]);

  // Auto refresh token timer
  useEffect(() => {
    if (!state.isAuthenticated || !state.sessionExpiry) return;

    const timeUntilExpiry = state.sessionExpiry - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 60 * 1000); // 5分钟前刷新，最少1分钟

    const timer = setTimeout(() => {
      refreshToken();
    }, refreshTime);

    return () => clearTimeout(timer);
  }, [state.sessionExpiry, state.isAuthenticated]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await apiClient.login(credentials);
      
      const expiresAt = Date.now() + (response.expires_in * 1000);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          accessToken: response.access_token,
          expiresAt,
        },
      });

      // 检查是否需要更改密码
      if (response.user.must_change_password) {
        message.warning('请立即更改您的密码以确保账户安全');
      }

      message.success('登录成功');
      return true;

    } catch (error: any) {
      let errorMessage = '登录失败';
      
      if (error.response?.status === 401) {
        errorMessage = '用户名或密码错误';
      } else if (error.response?.status === 429) {
        errorMessage = '登录尝试过于频繁，请稍后再试';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      message.error(errorMessage);
      return false;
    }
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.refreshToken();
      
      const expiresAt = Date.now() + (response.expires_in * 1000);
      
      dispatch({
        type: 'REFRESH_TOKEN_SUCCESS',
        payload: {
          accessToken: response.access_token,
          expiresAt,
        },
      });

      return true;

    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        dispatch({ type: 'REFRESH_TOKEN_FAILURE' });
        message.warning('会话已过期，请重新登录');
      }
      return false;
    }
  }, []);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
      
      // 清除所有可能的token残留
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      sessionStorage.clear();
      
      message.info('已安全退出');
    }
  }, []);

  // Check session function
  const checkSession = useCallback(async (): Promise<void> => {
    if (state.isAuthenticated) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // 尝试使用refresh token获取新的access token
      const success = await refreshToken();
      
      if (success) {
        // 获取用户信息
        const user = await apiClient.getCurrentUser();
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user,
            accessToken: state.accessToken!,
            expiresAt: state.sessionExpiry!,
          },
        });
      }
    } catch (error) {
      // 静默失败，用户需要重新登录
      console.debug('Session check failed:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.isAuthenticated, state.accessToken, state.sessionExpiry]);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  // Handle visibility change (tab focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && state.isAuthenticated) {
        // 页面重新获得焦点时检查session
        const now = Date.now();
        if (state.sessionExpiry && now >= state.sessionExpiry) {
          dispatch({ type: 'SESSION_EXPIRED' });
          message.warning('会话已过期，请重新登录');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isAuthenticated, state.sessionExpiry]);

  const contextValue: AuthContextType = {
    state,
    login,
    logout,
    refreshToken,
    clearError,
    checkSession,
  };

  return (
    <SecureAuthContext.Provider value={contextValue}>
      {children}
    </SecureAuthContext.Provider>
  );
};

// HOC for protecting routes
export const withSecureAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { state } = useSecureAuth();

    if (!state.isAuthenticated) {
      return <div>Please login to access this page</div>;
    }

    return <Component {...props} />;
  };
};

export default SecureAuthProvider;