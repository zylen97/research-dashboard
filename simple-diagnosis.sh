#!/bin/bash

# 简单诊断脚本 - 只检查不修复
# 专注于找出502错误的根本原因

echo "🔍 开始简单诊断502错误..."
echo "========================================"

# 1. 检查后端服务状态
echo "1. 检查后端服务状态:"
if systemctl is-active --quiet research-backend; then
    echo "✅ 后端服务运行中"
    
    # 检查服务详细状态
    echo "📋 后端服务详细信息:"
    systemctl status research-backend --no-pager -l | head -10
    
    # 检查端口监听
    echo "🔌 检查8080端口监听:"
    if netstat -tlnp | grep :8080; then
        echo "✅ 8080端口正在监听"
        
        # 直接测试后端
        echo "🌐 直接测试后端API:"
        curl -v http://localhost:8080/ 2>&1 | head -5 || echo "❌ 后端API无响应"
        
    else
        echo "❌ 8080端口未监听"
    fi
    
else
    echo "❌ 后端服务未运行"
    echo "📋 检查后端服务失败原因:"
    systemctl status research-backend --no-pager -l | tail -10
    
    echo "📋 最近的后端日志:"
    journalctl -u research-backend --no-pager -n 5
fi

echo ""
echo "========================================"

# 2. 检查Nginx状态
echo "2. 检查Nginx状态:"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx运行中"
    
    # 检查3001端口监听
    echo "🔌 检查3001端口监听:"
    if netstat -tlnp | grep :3001; then
        echo "✅ 3001端口正在监听"
    else
        echo "❌ 3001端口未监听"
    fi
    
    # 检查Nginx配置
    echo "⚙️ 检查Nginx配置:"
    if nginx -t 2>&1; then
        echo "✅ Nginx配置语法正确"
    else
        echo "❌ Nginx配置有语法错误"
    fi
    
    # 检查启用的站点
    echo "📁 启用的Nginx站点:"
    ls -la /etc/nginx/sites-enabled/
    
else
    echo "❌ Nginx未运行"
    echo "📋 Nginx状态:"
    systemctl status nginx --no-pager -l | tail -5
fi

echo ""
echo "========================================"

# 3. 检查前端文件
echo "3. 检查前端文件:"
if [ -f /var/www/html/index.html ]; then
    echo "✅ 前端index.html存在"
    echo "📁 Web目录内容:"
    ls -la /var/www/html/ | head -5
else
    echo "❌ 前端index.html不存在"
    echo "📁 Web目录内容:"
    ls -la /var/www/html/
fi

echo ""
echo "========================================"

# 4. 网络连接测试
echo "4. 网络连接测试:"

echo "🌐 测试前端页面 (3001端口):"
curl -s -o /dev/null -w "状态码: %{http_code}, 响应时间: %{time_total}s\n" http://localhost:3001/ || echo "❌ 连接失败"

echo "🌐 测试后端API (8080端口):"
curl -s -o /dev/null -w "状态码: %{http_code}, 响应时间: %{time_total}s\n" http://localhost:8080/ || echo "❌ 连接失败"

echo "🌐 测试API代理 (3001端口通过Nginx):"
curl -s -o /dev/null -w "状态码: %{http_code}, 响应时间: %{time_total}s\n" http://localhost:3001/api/ || echo "❌ 连接失败"

echo ""
echo "========================================"

# 5. 检查错误日志
echo "5. 最近的错误日志:"
echo "📋 Nginx错误日志 (最近5行):"
tail -5 /var/log/nginx/error.log 2>/dev/null || echo "无法读取Nginx错误日志"

echo ""
echo "📋 后端服务日志 (最近3行):"
journalctl -u research-backend --no-pager -n 3 2>/dev/null || echo "无法读取后端日志"

echo ""
echo "========================================"
echo "🎯 诊断完成！"
echo ""
echo "💡 根据上面的信息判断问题："
echo "   - 如果后端服务未运行 → 需要修复后端启动问题"
echo "   - 如果8080端口未监听 → 后端配置问题"
echo "   - 如果3001端口未监听 → Nginx配置问题"
echo "   - 如果前端文件不存在 → 需要重新部署前端"