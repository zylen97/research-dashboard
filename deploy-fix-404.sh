#!/bin/bash

# 快速部署404修复到VPS

echo "🔧 部署404修复到VPS"
echo "====================="
echo ""

# 1. 提交代码
echo "1️⃣ 提交修复代码..."
git add -A
git commit -m "fix: Remove /api prefix from backend routes to match nginx proxy configuration

- Updated all route prefixes in main.py to remove /api
- Fixed health check endpoint from /api/health to /health
- Updated deployment scripts to use new health check endpoint
- Aligned backend routes with nginx proxy_pass configuration"

git push origin main

echo ""
echo "2️⃣ 部署到VPS..."
echo "请运行以下命令："
echo ""
echo "  ./deploy-scripts/deploy.sh --backend"
echo ""
echo "或者快速重启后端："
echo ""
echo "  ./deploy-scripts/quick-restart-backend.sh"
echo ""
echo "✅ 修复内容："
echo "  - 后端路由移除 /api 前缀"
echo "  - 健康检查端点改为 /health"
echo "  - 部署脚本已更新"
echo ""
echo "📝 测试方法："
echo "  - 访问 http://45.149.156.216:3001"
echo "  - 检查前端是否正常加载数据"