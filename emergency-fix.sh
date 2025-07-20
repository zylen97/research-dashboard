#!/bin/bash

# 紧急修复脚本 - 直接在VPS上修复API配置问题
# 彻底解决CORS问题

set -e

echo "🚨 紧急修复API配置问题..."

# 1. 停止所有服务
echo "🛑 停止服务..."
systemctl stop nginx
systemctl stop research-backend

# 2. 彻底清理前端文件
echo "🧹 彻底清理前端文件..."
rm -rf /var/www/html/*

# 3. 进入项目目录重新构建
echo "📁 进入项目目录..."
cd /var/www/research-dashboard

# 4. 强制更新代码
echo "🔄 强制更新代码..."
git fetch --all
git reset --hard origin/main

# 5. 修改API配置文件（直接在VPS上修改）
echo "⚡ 直接修改API配置..."
cat > frontend/src/config/api.ts << 'EOF'
// API配置管理 - VPS直接修复版本
const getApiBaseUrl = (): string => {
  // 开发环境
  if (process.env['NODE_ENV'] === 'development') {
    return 'http://localhost:8080';
  }
  
  // 生产环境强制使用3001端口
  return 'http://45.149.156.216:3001';
};

// 导出API配置
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
} as const;

// 构建完整的API URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// API端点常量
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    ME: '/api/auth/me',
  },
  RESEARCH: {
    LIST: '/api/research',
    CREATE: '/api/research',
    UPDATE: (id: number) => `/api/research/${id}`,
    DELETE: (id: number) => `/api/research/${id}`,
    COMMUNICATION_LOGS: (id: number) => `/api/research/${id}/logs`,
    TOGGLE_TODO: (id: number) => `/api/research/${id}`,
  },
  COLLABORATORS: {
    LIST: '/api/collaborators',
    CREATE: '/api/collaborators',
    UPDATE: (id: number) => `/api/collaborators/${id}`,
    DELETE: (id: number) => `/api/collaborators/${id}`,
  },
  LITERATURE: {
    LIST: '/api/literature',
    CREATE: '/api/literature',
    UPDATE: (id: number) => `/api/literature/${id}`,
    DELETE: (id: number) => `/api/literature/${id}`,
  },
  IDEAS: {
    LIST: '/api/ideas',
    CREATE: '/api/ideas',
    UPDATE: (id: number) => `/api/ideas/${id}`,
    DELETE: (id: number) => `/api/ideas/${id}`,
  },
} as const;

console.log('🔧 API配置已修复，BASE_URL:', API_CONFIG.BASE_URL);
EOF

# 6. 重新构建前端
echo "🔨 重新构建前端..."
cd frontend
rm -rf build node_modules/.cache .eslintcache
npm ci
npm run build

# 7. 部署新的前端文件
echo "📋 部署新的前端文件..."
cp -r build/* /var/www/html/
chown -R www-data:www-data /var/www/html/

# 8. 重启服务
echo "🔄 重启服务..."
cd /var/www/research-dashboard
systemctl start research-backend
sleep 3
systemctl start nginx

# 9. 验证修复
echo "✅ 验证修复结果..."
sleep 2

echo "测试后端API:"
curl -s -o /dev/null -w "后端状态码: %{http_code}\n" http://localhost:8080/

echo "测试前端3001:"
curl -s -o /dev/null -w "前端状态码: %{http_code}\n" http://localhost:3001/

echo "测试API代理:"
curl -s -o /dev/null -w "API代理状态码: %{http_code}\n" http://localhost:3001/api/auth/me

echo ""
echo "🎉 紧急修复完成！"
echo "🌐 访问地址: http://45.149.156.216:3001"
echo "🔍 如果还有问题，检查浏览器控制台的API调用地址"