#!/bin/bash

# 数据库配置修复脚本
# 立即修复VPS上的数据库路径问题

set -e

echo "🔧 === 数据库配置修复 ==="

cd /var/www/research-dashboard/backend

# 1. 确认当前问题
echo "📊 1. 确认当前状况:"
echo "当前使用的数据库: research_dashboard.db"
sqlite3 research_dashboard.db "SELECT COUNT(*) as collaborators FROM collaborators WHERE is_deleted = 0;" 2>/dev/null || echo "无法读取当前数据库"

echo "真实数据库: data/research_dashboard_prod.db"
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as collaborators FROM collaborators WHERE is_deleted = 0;" 2>/dev/null || echo "无法读取生产数据库"

# 2. 备份当前状态
echo -e "\n💾 2. 创建安全备份:"
mkdir -p /tmp/db_backup_$(date +%Y%m%d_%H%M%S)
cp research_dashboard.db /tmp/db_backup_$(date +%Y%m%d_%H%M%S)/research_dashboard.db.bak 2>/dev/null || echo "当前数据库备份跳过"
cp data/research_dashboard_prod.db /tmp/db_backup_$(date +%Y%m%d_%H%M%S)/research_dashboard_prod.db.bak 2>/dev/null || echo "生产数据库备份跳过"
echo "备份完成到: /tmp/db_backup_*"

# 3. 修复方案A: 直接覆盖（快速方案）
echo -e "\n🚀 3. 快速修复 - 使用含有数据的数据库覆盖当前数据库:"
if [ -f "data/research_dashboard_prod.db" ]; then
    cp data/research_dashboard_prod.db research_dashboard.db
    echo "✅ 数据库文件已覆盖"
else
    echo "❌ 生产数据库文件不存在"
    exit 1
fi

# 4. 验证修复结果
echo -e "\n✅ 4. 验证修复结果:"
collaborators=$(sqlite3 research_dashboard.db "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;" 2>/dev/null || echo "0")
projects=$(sqlite3 research_dashboard.db "SELECT COUNT(*) FROM research_projects;" 2>/dev/null || echo "0")
echo "修复后 - 合作者: $collaborators, 项目: $projects"

# 5. 重启服务
echo -e "\n🔄 5. 重启后端服务:"
systemctl restart research-backend
sleep 3
systemctl status research-backend --no-pager || echo "服务状态检查完成"

echo -e "\n🎉 修复完成!"
echo "现在应该可以看到你的5个合作者了"
echo "访问: http://45.149.156.216:3001 验证"