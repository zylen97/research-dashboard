#!/bin/bash

# 温和恢复脚本 - 理性修复服务问题
# 按照正常工作流恢复系统

set -e

echo "🔧 开始温和恢复系统..."

# 1. 检查当前服务状态
echo "📋 检查当前服务状态..."
echo "后端服务状态:"
systemctl is-active research-backend || echo "后端服务未运行"

echo "Nginx状态:"
systemctl is-active nginx || echo "Nginx未运行"

# 2. 确保后端服务正常
echo "🐍 确保后端服务正常..."
cd /var/www/research-dashboard/backend

# 检查数据库文件
if [ -f research_dashboard.db ]; then
    echo "✅ 数据库文件存在"
else
    echo "❌ 数据库文件不存在，可能需要初始化"
fi

# 重启后端服务
systemctl restart research-backend
sleep 5

# 检查后端是否正常启动
if systemctl is-active --quiet research-backend; then
    echo "✅ 后端服务运行正常"
    
    # 测试后端API
    if curl -f http://localhost:8080/ > /dev/null 2>&1; then
        echo "✅ 后端API响应正常"
    else
        echo "❌ 后端API无响应"
        echo "检查后端日志:"
        journalctl -u research-backend --no-pager -n 5
    fi
else
    echo "❌ 后端服务启动失败"
    echo "检查后端日志:"
    journalctl -u research-backend --no-pager -n 10
    exit 1
fi

# 3. 恢复前端文件（使用已构建的版本）
echo "📋 恢复前端文件..."
cd /var/www/research-dashboard

# 检查是否有构建文件
if [ -d "frontend/build" ]; then
    echo "✅ 找到构建文件，部署到Web目录"
    sudo rm -rf /var/www/html/*
    sudo cp -r frontend/build/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html/
    
    # 检查关键文件
    if [ -f /var/www/html/index.html ]; then
        echo "✅ index.html部署成功"
    else
        echo "❌ index.html部署失败"
    fi
else
    echo "❌ 没有找到构建文件，需要重新构建"
    cd frontend
    npm run build
    sudo cp -r build/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html/
fi

# 4. 确保Nginx配置正确
echo "⚙️ 检查Nginx配置..."

# 使用简单的3001端口配置
if [ -f /etc/nginx/sites-available/research-dashboard-3001 ]; then
    sudo ln -sf /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-enabled/
    echo "✅ 启用3001端口配置"
else
    echo "❌ 3001端口配置文件不存在"
fi

# 清理可能冲突的配置
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/research-dashboard

# 测试Nginx配置
if sudo nginx -t; then
    echo "✅ Nginx配置语法正确"
    sudo systemctl reload nginx
    
    # 检查Nginx状态
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx运行正常"
    else
        echo "❌ Nginx重载失败"
        systemctl restart nginx
    fi
else
    echo "❌ Nginx配置有语法错误"
    sudo nginx -t
    exit 1
fi

# 5. 验证系统状态
echo "🔍 验证系统状态..."

echo "端口监听状态:"
echo "后端8080端口:"
netstat -tlnp | grep :8080 || echo "后端端口未监听"

echo "前端3001端口:"
netstat -tlnp | grep :3001 || echo "前端端口未监听"

# 6. 最终测试
echo "🌐 最终连接测试..."
sleep 2

echo "测试前端页面:"
if curl -f http://localhost:3001/ > /dev/null 2>&1; then
    echo "✅ 前端页面正常"
else
    echo "❌ 前端页面异常"
fi

echo "测试API代理:"
if curl -f http://localhost:3001/api/ > /dev/null 2>&1; then
    echo "✅ API代理正常"
else
    echo "❌ API代理异常"
fi

echo ""
echo "🎉 温和恢复完成！"
echo "🌐 访问地址: http://45.149.156.216:3001"
echo ""
echo "📝 如果仍有问题，请检查："
echo "  - systemctl status research-backend"
echo "  - systemctl status nginx"
echo "  - tail -f /var/log/nginx/error.log"