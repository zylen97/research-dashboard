import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { message } from 'antd';
import { 
  User, 
  AuthToken, 
  AuthContextType, 
  UserLogin
} from '../types';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时检查本地存储的token
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('解析本地存储的认证信息失败:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const saveAuthData = (authToken: AuthToken) => {
    setToken(authToken.access_token);
    setUser(authToken.user);
    
    localStorage.setItem('auth_token', authToken.access_token);
    localStorage.setItem('auth_user', JSON.stringify(authToken.user));
  };

  const clearAuthData = () => {
    setToken(null);
    setUser(null);
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const login = async (credentials: UserLogin): Promise<AuthToken> => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '登录失败');
      }

      const authToken: AuthToken = await response.json();
      saveAuthData(authToken);
      message.success('登录成功');
      return authToken;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
      throw error;
    }
  };

  const logout = () => {
    clearAuthData();
    message.success('已退出登录');
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};