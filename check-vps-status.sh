#!/bin/bash

echo "=== 检查VPS状态 ==="
echo "时间: $(date)"
echo

# 检查前端服务状态
echo "📱 检查前端服务状态..."
systemctl status research-frontend --no-pager
echo

# 检查后端服务状态  
echo "🚀 检查后端服务状态..."
systemctl status research-backend --no-pager
echo

# 检查端口占用
echo "🔌 检查端口占用..."
echo "前端端口 3000:"
netstat -tlnp | grep :3000 || echo "端口3000未被占用"
echo "后端端口 8000:"
netstat -tlnp | grep :8000 || echo "端口8000未被占用"
echo

# 检查Git状态
echo "📂 检查Git状态..."
cd /opt/research-dashboard
echo "当前分支: $(git branch --show-current)"
echo "最新提交:"
git log --oneline -3
echo

# 检查前端构建状态
echo "🔨 检查前端构建..."
if [ -d "/opt/research-dashboard/frontend/dist" ]; then
    echo "✅ 前端dist目录存在"
    ls -la /opt/research-dashboard/frontend/dist/ | head -5
else
    echo "❌ 前端dist目录不存在"
fi
echo

# 检查nginx配置和状态
echo "🌐 检查nginx状态..."
systemctl status nginx --no-pager
echo

# 检查前端进程
echo "👀 检查前端进程..."
ps aux | grep -E "(npm|node|serve)" | grep -v grep || echo "未找到前端相关进程"
echo

# 检查日志
echo "📝 检查最近日志..."
echo "前端日志:"
journalctl -u research-frontend -n 10 --no-pager 2>/dev/null || echo "无前端日志"
echo
echo "后端日志:"
journalctl -u research-backend -n 5 --no-pager 2>/dev/null || echo "无后端日志"

echo "=== 检查完成 ==="