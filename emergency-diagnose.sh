#!/bin/bash

# 🚨 紧急数据恢复诊断脚本
# 检查VPS上的数据库和备份状态

echo "🚨 紧急诊断开始..."
echo "时间: $(date)"
echo "=========================================="

# 进入项目目录
cd /var/www/research-dashboard/backend || {
    echo "❌ 无法进入项目目录!"
    exit 1
}

echo "📍 当前目录: $(pwd)"
echo ""

# 1. 检查数据库文件状态
echo "🔍 1. 检查数据库文件状态:"
if [ -d "data" ]; then
    ls -la data/*.db 2>/dev/null || echo "   ❌ 没有找到数据库文件!"
    echo ""
    
    # 检查文件大小
    echo "📊 数据库文件大小:"
    du -sh data/*.db 2>/dev/null || echo "   ❌ 无法获取文件大小"
    echo ""
else
    echo "   ❌ data目录不存在!"
fi

# 2. 检查备份文件
echo "🔍 2. 检查备份文件:"
if [ -d "data" ]; then
    echo "   生产环境备份文件:"
    ls -la data/*prod*.backup* 2>/dev/null || echo "   ❌ 没有找到生产环境备份!"
    echo "   开发环境备份文件:"
    ls -la data/*dev*.backup* 2>/dev/null || echo "   ❌ 没有找到开发环境备份!"
    echo ""
fi

# 检查系统备份目录
echo "   系统备份目录:"
ls -la /opt/backups/research-dashboard/ 2>/dev/null || echo "   ❌ 没有找到系统备份目录!"
echo ""

# 3. 检查环境配置
echo "🔍 3. 检查环境配置:"
if [ -f ".env" ]; then
    echo "   环境配置内容:"
    grep -E "(ENVIRONMENT|DATABASE_URL)" .env 2>/dev/null || echo "   ❌ 无法读取环境配置"
else
    echo "   ❌ .env文件不存在!"
fi
echo ""

# 4. 检查服务状态
echo "🔍 4. 检查后端服务状态:"
systemctl is-active research-backend || echo "   ❌ 服务未运行"
echo ""

# 5. 检查迁移历史（如果数据库存在）
echo "🔍 5. 检查迁移历史:"
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "   生产环境迁移记录:"
    sqlite3 data/research_dashboard_prod.db "SELECT * FROM migration_history ORDER BY executed_at DESC LIMIT 5;" 2>/dev/null || echo "   ❌ 无法读取迁移历史"
    echo ""
    
    echo "   数据表统计:"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as user_count FROM users;" 2>/dev/null || echo "   ❌ 无法统计用户数量"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as project_count FROM research_projects;" 2>/dev/null || echo "   ❌ 无法统计项目数量"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as collaborator_count FROM collaborators;" 2>/dev/null || echo "   ❌ 无法统计合作者数量"
else
    echo "   ❌ 生产数据库文件不存在!"
fi

if [ -f "data/research_dashboard_dev.db" ]; then
    echo ""
    echo "   开发环境迁移记录:"
    sqlite3 data/research_dashboard_dev.db "SELECT * FROM migration_history ORDER BY executed_at DESC LIMIT 5;" 2>/dev/null || echo "   ❌ 无法读取开发环境迁移历史"
fi
echo ""

# 6. 检查最近的部署日志
echo "🔍 6. 检查最近的部署日志:"
if [ -f "/var/log/research-dashboard-deploy.log" ]; then
    echo "   最近10行部署日志:"
    tail -10 /var/log/research-dashboard-deploy.log 2>/dev/null || echo "   ❌ 无法读取部署日志"
else
    echo "   ❌ 部署日志文件不存在!"
fi
echo ""

# 7. 检查迁移脚本版本
echo "🔍 7. 检查迁移脚本版本:"
if [ -f "migrations/migration.py" ]; then
    grep "MIGRATION_VERSION" migrations/migration.py || echo "   ❌ 无法读取迁移版本"
else
    echo "   ❌ 迁移脚本不存在!"
fi

echo ""
echo "=========================================="
echo "🚨 诊断完成: $(date)"
echo ""

# 如果找到备份文件，提示恢复选项
echo "💡 发现的备份文件:"
find data/ -name "*.backup*" 2>/dev/null | head -5
find /opt/backups/research-dashboard/ -name "*backup*" 2>/dev/null | head -5

echo ""
echo "🚀 如果要恢复最新备份，执行:"
echo "   sudo systemctl stop research-backend"
echo "   cp [最新备份文件] data/research_dashboard_prod.db"
echo "   sudo systemctl start research-backend"