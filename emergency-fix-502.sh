#!/bin/bash

# 🚨 紧急修复502错误脚本 - 增强版
# 在VPS上执行完整的服务重启和诊断
# Ultra Think优化：更安全的修复流程

echo "🚨 紧急修复502错误 - 增强版 $(date)"
echo "========================================"

# 检查是否在正确位置
if [ ! -d "/var/www/research-dashboard" ]; then
    echo "❌ 错误：请在VPS上执行此脚本"
    echo "当前路径: $(pwd)"
    echo "预期路径: /var/www/research-dashboard"
    exit 1
fi

cd /var/www/research-dashboard

# 创建修复日志
REPAIR_LOG="/tmp/repair-502-$(date +%Y%m%d_%H%M%S).log"
echo "📝 修复日志: $REPAIR_LOG"

# 记录修复过程
log_action() {
    echo "$(date): $1" | tee -a "$REPAIR_LOG"
}

log_action "开始502错误修复"

echo "=== 1. 安全停止服务 ==="
log_action "停止服务"
systemctl stop research-backend
sleep 2
systemctl stop nginx
sleep 3

# 检查服务是否真正停止
if systemctl is-active research-backend >/dev/null; then
    echo "⚠️  backend服务未完全停止，强制终止"
    pkill -f "python.*main.py"
    pkill -f "uvicorn"
    sleep 2
fi

echo "=== 2. 检查端口占用情况 ==="
echo "检查8080端口:"
netstat -tulpn | grep :8080 || echo "8080端口未占用"
echo "检查3001端口:"
netstat -tulpn | grep :3001 || echo "3001端口未占用"

echo "=== 3. 清理可能的僵尸进程 ==="
pkill -f "python.*main.py" || echo "无python进程需要清理"
pkill -f "uvicorn" || echo "无uvicorn进程需要清理"

echo "=== 4. 检查Python环境和依赖 ==="
cd backend
python3 -c "import fastapi, uvicorn; print('核心依赖正常')" || {
    echo "安装缺失依赖..."
    pip3 install fastapi uvicorn sqlalchemy pydantic
}

echo "=== 5. 测试FastAPI应用是否能启动 ==="
timeout 10s python3 -c "
import sys
sys.path.append('.')
try:
    from main import app
    print('✅ FastAPI应用导入成功')
except Exception as e:
    print(f'❌ FastAPI应用导入失败: {e}')
    exit(1)
" || echo "FastAPI应用测试超时或失败"

echo "=== 6. 数据库检查和修复 ==="
log_action "检查数据库状态"
ls -la data/ || echo "数据库目录不存在"

if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 生产数据库存在: $(ls -lh data/research_dashboard_prod.db)"
    
    # 检查数据库完整性
    echo "检查数据库完整性..."
    db_check=$(sqlite3 data/research_dashboard_prod.db "PRAGMA integrity_check;" 2>/dev/null)
    if [ "$db_check" = "ok" ]; then
        echo "✅ 数据库完整性正常"
    else
        echo "⚠️  数据库完整性异常: $db_check"
        log_action "数据库完整性异常"
    fi
    
    # 检查关键表
    tables=$(sqlite3 data/research_dashboard_prod.db ".tables" 2>/dev/null | head -5)
    echo "数据库表: $tables"
    
    # 检查最新migration状态
    latest_migration=$(sqlite3 data/research_dashboard_prod.db "SELECT version FROM migration_history ORDER BY executed_at DESC LIMIT 1;" 2>/dev/null || echo "unknown")
    echo "最新migration: $latest_migration"
    
    # 如果是v1.21，检查是否需要重新执行
    if [ "$latest_migration" != "v1.21_auto_fix_field_mapping" ]; then
        echo "⚠️  需要执行数据库迁移"
        log_action "执行数据库迁移"
        python3 migrations/migration.py || {
            echo "❌ 数据库迁移失败"
            log_action "数据库迁移失败"
        }
    fi
else
    echo "❌ 生产数据库不存在，初始化..."
    log_action "初始化数据库"
    mkdir -p data
    python3 -c "
import sys
sys.path.append('.')
from app.utils.db_init import init_database
init_database()
print('✅ 数据库已初始化')
" || {
        echo "❌ 数据库初始化失败"
        log_action "数据库初始化失败"
        exit 1
    }
fi

echo "=== 7. 检查systemd服务配置 ==="
systemctl cat research-backend | head -20

echo "=== 8. 强制重启服务 ==="
systemctl daemon-reload
systemctl start nginx
systemctl start research-backend

echo "=== 9. 等待服务启动并检查状态 ==="
sleep 10

echo "nginx状态:"
systemctl status nginx --no-pager -l | head -10

echo "backend状态:"
systemctl status research-backend --no-pager -l | head -10

echo "=== 10. 测试API访问 ==="
echo "本地API测试:"
curl -I http://localhost:8080/docs 2>/dev/null | head -3

echo "通过nginx测试:"
curl -I http://localhost:3001/api/ 2>/dev/null | head -3

echo "=== 11. 查看最新错误日志 ==="
echo "backend服务日志:"
journalctl -u research-backend -n 10 --no-pager

echo "nginx错误日志:"
tail -5 /var/log/nginx/error.log 2>/dev/null || echo "无nginx错误日志"

echo "=== 12. 最终状态验证 ==="
log_action "验证修复结果"

# 等待服务完全启动
echo "等待服务完全启动..."
sleep 5

# 检查服务状态
backend_status=$(systemctl is-active research-backend)
nginx_status=$(systemctl is-active nginx)

echo "服务状态:"
echo "  - Backend: $backend_status"
echo "  - Nginx: $nginx_status"

# API连通性测试
echo "API连通性测试:"
backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null || echo "failed")
nginx_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "failed")

echo "  - Backend API: $backend_health"
echo "  - Nginx Proxy: $nginx_health"

# 综合判断修复结果
if [ "$backend_status" = "active" ] && [ "$nginx_status" = "active" ] && [ "$nginx_health" = "200" ]; then
    echo ""
    echo "✅ 🎉 502错误修复成功！"
    log_action "修复成功"
    echo "🎯 测试地址: http://45.149.156.216:3001"
    echo "📊 实时监控: journalctl -u research-backend -f"
elif [ "$backend_status" = "active" ] && [ "$backend_health" = "200" ]; then
    echo ""
    echo "⚠️  Backend正常，但nginx代理可能有问题"
    log_action "Backend正常，nginx异常"
    echo "建议检查nginx配置和防火墙设置"
else
    echo ""
    echo "❌ 修复失败，需要进一步排查"
    log_action "修复失败"
    echo ""
    echo "🔍 排查建议:"
    echo "1. 查看修复日志: cat $REPAIR_LOG"
    echo "2. 查看实时日志: journalctl -u research-backend -f"
    echo "3. 手动测试migration: cd backend && python3 migrations/migration.py"
    echo "4. 检查Python环境: which python3 && python3 --version"
    
    # 显示当前Python进程
    echo ""
    echo "当前Python进程:"
    ps aux | grep python | grep -v grep | head -5
fi

echo ""
echo "========================================"
echo "📝 完整修复日志: $REPAIR_LOG"
echo "🕐 修复完成时间: $(date)"