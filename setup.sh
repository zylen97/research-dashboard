#!/bin/bash

# Research Dashboard 安装脚本
# 作者: Claude Code
# 功能: 一键安装所有依赖

echo "📦 安装 Research Dashboard 依赖..."
echo "========================================"

# 获取项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查命令是否存在
check_command() {
    local cmd=$1
    local name=$2
    
    if ! command -v $cmd >/dev/null 2>&1; then
        echo -e "${RED}❌ $name 未安装${NC}"
        echo "请先安装 $name："
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  brew install $cmd"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "  sudo apt-get install $cmd  # Ubuntu/Debian"
            echo "  sudo yum install $cmd      # CentOS/RHEL"
        fi
        return 1
    else
        echo -e "${GREEN}✅ $name 已安装${NC}"
        return 0
    fi
}

# 检查系统依赖
check_dependencies() {
    echo "🔍 检查系统依赖..."
    
    local all_ok=true
    
    if ! check_command python3 "Python3"; then
        all_ok=false
    fi
    
    if ! check_command pip "pip"; then
        all_ok=false
    fi
    
    if ! check_command node "Node.js"; then
        all_ok=false
    fi
    
    if ! check_command npm "npm"; then
        all_ok=false
    fi
    
    if [ "$all_ok" = false ]; then
        echo -e "${RED}请先安装缺失的依赖项${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 系统依赖检查完成${NC}"
    echo ""
}

# 安装Python依赖
install_python_deps() {
    echo "🐍 安装Python依赖..."
    cd "$BACKEND_DIR"
    
    # 检查虚拟环境（可选）
    if [ -d "venv" ]; then
        echo "检测到虚拟环境，激活中..."
        source venv/bin/activate
    fi
    
    pip install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Python依赖安装成功${NC}"
    else
        echo -e "${RED}❌ Python依赖安装失败${NC}"
        exit 1
    fi
    echo ""
}

# 安装Node.js依赖
install_node_deps() {
    echo "📦 安装Node.js依赖..."
    cd "$FRONTEND_DIR"
    
    npm install
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Node.js依赖安装成功${NC}"
    else
        echo -e "${RED}❌ Node.js依赖安装失败${NC}"
        exit 1
    fi
    echo ""
}

# 设置脚本权限
setup_permissions() {
    echo "🔐 设置脚本执行权限..."
    cd "$PROJECT_DIR"
    
    chmod +x start.sh
    chmod +x stop.sh
    chmod +x setup.sh
    
    echo -e "${GREEN}✅ 脚本权限设置完成${NC}"
    echo ""
}

# 显示版本信息
show_versions() {
    echo "📋 环境信息:"
    echo "  Python: $(python3 --version 2>&1)"
    echo "  pip: $(pip --version 2>&1 | cut -d' ' -f1-2)"
    echo "  Node.js: $(node --version 2>&1)"
    echo "  npm: $(npm --version 2>&1)"
    echo ""
}

# 显示完成信息
show_completion() {
    echo "========================================"
    echo -e "${BLUE}🎉 安装完成！${NC}"
    echo "========================================"
    echo ""
    echo "🚀 快速启动:"
    echo "  ./start.sh    # 启动所有服务"
    echo "  ./stop.sh     # 停止所有服务"
    echo ""
    echo "📁 项目结构:"
    echo "  backend/      # FastAPI后端 (端口8080)"
    echo "  frontend/     # React前端 (端口3001)"
    echo "  logs/         # 运行日志"
    echo "  pids/         # 进程ID文件"
    echo ""
    echo "📖 更多信息请查看 README.md"
    echo ""
}

# 主安装流程
main() {
    check_dependencies
    show_versions
    install_python_deps
    install_node_deps
    setup_permissions
    show_completion
}

# 执行主流程
main