#!/bin/bash

# 批量更新部署脚本中的健康检查端点

echo "更新部署脚本中的健康检查端点..."
echo "将 /api/health 改为 /health"
echo "=================================="

# 需要更新的文件列表
FILES=(
    "fix-auth-issue.sh"
    "emergency-404-diagnose.sh"
    "db-diagnose.sh"
    "quick-diagnose-502.sh"
    "service-monitor.sh"
    "comprehensive-fix.sh"
    "post-deploy-verify.sh"
    "quick-restart-backend.sh"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "更新 $file ..."
        # 替换 /api/health 为 /health
        sed -i.bak 's|/api/health|/health|g' "$file"
        echo "✅ 完成"
    else
        echo "⚠️ 文件不存在: $file"
    fi
done

echo ""
echo "=================================="
echo "✅ 所有脚本更新完成！"
echo ""
echo "注意：已创建 .bak 备份文件，如需恢复请使用备份文件。"