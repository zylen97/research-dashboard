#!/bin/bash

# 自动诊断502错误脚本
# 自动部署到VPS并执行诊断

set -e

echo "🔍 开始自动诊断502错误..."

# 1. 检查后端API具体路径
echo "=================== 后端API测试 ==================="
echo "🔍 测试后端根路径..."
curl -s http://localhost:8080/ || echo "❌ 后端根路径连接失败"

echo "🔍 测试API文档路径..."
curl -s http://localhost:8080/docs || echo "❌ API文档路径连接失败"

echo "🔍 测试用户API..."
curl -s http://localhost:8080/api/users || echo "❌ 用户API连接失败"

# 2. 检查Nginx配置和日志
echo "=================== Nginx诊断 ==================="
echo "🔍 Nginx配置文件内容:"
cat /etc/nginx/sites-enabled/research-dashboard-3001

echo "🔍 Nginx错误日志:"
tail -10 /var/log/nginx/error.log

# 3. 检查后端服务状态
echo "=================== 后端服务诊断 ==================="
echo "🔍 后端服务状态:"
systemctl status research-backend --no-pager -l

echo "🔍 后端服务日志:"
journalctl -u research-backend --no-pager -n 10

# 4. 检查静态文件
echo "=================== 静态文件检查 ==================="
echo "🔍 Web根目录内容:"
ls -la /var/www/html/ | head -10

echo "🔍 检查index.html是否存在:"
test -f /var/www/html/index.html && echo "✅ index.html存在" || echo "❌ index.html不存在"

# 5. 详细测试3001端口
echo "=================== 端口连接测试 ==================="
echo "🔍 详细测试3001端口响应:"
timeout 10 curl -v http://localhost:3001/ 2>&1 | head -20

# 6. 检查进程和端口占用
echo "=================== 进程和端口检查 ==================="
echo "🔍 检查3001端口进程:"
lsof -i :3001 || echo "无进程监听3001端口"

echo "🔍 检查8080端口进程:"
lsof -i :8080 || echo "无进程监听8080端口"

# 7. 尝试修复常见问题
echo "=================== 自动修复尝试 ==================="

# 检查是否有重复的Nginx配置
echo "🔧 检查并清理重复配置..."
find /etc/nginx/sites-enabled/ -name "*research*" -type l

# 重新生成前端文件（如果需要）
if [ ! -f /var/www/html/index.html ]; then
    echo "🔨 重新部署前端文件..."
    cd /var/www/research-dashboard/frontend
    npm run build
    sudo rm -rf /var/www/html/*
    sudo cp -r build/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html/
fi

# 重启服务
echo "🔄 重启所有相关服务..."
systemctl restart research-backend
sleep 3
systemctl reload nginx

# 8. 最终测试
echo "=================== 最终验证 ==================="
echo "🌐 最终连接测试:"
sleep 2

echo "测试后端:"
curl -s -o /dev/null -w "后端状态码: %{http_code}\n" http://localhost:8080/api/users

echo "测试前端:"
curl -s -o /dev/null -w "前端状态码: %{http_code}\n" http://localhost:3001/

echo "🎉 诊断完成！请检查上面的输出信息"
echo "🌐 如果状态码是200，访问: http://45.149.156.216:3001"