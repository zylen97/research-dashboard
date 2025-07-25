#!/bin/bash

# 🔥 VPS深度诊断脚本 - 找出502的真正原因
# Ultra Think终极诊断

set +e  # 不要因错误退出，我们要看所有错误

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🔥 === VPS 502错误终极诊断 === ${NC}"
echo -e "${BLUE}时间: $(date)${NC}"
echo ""

# 0. 基础信息
echo -e "${YELLOW}=== 0. 系统基础信息 ===${NC}"
echo "主机名: $(hostname)"
echo "系统: $(uname -a)"
echo "当前用户: $(whoami)"
echo "工作目录: $(pwd)"
echo ""

# 1. Python环境检查
echo -e "${YELLOW}=== 1. Python环境检查 ===${NC}"
echo "Python3路径: $(which python3)"
echo "Python3版本:"
python3 --version
echo ""
echo "Pip3版本:"
pip3 --version
echo ""
echo "Python3可执行详情:"
ls -la $(which python3)
echo ""

# 2. 切换到后端目录
echo -e "${YELLOW}=== 2. 进入后端目录 ===${NC}"
cd /var/www/research-dashboard/backend || {
    echo -e "${RED}❌ 无法进入后端目录${NC}"
    exit 1
}
pwd
ls -la
echo ""

# 3. 检查关键文件
echo -e "${YELLOW}=== 3. 检查关键文件 ===${NC}"
echo "main.py存在性和权限:"
ls -la main.py || echo "❌ main.py不存在"
echo ""
echo "test-minimal-app.py存在性:"
ls -la test-minimal-app.py || echo "❌ test-minimal-app.py不存在"
echo ""

# 4. 检查Python模块
echo -e "${YELLOW}=== 4. 检查Python模块导入 ===${NC}"
python3 -c "
import sys
print(f'Python路径: {sys.path}')
print()
try:
    import fastapi
    print('✅ FastAPI可导入')
    print(f'   版本: {fastapi.__version__}')
except Exception as e:
    print(f'❌ FastAPI导入失败: {e}')

try:
    import uvicorn
    print('✅ Uvicorn可导入')
except Exception as e:
    print(f'❌ Uvicorn导入失败: {e}')

try:
    import pydantic
    print('✅ Pydantic可导入')
    print(f'   版本: {pydantic.__version__}')
except Exception as e:
    print(f'❌ Pydantic导入失败: {e}')

try:
    import sqlalchemy
    print('✅ SQLAlchemy可导入')
    print(f'   版本: {sqlalchemy.__version__}')
except Exception as e:
    print(f'❌ SQLAlchemy导入失败: {e}')
"
echo ""

# 5. 尝试导入main模块
echo -e "${YELLOW}=== 5. 尝试导入main模块 ===${NC}"
python3 -c "
import sys
sys.path.insert(0, '.')
try:
    import main
    print('✅ main模块导入成功')
except Exception as e:
    print(f'❌ main模块导入失败:')
    print(f'   错误类型: {type(e).__name__}')
    print(f'   错误信息: {e}')
    import traceback
    print('   详细堆栈:')
    traceback.print_exc()
"
echo ""

# 6. 运行极简测试应用
echo -e "${YELLOW}=== 6. 运行极简测试应用 ===${NC}"
if [ -f "test-minimal-app.py" ]; then
    echo "运行test-minimal-app.py (10秒超时)..."
    timeout 10 python3 test-minimal-app.py 2>&1 | head -50
else
    echo "❌ test-minimal-app.py不存在"
fi
echo ""

# 7. 检查systemd服务
echo -e "${YELLOW}=== 7. 检查systemd服务状态 ===${NC}"
systemctl status research-backend --no-pager -l || echo "服务状态检查失败"
echo ""
echo "最近30条服务日志:"
journalctl -u research-backend -n 30 --no-pager || echo "无法获取日志"
echo ""

# 8. 检查端口
echo -e "${YELLOW}=== 8. 检查端口状态 ===${NC}"
echo "8080端口占用情况:"
netstat -tulpn | grep :8080 || echo "端口8080未被占用"
echo ""
echo "所有监听端口:"
netstat -tulpn | grep LISTEN
echo ""

# 9. 检查进程
echo -e "${YELLOW}=== 9. 检查Python进程 ===${NC}"
ps aux | grep python | grep -v grep || echo "没有Python进程"
echo ""

# 10. 检查资源
echo -e "${YELLOW}=== 10. 系统资源检查 ===${NC}"
echo "内存使用:"
free -h
echo ""
echo "磁盘使用:"
df -h | grep -E "/$|/var"
echo ""

# 11. 环境变量
echo -e "${YELLOW}=== 11. 环境变量检查 ===${NC}"
echo "PYTHONPATH: $PYTHONPATH"
echo "PATH: $PATH"
echo ""
if [ -f ".env" ]; then
    echo "✅ .env文件存在"
else
    echo "❌ .env文件不存在"
fi
echo ""

# 12. 尝试直接运行uvicorn
echo -e "${YELLOW}=== 12. 直接运行uvicorn测试 ===${NC}"
echo "尝试启动main.py (5秒超时)..."
timeout 5 python3 -m uvicorn main:app --host 127.0.0.1 --port 8081 --log-level debug 2>&1 | head -30
echo ""

echo -e "${GREEN}🎯 诊断完成！请查看上面的错误信息${NC}"
echo -e "${RED}重点关注标记为❌的项目${NC}"