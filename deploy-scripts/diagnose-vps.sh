#!/bin/bash

# VPS问题诊断脚本
# 用于诊断后端服务无响应的问题

echo "======================================"
echo "🔍 VPS 后端服务诊断脚本"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"
echo ""

# 1. 检查系统基本信息
echo "1️⃣ 系统基本信息"
echo "-----------------"
echo "主机名: $(hostname)"
echo "系统版本: $(lsb_release -d 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME)"
echo "内存使用:"
free -h | grep -E "^Mem|^Swap"
echo "磁盘使用:"
df -h | grep -E "^/dev|^Filesystem"
echo ""

# 2. 检查服务状态
echo "2️⃣ 服务状态检查"
echo "-----------------"
echo "▶ research-backend 服务状态:"
systemctl status research-backend --no-pager | head -20
echo ""
echo "▶ nginx 服务状态:"
systemctl is-active nginx && echo "✅ Nginx 运行中" || echo "❌ Nginx 已停止"
echo ""

# 3. 查看最近的服务日志
echo "3️⃣ 最近的服务日志 (最后50行)"
echo "--------------------------------"
echo "▶ research-backend 日志:"
journalctl -u research-backend -n 50 --no-pager | tail -30
echo ""

# 4. 检查端口监听状态
echo "4️⃣ 端口监听状态"
echo "-----------------"
echo "▶ 8080端口 (后端API):"
netstat -tlnp 2>/dev/null | grep :8080 || ss -tlnp | grep :8080 || echo "❌ 8080端口未监听"
echo ""
echo "▶ 3001端口 (前端):"
netstat -tlnp 2>/dev/null | grep :3001 || ss -tlnp | grep :3001 || echo "❌ 3001端口未监听"
echo ""

# 5. 检查Python环境
echo "5️⃣ Python环境检查"
echo "------------------"
echo "▶ Python版本:"
python3 --version
echo ""
echo "▶ 检查关键依赖:"
cd /var/www/research-dashboard/backend 2>/dev/null && {
    python3 -c "import fastapi; print('✅ FastAPI:', fastapi.__version__)" 2>&1
    python3 -c "import sqlalchemy; print('✅ SQLAlchemy:', sqlalchemy.__version__)" 2>&1
    python3 -c "import httpx; print('✅ httpx:', httpx.__version__)" 2>&1
    python3 -c "import pydantic; print('✅ Pydantic:', pydantic.__version__)" 2>&1
} || echo "❌ 无法进入项目目录"
echo ""

# 6. 检查应用文件
echo "6️⃣ 应用文件检查"
echo "-----------------"
echo "▶ 项目目录结构:"
ls -la /var/www/research-dashboard/ 2>/dev/null | head -10 || echo "❌ 项目目录不存在"
echo ""
echo "▶ 后端目录:"
ls -la /var/www/research-dashboard/backend/ 2>/dev/null | head -10
echo ""
echo "▶ routes目录:"
ls -la /var/www/research-dashboard/backend/app/routes/ 2>/dev/null | grep -E "folders|literature"
echo ""

# 7. 检查环境配置
echo "7️⃣ 环境配置检查"
echo "-----------------"
echo "▶ .env文件存在性:"
if [ -f /var/www/research-dashboard/backend/.env ]; then
    echo "✅ .env文件存在"
    echo "▶ 环境变量 (敏感信息已隐藏):"
    grep -E "^(ENVIRONMENT|HOST|PORT|DATABASE_URL)" /var/www/research-dashboard/backend/.env | sed 's/=.*/=***/'
else
    echo "❌ .env文件不存在"
fi
echo ""

# 8. 检查数据库
echo "8️⃣ 数据库检查"
echo "--------------"
echo "▶ 数据库文件:"
ls -lh /var/www/research-dashboard/backend/data/*.db 2>/dev/null || echo "❌ 未找到数据库文件"
echo ""

# 9. 尝试手动启动测试
echo "9️⃣ 尝试手动启动测试"
echo "--------------------"
echo "▶ 测试Python导入:"
cd /var/www/research-dashboard/backend 2>/dev/null && {
    python3 -c "
try:
    from app.routes import folders
    print('✅ folders模块导入成功')
except Exception as e:
    print('❌ folders模块导入失败:', str(e))

try:
    from app.routes import literature
    print('✅ literature模块导入成功')
except Exception as e:
    print('❌ literature模块导入失败:', str(e))
" 2>&1
}
echo ""

# 10. 部署日志
echo "🔟 部署日志 (最后30行)"
echo "----------------------"
tail -30 /var/log/research-dashboard-deploy.log 2>/dev/null || echo "❌ 部署日志不存在"
echo ""

# 11. 进程检查
echo "1️⃣1️⃣ Python进程检查"
echo "-------------------"
ps aux | grep -E "(python|uvicorn)" | grep -v grep || echo "❌ 未发现Python/Uvicorn进程"
echo ""

# 12. 建议的修复命令
echo "======================================"
echo "🔧 建议的修复命令"
echo "======================================"
echo ""
echo "1. 重启服务:"
echo "   systemctl restart research-backend"
echo ""
echo "2. 查看实时日志:"
echo "   journalctl -u research-backend -f"
echo ""
echo "3. 手动运行测试:"
echo "   cd /var/www/research-dashboard/backend"
echo "   python3 main.py"
echo ""
echo "4. 重新安装依赖:"
echo "   cd /var/www/research-dashboard/backend"
echo "   pip3 install -r requirements.txt"
echo ""
echo "5. 检查并修复权限:"
echo "   chown -R www-data:www-data /var/www/research-dashboard"
echo ""
echo "======================================"
echo "诊断完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================" 