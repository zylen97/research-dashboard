#!/bin/bash

# 快速修复502错误脚本
# 在VPS上运行此脚本来解决端口和配置问题

set -e

echo "🔧 开始修复502错误..."

# 1. 检查并开放3001端口
echo "🔥 开放3001端口..."
ufw allow 3001
ufw status | grep 3001 || echo "端口3001已开放"

# 2. 删除可能冲突的旧配置
echo "🧹 清理旧的Nginx配置..."
rm -f /etc/nginx/sites-enabled/research-dashboard
rm -f /etc/nginx/sites-enabled/default

# 3. 确保新配置正确启用
echo "✅ 启用新的3001端口配置..."
ln -sf /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-enabled/

# 4. 检查Nginx配置语法
echo "🔍 检查Nginx配置..."
nginx -t

# 5. 重启相关服务
echo "🔄 重启服务..."
systemctl restart research-backend
sleep 3
systemctl reload nginx

# 6. 检查服务状态
echo "📋 检查服务状态..."
echo "后端服务状态："
systemctl is-active research-backend && echo "✅ 后端运行正常" || echo "❌ 后端异常"

echo "Nginx状态："
systemctl is-active nginx && echo "✅ Nginx运行正常" || echo "❌ Nginx异常"

# 7. 检查端口监听
echo "🔍 检查端口监听..."
echo "后端端口8080："
netstat -tlnp | grep :8080 || echo "❌ 后端端口8080未监听"

echo "前端端口3001："
netstat -tlnp | grep :3001 || echo "❌ 前端端口3001未监听"

# 8. 测试连接
echo "🌐 测试连接..."
echo "测试后端API："
curl -f http://localhost:8080/api/health 2>/dev/null && echo "✅ 后端API正常" || echo "❌ 后端API异常"

echo "测试前端3001："
curl -f http://localhost:3001 2>/dev/null && echo "✅ 前端3001正常" || echo "❌ 前端3001异常"

# 9. 显示访问信息
echo ""
echo "🎉 修复完成！"
echo "🌐 访问地址："
echo "  - 新地址：http://45.149.156.216:3001"
echo "  - 如果仍有问题，请检查防火墙和服务日志"
echo ""
echo "🔍 故障排除命令："
echo "  - sudo systemctl status research-backend"
echo "  - sudo systemctl status nginx"
echo "  - sudo tail -f /var/log/nginx/error.log"
echo "  - sudo journalctl -u research-backend -f"