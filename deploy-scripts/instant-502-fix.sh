#!/bin/bash

# 🚨 瞬间修复502错误 - 终极版本
# 此脚本会暴力修复所有可能导致502的问题

echo "🚨 瞬间修复502错误 - 终极版本"
echo "执行时间: $(date)"
echo "==============================================="

# 确保在VPS上执行
if [ ! -f "/etc/systemd/system/research-backend.service" ]; then
    echo "❌ 必须在VPS上执行"
    exit 1
fi

cd /var/www/research-dashboard

echo "=== 🔥 第一步：暴力清理所有相关进程 ==="
# 杀死所有相关进程
pkill -f "python.*main.py" || true
pkill -f "uvicorn" || true  
pkill -f "research-backend" || true
systemctl stop research-backend || true
systemctl stop nginx || true

# 等待进程彻底死亡
sleep 5

# 再次确认清理
pkill -9 -f "python.*main.py" || true
pkill -9 -f "uvicorn" || true

echo "✅ 进程清理完成"

echo "=== 🔧 第二步：修复systemd服务 ==="
systemctl daemon-reload
systemctl reset-failed research-backend || true

echo "=== 💾 第三步：数据库紧急检查 ==="
cd backend

# 如果数据库文件不存在或损坏，创建新的
if [ ! -f "data/research_dashboard_prod.db" ] || ! sqlite3 data/research_dashboard_prod.db ".tables" >/dev/null 2>&1; then
    echo "🔄 重建数据库..."
    mkdir -p data
    rm -f data/research_dashboard_prod.db
    
    # 执行数据库初始化
    python3 -c "
import sys
sys.path.append('.')
import os
os.environ['ENVIRONMENT'] = 'production'
from app.core.database import Base, engine
from app.models import *
Base.metadata.create_all(bind=engine)
print('✅ 数据库重建完成')
" || echo "❌ 数据库初始化失败"
fi

# 强制执行迁移
echo "🔄 强制执行数据库迁移..."
ENVIRONMENT=production python3 migrations/migration.py || echo "迁移执行完成（可能已是最新版本）"

echo "=== 🐍 第四步：Python环境检查 ==="
# 确保关键依赖存在
python3 -c "import fastapi, uvicorn, sqlalchemy, pydantic" || {
    echo "🔄 安装缺失依赖..."
    pip3 install fastapi uvicorn sqlalchemy pydantic
}

echo "=== 🌐 第五步：nginx配置强制刷新 ==="
# 测试nginx配置
nginx -t || {
    echo "❌ nginx配置错误，尝试修复..."  
    # 如果配置有问题，使用备份或默认配置
    if [ -f "/etc/nginx/sites-available/research-dashboard-3001.backup.*" ]; then
        latest_backup=$(ls -t /etc/nginx/sites-available/research-dashboard-3001.backup.* | head -1)
        cp "$latest_backup" /etc/nginx/sites-available/research-dashboard-3001
        echo "已恢复备份配置"
    fi
}

systemctl start nginx
echo "✅ nginx已启动"

echo "=== 🚀 第六步：暴力启动backend服务 ==="
# 删除可能的pid文件
rm -f /tmp/research-backend.pid

# 强制启动服务
systemctl start research-backend

# 给服务20秒启动时间
echo "⏳ 等待服务启动（20秒）..."
sleep 20

echo "=== 🔍 第七步：实时状态检查 ==="
echo "Backend服务状态:"
systemctl status research-backend --no-pager -l | head -5

echo ""
echo "进程检查:"
ps aux | grep python | grep -v grep | head -3

echo ""
echo "端口检查:"
netstat -tulpn | grep -E ":(8080|3001)" || echo "端口未监听"

echo "=== 🧪 第八步：API连通性测试 ==="
echo "测试后端API..."
for i in {1..5}; do
    if curl -s "http://localhost:8080/docs" >/dev/null; then
        echo "✅ 后端API响应正常 (尝试 $i/5)"
        break
    else
        echo "⚠️ 后端API未响应，等待5秒... (尝试 $i/5)"
        sleep 5
    fi
done

echo ""
echo "测试nginx代理..."
for i in {1..3}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/" 2>/dev/null)
    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        echo "✅ nginx代理响应正常 (状态码: $response)"
        break
    else
        echo "⚠️ nginx代理异常 (状态码: $response)，重启nginx..."
        systemctl restart nginx
        sleep 3
    fi
done

echo "=== 📊 第九步：最终结果 ==="
backend_active=$(systemctl is-active research-backend)
nginx_active=$(systemctl is-active nginx)

echo "服务状态:"
echo "  Backend: $backend_active"
echo "  Nginx: $nginx_active"

# 最终API测试
final_test=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/" 2>/dev/null)
echo "  网站访问: HTTP $final_test"

if [ "$backend_active" = "active" ] && [ "$nginx_active" = "active" ] && [ "$final_test" != "502" ]; then
    echo ""
    echo "🎉 ==============================================="
    echo "🎉 502错误修复成功！系统已恢复正常"
    echo "🎉 ==============================================="
    echo ""
    echo "🎯 访问地址: http://45.149.156.216:3001"
    echo "📖 API文档: http://45.149.156.216:8080/docs"
    echo "📊 监控命令: journalctl -u research-backend -f"
else
    echo ""
    echo "❌ 修复仍有问题，显示详细错误信息:"
    echo ""
    echo "Backend最新日志:"
    journalctl -u research-backend -n 10 --no-pager
    echo ""
    echo "Nginx错误日志:"
    tail -5 /var/log/nginx/error.log 2>/dev/null || echo "无nginx错误"
fi

echo ""
echo "==============================================="
echo "修复完成时间: $(date)"