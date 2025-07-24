#!/bin/bash

# 调试迁移执行问题的脚本

echo "=== 调试迁移执行问题 ==="
echo ""

echo "1. 检查VPS部署日志中的迁移部分："
echo "请在VPS上运行："
echo "grep -A5 -B5 '迁移' /var/log/research-dashboard-deploy.log | tail -50"
echo ""

echo "2. 检查vps-update.sh的执行日志："
echo "journalctl -u research-backend -n 200 | grep -E '(migration|迁移)'"
echo ""

echo "3. 检查GitHub Actions的部署日志"
echo "查看最近的部署是否有执行迁移"
echo ""

echo "4. 测试迁移检测逻辑："
cat > test_migration_detection.sh << 'EOF'
#!/bin/bash

echo "当前目录: $(pwd)"
echo "检查migrations/migration.py是否存在:"

if [ -f "migrations/migration.py" ]; then
    echo "✅ 找到 migrations/migration.py"
else
    echo "❌ 未找到 migrations/migration.py"
fi

echo ""
echo "列出migrations目录内容:"
ls -la migrations/ 2>/dev/null || echo "migrations目录不存在"

echo ""
echo "从backend目录查看:"
cd /var/www/research-dashboard/backend
echo "当前目录: $(pwd)"
if [ -f "migrations/migration.py" ]; then
    echo "✅ 找到 migrations/migration.py"
else
    echo "❌ 未找到 migrations/migration.py"
fi
EOF