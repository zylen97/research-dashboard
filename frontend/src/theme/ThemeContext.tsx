import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ThemeMode, getThemeConfig } from './index';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 从localStorage获取保存的主题，默认为light
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const savedTheme = localStorage.getItem('research-dashboard-theme');
      return (savedTheme as ThemeMode) || 'light';
    } catch {
      return 'light';
    }
  });

  // 切换主题
  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  // 设置主题
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  // 保存主题到localStorage
  useEffect(() => {
    try {
      localStorage.setItem('research-dashboard-theme', theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [theme]);

  // 设置CSS变量和body类名
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    // 移除之前的主题类
    body.classList.remove('light-theme', 'dark-theme');
    // 添加当前主题类
    body.classList.add(`${theme}-theme`);
    
    // 设置CSS变量
    if (theme === 'dark') {
      root.style.setProperty('--bg-color', '#141414');
      root.style.setProperty('--container-bg', '#1f1f1f');
      root.style.setProperty('--text-color', '#ffffff');
      root.style.setProperty('--border-color', '#434343');
    } else {
      root.style.setProperty('--bg-color', '#f5f5f5');
      root.style.setProperty('--container-bg', '#ffffff');
      root.style.setProperty('--text-color', '#000000');
      root.style.setProperty('--border-color', '#d9d9d9');
    }
  }, [theme]);

  // 获取当前主题配置
  const themeConfig = getThemeConfig(theme);

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig} locale={zhCN}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

// 使用主题的钩子
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};