#!/bin/bash

# 新Web应用快速部署脚本模板
# 使用此脚本可以快速在VPS上部署新的Web应用到指定端口

set -e

# 配置变量（根据实际应用修改）
APP_NAME="{{APP_NAME}}"                    # 应用名称，如：my-blog
APP_PORT="{{APP_PORT}}"                    # 前端端口，如：3002
BACKEND_PORT="{{BACKEND_PORT}}"            # 后端端口，如：8081（可选）
SERVER_IP="45.149.156.216"                # 服务器IP
WEB_ROOT="/var/www/${APP_NAME}"            # Web根目录
API_PATH="/api"                           # API路径前缀

# 源码和构建配置
REPO_URL="{{REPO_URL}}"                   # Git仓库地址
BUILD_COMMAND="{{BUILD_COMMAND}}"         # 构建命令，如：npm run build
BUILD_OUTPUT="{{BUILD_OUTPUT}}"           # 构建输出目录，如：build, dist

echo "🚀 开始部署新应用：${APP_NAME}"
echo "📋 配置信息："
echo "  - 应用名称：${APP_NAME}"
echo "  - 前端端口：${APP_PORT}"
echo "  - 后端端口：${BACKEND_PORT}"
echo "  - Web根目录：${WEB_ROOT}"

# 1. 创建应用目录
echo "📁 创建应用目录..."
sudo mkdir -p ${WEB_ROOT}
sudo chown -R www-data:www-data ${WEB_ROOT}

# 2. 克隆代码（如果是新部署）
if [ ! -d "/opt/${APP_NAME}" ]; then
    echo "📥 克隆代码..."
    cd /opt
    git clone ${REPO_URL} ${APP_NAME}
    cd ${APP_NAME}
else
    echo "🔄 更新代码..."
    cd /opt/${APP_NAME}
    git pull origin main
fi

# 3. 构建前端
echo "🔨 构建前端..."
${BUILD_COMMAND}

# 4. 复制构建文件
echo "📋 复制文件到Web目录..."
sudo rm -rf ${WEB_ROOT}/*
sudo cp -r ${BUILD_OUTPUT}/* ${WEB_ROOT}/
sudo chown -R www-data:www-data ${WEB_ROOT}

# 5. 创建Nginx配置
echo "⚙️ 创建Nginx配置..."
NGINX_CONFIG="/etc/nginx/sites-available/${APP_NAME}-${APP_PORT}"

# 从模板创建配置文件
sudo cp /var/www/research-dashboard/deployment/templates/nginx-template.conf ${NGINX_CONFIG}

# 替换模板变量
sudo sed -i "s/{{PORT}}/${APP_PORT}/g" ${NGINX_CONFIG}
sudo sed -i "s/{{SERVER_IP}}/${SERVER_IP}/g" ${NGINX_CONFIG}
sudo sed -i "s|{{WEB_ROOT}}|${WEB_ROOT}|g" ${NGINX_CONFIG}
sudo sed -i "s|{{API_PATH}}|${API_PATH}|g" ${NGINX_CONFIG}
sudo sed -i "s/{{BACKEND_PORT}}/${BACKEND_PORT}/g" ${NGINX_CONFIG}

# 启用站点
sudo ln -sf ${NGINX_CONFIG} /etc/nginx/sites-enabled/

# 6. 开放防火墙端口
echo "🔥 开放防火墙端口..."
sudo ufw allow ${APP_PORT}

# 7. 测试并重启Nginx
echo "🔍 测试Nginx配置..."
sudo nginx -t

echo "🔄 重启Nginx..."
sudo systemctl reload nginx

# 8. 验证部署
echo "✅ 验证部署..."
if curl -f http://localhost:${APP_PORT} > /dev/null 2>&1; then
    echo "✅ 应用部署成功！"
    echo "🌐 访问地址：http://${SERVER_IP}:${APP_PORT}"
else
    echo "❌ 应用部署可能存在问题，请检查日志"
    echo "🔍 检查命令："
    echo "  - sudo nginx -t"
    echo "  - sudo systemctl status nginx"
    echo "  - curl http://localhost:${APP_PORT}"
fi

echo "🎉 部署完成！"

# 使用说明：
# 1. 复制此脚本并重命名
# 2. 修改顶部的配置变量
# 3. 运行：sudo bash deploy-new-app.sh