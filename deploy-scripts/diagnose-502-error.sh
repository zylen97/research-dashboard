#!/bin/bash

# 🚨 诊断502错误的紧急脚本
# 检查VPS上后端服务和migration状态

echo "🚨 诊断502 Bad Gateway错误..."
echo "时间: $(date)"
echo ""

echo "=== 1. 检查后端服务状态 ==="
systemctl status research-backend --no-pager | head -15

echo ""
echo "=== 2. 检查端口8080是否监听 ==="
netstat -tlnp | grep :8080 || echo "❌ 端口8080没有被监听"

echo ""
echo "=== 3. 检查最近的服务日志 ==="
journalctl -u research-backend -n 20 --no-pager

echo ""
echo "=== 4. 检查migration执行状态 ==="
cd /var/www/research-dashboard/backend || exit 1

if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 数据库文件存在"
    echo "数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    
    echo ""
    echo "检查migration_history表:"
    sqlite3 data/research_dashboard_prod.db "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 3;" || echo "❌ 无法查询migration_history"
    
    echo ""
    echo "检查collaborators表结构:"
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);" | grep -E "(level|deleted_at)" || echo "❌ 缺少必要字段"
    
    echo ""
    echo "检查collaborators数据:"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as total, COUNT(CASE WHEN level='senior' THEN 1 END) as senior FROM collaborators;" || echo "❌ 无法查询collaborators"
else
    echo "❌ 数据库文件不存在"
fi

echo ""
echo "=== 5. 尝试手动启动后端（测试） ==="
echo "当前目录: $(pwd)"
echo "Python版本: $(python3 --version)"

# 尝试导入关键模块
echo "测试Python模块导入:"
python3 -c "
try:
    import sys
    sys.path.insert(0, '.')
    from migrations.migration_utils import setup_migration_logging
    print('✅ migration_utils导入成功')
except Exception as e:
    print(f'❌ migration_utils导入失败: {e}')

try:
    import fastapi, sqlalchemy, pydantic
    print('✅ 关键依赖导入成功')
except Exception as e:
    print(f'❌ 关键依赖导入失败: {e}')
"

echo ""
echo "=== 6. 检查最近的部署日志 ==="
if [ -f "/var/log/research-dashboard-deploy.log" ]; then
    echo "最近的migration日志:"
    grep -A10 -B2 "v1.19" /var/log/research-dashboard-deploy.log | tail -20
else
    echo "❌ 部署日志文件不存在"
fi

echo ""
echo "=== 诊断完成 ==="
echo "🔧 建议下一步操作:"
echo "1. 如果migration失败，需要手动执行migration"
echo "2. 如果服务无法启动，检查Python依赖"
echo "3. 如果数据库损坏，需要从备份恢复"