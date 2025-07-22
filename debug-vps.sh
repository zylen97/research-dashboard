#!/bin/bash

# 🔍 VPS 500错误紧急诊断脚本
# 你需要在VPS上执行这个脚本

echo "=== USTS Research Dashboard 500错误诊断 ==="
echo "时间: $(date)"
echo ""

echo "1. 🚀 后端服务状态检查"
echo "========================"
systemctl status research-backend --no-pager -l
echo ""

echo "2. 📝 查看最近的错误日志"
echo "========================"
echo "最近50行后端服务日志:"
journalctl -u research-backend --lines=50 --no-pager
echo ""

echo "3. 🔍 搜索与文献和AI配置相关的错误"
echo "================================="
echo "搜索 'literature' 相关错误:"
journalctl -u research-backend --since="1 hour ago" | grep -i literature || echo "无文献相关错误"
echo ""

echo "搜索 'ai' 或 'provider' 相关错误:"
journalctl -u research-backend --since="1 hour ago" | grep -i -E "(ai|provider)" || echo "无AI相关错误"
echo ""

echo "搜索 Python 异常和堆栈跟踪:"
journalctl -u research-backend --since="1 hour ago" | grep -A 10 -i -E "(traceback|exception|error)" || echo "无Python异常"
echo ""

echo "4. 🌐 端口和网络检查"
echo "==================="
echo "检查8080端口是否被监听:"
netstat -tlnp | grep :8080 || echo "8080端口未监听"
echo ""

echo "测试本地API访问:"
curl -v http://localhost:8080/ 2>&1 | head -20 || echo "API访问失败"
echo ""

echo "5. 🗂️ 文件系统检查"
echo "==================="
echo "后端目录结构:"
ls -la /var/www/research-dashboard/backend/
echo ""

echo "环境配置文件:"
ls -la /var/www/research-dashboard/backend/.env* || echo "无环境配置文件"
echo ""

echo "数据库文件:"
ls -la /var/www/research-dashboard/backend/data/ || echo "无数据目录"
echo ""

echo "6. 🐍 Python依赖检查"
echo "===================="
echo "检查关键Python包:"
python3 -c "
try:
    import fastapi
    print('✅ FastAPI:', fastapi.__version__)
except ImportError as e:
    print('❌ FastAPI导入失败:', e)

try:
    import httpx
    print('✅ HTTPX:', httpx.__version__)
except ImportError as e:
    print('❌ HTTPX导入失败:', e)

try:
    import sqlalchemy
    print('✅ SQLAlchemy:', sqlalchemy.__version__)
except ImportError as e:
    print('❌ SQLAlchemy导入失败:', e)
"
echo ""

echo "7. 🔧 尝试手动启动后端"
echo "====================="
echo "进入后端目录并尝试手动运行:"
cd /var/www/research-dashboard/backend/
echo "当前目录: $(pwd)"
echo ""
echo "Python路径: $(which python3)"
echo ""
echo "尝试运行后端应用（5秒后自动终止）:"
timeout 5s python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080 || echo "手动启动失败或超时"
echo ""

echo "=== 诊断完成 ==="
echo "请将以上输出发送给开发者进行分析"