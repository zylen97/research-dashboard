#!/bin/bash

# 🔄 Research Dashboard 快速回滚脚本
# 回滚到上一个Git提交并重启服务

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=== Research Dashboard 快速回滚 ===${NC}"
echo ""

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 检查是否是Git仓库
if [ ! -d ".git" ]; then
    echo -e "${RED}错误：当前目录不是Git仓库${NC}"
    exit 1
fi

# 获取当前提交信息
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_MESSAGE=$(git log -1 --pretty=%s)

echo -e "${CYAN}当前提交：${NC}"
echo "  Hash: $CURRENT_COMMIT"
echo "  信息: $CURRENT_MESSAGE"
echo ""

# 获取上一个提交信息
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
PREVIOUS_MESSAGE=$(git log -1 --pretty=%s HEAD~1)

echo -e "${CYAN}回滚目标：${NC}"
echo "  Hash: $PREVIOUS_COMMIT"
echo "  信息: $PREVIOUS_MESSAGE"
echo ""

# 用户确认
echo -e "${YELLOW}⚠️ 确认回滚到上一个版本？ (y/N)${NC}"
read -r confirmation

if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}回滚已取消${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔄 开始回滚...${NC}"

# 备份当前状态（以防需要再次回滚）
echo -e "${CYAN}1. 创建回滚点标签...${NC}"
git tag -f "rollback-point-$(date +%Y%m%d-%H%M%S)" HEAD

# 回滚到上一个提交
echo -e "${CYAN}2. 回滚Git提交...${NC}"
git reset --hard HEAD~1

# 如果在VPS上，重启服务
if [ -f "/etc/systemd/system/research-backend.service" ]; then
    echo -e "${CYAN}3. 检测到VPS环境，重启后端服务...${NC}"
    
    # 重启后端服务
    sudo systemctl restart research-backend
    
    # 等待服务启动
    sleep 5
    
    # 检查服务状态
    if systemctl is-active --quiet research-backend; then
        echo -e "${GREEN}✅ 后端服务重启成功${NC}"
    else
        echo -e "${RED}❌ 后端服务重启失败${NC}"
        echo -e "${YELLOW}请手动检查服务状态：sudo journalctl -u research-backend -n 20${NC}"
    fi
    
    # 检查API是否可访问
    echo -e "${CYAN}4. 检查API健康状态...${NC}"
    sleep 3
    
    if curl -f -s "http://localhost:8080" > /dev/null; then
        echo -e "${GREEN}✅ API访问正常${NC}"
    else
        echo -e "${YELLOW}⚠️ API访问检查失败，可能需要等待更长时间${NC}"
    fi
    
else
    echo -e "${CYAN}3. 本地环境，跳过服务重启${NC}"
fi

echo ""
echo -e "${GREEN}🎉 回滚完成！${NC}"
echo ""

# 显示回滚后的状态
NEW_COMMIT=$(git rev-parse HEAD)
NEW_MESSAGE=$(git log -1 --pretty=%s)

echo -e "${CYAN}=== 回滚后状态 ===${NC}"
echo "  当前提交: $NEW_COMMIT"
echo "  提交信息: $NEW_MESSAGE"
echo "  访问地址: http://45.149.156.216:3001"
echo ""

echo -e "${YELLOW}💡 提示：${NC}"
echo "  - 如需撤销回滚，运行：git reset --hard rollback-point-*"
echo "  - 查看可用标签：git tag --list 'rollback-point-*'"
echo "  - 清理回滚标签：git tag -d rollback-point-*"