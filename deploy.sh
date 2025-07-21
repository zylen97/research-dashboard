#!/bin/bash

# Research Dashboard 统一部署脚本
# 用法: ./deploy.sh [选项]
#   选项:
#     check   - 只检查VPS状态
#     build   - 本地构建并部署
#     help    - 显示帮助

set -e

# 配置
VPS_HOST="45.149.156.216"
VPS_USER="root"
VPS_WEB_DIR="/var/www/html"
VPS_PROJECT_DIR="/var/www/research-dashboard"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 显示帮助
show_help() {
    echo "Research Dashboard 部署工具"
    echo ""
    echo "用法: ./deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  check   - 检查VPS状态"
    echo "  build   - 本地构建并部署到VPS"
    echo "  help    - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh         # 默认：检查状态"
    echo "  ./deploy.sh check   # 检查VPS状态"
    echo "  ./deploy.sh build   # 构建并部署"
}

# 检查VPS状态
check_status() {
    echo -e "${YELLOW}=== 检查VPS状态 ===${NC}"
    echo ""
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
    # 检查服务状态
    echo -n "后端服务: "
    systemctl is-active research-backend >/dev/null 2>&1 && echo -e "\033[0;32m✓ 运行中\033[0m" || echo -e "\033[0;31m✗ 未运行\033[0m"
    
    echo -n "Nginx服务: "
    systemctl is-active nginx >/dev/null 2>&1 && echo -e "\033[0;32m✓ 运行中\033[0m" || echo -e "\033[0;31m✗ 未运行\033[0m"
    
    echo -n "前端文件: "
    [ -f /var/www/html/index.html ] && echo -e "\033[0;32m✓ 已部署\033[0m" || echo -e "\033[0;31m✗ 未部署\033[0m"
    
    echo ""
    echo "端口监听:"
    sudo netstat -tlnp | grep -E "80|3001|8080" | grep LISTEN || echo "无监听端口"
    
    echo ""
    echo "访问地址: http://45.149.156.216:3001"
EOF
}

# 构建并部署
build_and_deploy() {
    echo -e "${YELLOW}=== 构建并部署前端 ===${NC}"
    echo ""
    
    # 检查是否在项目根目录
    if [ ! -d "frontend" ]; then
        echo -e "${RED}错误：请在项目根目录运行此脚本${NC}"
        exit 1
    fi
    
    # 构建前端
    echo -e "${YELLOW}1. 构建前端...${NC}"
    cd frontend
    npm install
    npm run build
    
    if [ ! -d "build" ]; then
        echo -e "${RED}构建失败！${NC}"
        exit 1
    fi
    
    # 打包并上传
    echo -e "${YELLOW}2. 上传到VPS...${NC}"
    tar -czf build.tar.gz build/
    scp build.tar.gz $VPS_USER@$VPS_HOST:/tmp/
    rm -f build.tar.gz
    cd ..
    
    # 在VPS上部署
    echo -e "${YELLOW}3. 在VPS上部署...${NC}"
    ssh $VPS_USER@$VPS_HOST << 'EOF'
    cd /tmp
    tar -xzf build.tar.gz
    rm -rf /var/www/html/*
    cp -r build/* /var/www/html/
    chown -R www-data:www-data /var/www/html
    rm -rf build build.tar.gz
    systemctl reload nginx
    echo "部署完成！"
EOF
    
    echo ""
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo "访问: http://45.149.156.216:3001"
}

# 主程序
case "${1:-check}" in
    check)
        check_status
        ;;
    build)
        build_and_deploy
        ;;
    help)
        show_help
        ;;
    *)
        echo -e "${RED}未知选项: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac