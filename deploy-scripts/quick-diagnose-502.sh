#!/bin/bash

# 🚨 快速诊断502错误 - VPS一键检查脚本
# 使用方法：ssh到VPS后执行 ./quick-diagnose-502.sh

echo "🚨 快速诊断502错误 - $(date)"
echo "========================================"

# 检查是否在VPS上
if [ ! -d "/var/www/research-dashboard" ]; then
    echo "❌ 错误：请在VPS上执行此脚本"
    echo "正确路径应该是：/var/www/research-dashboard"
    exit 1
fi

cd /var/www/research-dashboard

# 1. 快速服务状态检查
echo ""
echo "=== 1. 服务状态检查 ==="
echo "nginx状态:"
systemctl is-active nginx && echo "✅ nginx运行中" || echo "❌ nginx未运行"

echo "backend状态:"
systemctl is-active research-backend && echo "✅ backend运行中" || echo "❌ backend未运行"

# 2. 端口监听检查
echo ""
echo "=== 2. 端口监听检查 ==="
echo "检查3001(nginx):"
ss -tlnp | grep :3001 && echo "✅ 3001端口正常监听" || echo "❌ 3001端口未监听"

echo "检查8080(backend):"
ss -tlnp | grep :8080 && echo "✅ 8080端口正常监听" || echo "❌ 8080端口未监听"

# 3. 快速API测试
echo ""
echo "=== 3. API连通性测试 ==="
echo "本地backend测试:"
curl_result=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null)
if [ "$curl_result" = "200" ]; then
    echo "✅ backend API正常响应 (200)"
else
    echo "❌ backend API异常 (HTTP $curl_result)"
fi

echo "nginx代理测试:"
nginx_result=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null)
if [ "$nginx_result" = "200" ]; then
    echo "✅ nginx代理正常 (200)"
else
    echo "❌ nginx代理异常 (HTTP $nginx_result)"
fi

# 4. 最近错误日志
echo ""
echo "=== 4. 最近错误日志 ==="
echo "backend服务日志 (最新10条):"
journalctl -u research-backend -n 10 --no-pager | tail -5

echo ""
echo "nginx错误日志 (最新5条):"
if [ -f "/var/log/nginx/error.log" ]; then
    tail -5 /var/log/nginx/error.log
else
    echo "nginx错误日志文件不存在"
fi

# 5. 数据库状态检查
echo ""
echo "=== 5. 数据库状态检查 ==="
cd backend
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 生产数据库存在"
    db_size=$(du -h data/research_dashboard_prod.db | cut -f1)
    echo "数据库大小: $db_size"
    
    # 检查关键表
    table_count=$(sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
    echo "数据库表数量: $table_count"
    
    # 检查最新migration
    latest_migration=$(sqlite3 data/research_dashboard_prod.db "SELECT version FROM migration_history ORDER BY executed_at DESC LIMIT 1;" 2>/dev/null)
    echo "最新migration: $latest_migration"
else
    echo "❌ 生产数据库不存在"
fi

# 6. Python环境检查
echo ""
echo "=== 6. Python环境检查 ==="
echo "Python版本: $(python3 --version)"
echo "FastAPI模块检查:"
python3 -c "import fastapi, uvicorn; print('✅ 核心模块正常')" 2>/dev/null || echo "❌ Python模块缺失"

# 7. 系统资源检查
echo ""
echo "=== 7. 系统资源检查 ==="
echo "内存使用率:"
free -h | head -2

echo "磁盘使用率:"
df -h / | tail -1

# 8. 诊断结论
echo ""
echo "=== 🔍 诊断结论 ==="

# 分析并给出建议
if systemctl is-active nginx >/dev/null && systemctl is-active research-backend >/dev/null; then
    if [ "$nginx_result" = "200" ]; then
        echo "✅ 系统正常运行，502错误可能已修复"
    else
        echo "⚠️  服务运行但API异常，检查代码逻辑或数据库"
    fi
elif systemctl is-active nginx >/dev/null; then
    echo "🔧 nginx正常但backend异常，需要重启backend服务"
    echo "建议执行: systemctl restart research-backend"
else
    echo "🚨 服务全部异常，需要完整重启"
    echo "建议执行完整修复脚本: ./emergency-fix-502.sh"
fi

echo ""
echo "📋 下一步操作建议:"
echo "1. 如果backend异常: systemctl restart research-backend"
echo "2. 如果数据库问题: cd backend && python3 migrations/migration.py"
echo "3. 如果全部异常: ./emergency-fix-502.sh"
echo "4. 实时监控日志: journalctl -u research-backend -f"

echo ""
echo "🎯 访问地址: http://45.149.156.216:3001"
echo "========================================"