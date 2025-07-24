#!/bin/bash

# 🚨 紧急修复502错误脚本
# 直接在VPS上执行完整的服务重启和诊断

echo "🚨 紧急修复502错误..."

cd /var/www/research-dashboard

echo "=== 1. 停止所有相关服务 ==="
systemctl stop research-backend
systemctl stop nginx
sleep 3

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

echo "=== 6. 检查数据库文件 ==="
ls -la data/ || echo "数据库目录不存在"
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 生产数据库存在: $(ls -lh data/research_dashboard_prod.db)"
    sqlite3 data/research_dashboard_prod.db ".tables" | head -5
else
    echo "❌ 生产数据库不存在，创建..."
    mkdir -p data
    python3 -c "
from app.database import engine, Base
Base.metadata.create_all(bind=engine)
print('数据库已创建')
"
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

echo "=== 12. 最终状态检查 ==="
if curl -f -s "http://localhost:8080/docs" > /dev/null 2>&1; then
    echo "✅ API可访问，502问题已修复"
else
    echo "❌ API仍不可访问，需要进一步排查"
    echo "当前运行的Python进程:"
    ps aux | grep python | grep -v grep
fi

echo "🎯 修复完成，请测试: http://45.149.156.216:3001"