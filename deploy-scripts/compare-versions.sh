#!/bin/bash

# 🔍 版本对比脚本 - 检查本地和VPS代码版本是否一致

VPS_HOST="45.149.156.216"
VPS_USER="root"
PROJECT_DIR="/var/www/research-dashboard"

echo "🔍 对比本地和VPS代码版本..."

# 1. 获取本地Git信息
echo "📍 本地代码版本："
LOCAL_COMMIT=$(git rev-parse HEAD)
LOCAL_COMMIT_SHORT=$(git rev-parse --short HEAD)
LOCAL_MESSAGE=$(git log -1 --pretty=format:"%s")
echo "  Commit: $LOCAL_COMMIT_SHORT"
echo "  Message: $LOCAL_MESSAGE"
echo "  Time: $(git log -1 --pretty=format:"%cd")"

echo ""

# 2. 尝试获取VPS代码信息（如果SSH可用）
echo "📍 VPS代码版本："
if timeout 10 ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "cd $PROJECT_DIR && git rev-parse --short HEAD && git log -1 --pretty=format:'%s' && echo && git log -1 --pretty=format:'%cd'" 2>/dev/null; then
    echo ""
    echo "✅ 获取VPS版本信息成功"
else
    echo "❌ 无法获取VPS版本信息 (SSH连接失败)"
fi

echo ""

# 3. 检查GitHub Actions状态
echo "🔍 检查部署状态..."
echo "📱 GitHub Actions页面: https://github.com/zylen97/research-dashboard/actions"

# 4. 检查前端构建文件
echo ""
echo "📦 检查本地构建："
if [ -f "frontend/build.tar.gz" ]; then
    BUILD_SIZE=$(ls -lh frontend/build.tar.gz | awk '{print $5}')
    BUILD_TIME=$(ls -l frontend/build.tar.gz | awk '{print $6, $7, $8}')
    echo "✅ 构建文件存在: $BUILD_SIZE ($BUILD_TIME)"
else
    echo "❌ 构建文件不存在"
fi

# 5. 检查关键修改文件
echo ""
echo "🔍 检查关键修改文件："
echo "  IdeaDiscovery.tsx 修改:"
if grep -q "md={8} lg={6} xl={5}" frontend/src/pages/IdeaDiscovery.tsx; then
    echo "    ✅ AI配置列宽度已修改"
else
    echo "    ❌ AI配置列宽度未修改"
fi

echo "  EmbeddedAIConfig.tsx 修改:"
if grep -q "useState(true)" frontend/src/components/idea/EmbeddedAIConfig.tsx; then
    echo "    ✅ AI配置默认展开已修改"
else
    echo "    ❌ AI配置默认展开未修改"
fi

# 6. 测试当前VPS前端内容
echo ""
echo "🌐 检查VPS前端实际内容..."
if curl -s http://$VPS_HOST:3001 | grep -q "研究Idea发掘与AI配置中心"; then
    echo "✅ VPS前端可访问且包含预期内容"
else
    echo "❌ VPS前端内容异常"
fi

echo ""
echo "🎯 问题诊断建议："
echo "1. 如果版本不一致，说明部署未生效"
echo "2. 如果构建文件不存在，需要重新构建"
echo "3. 如果修改文件正确但VPS版本旧，说明部署流程有问题"
echo "4. 访问 GitHub Actions 页面检查部署日志"

echo ""
echo "🚀 手动强制部署命令："
echo "./deploy-scripts/force-deploy-now.sh"