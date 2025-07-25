#!/bin/bash

# 快速回滚脚本 - 极简版
# 功能：回滚到上一个Git提交

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${YELLOW}=== Research Dashboard 快速回滚 ===${NC}"

# 1. 检查是否是Git仓库
if [ ! -d ".git" ]; then
    echo -e "${RED}错误: 不是Git仓库${NC}"
    exit 1
fi

# 2. 获取当前和上一个提交信息
CURRENT_COMMIT=$(git rev-parse --short HEAD)
CURRENT_MSG=$(git log -1 --pretty=%s)
PREVIOUS_COMMIT=$(git rev-parse --short HEAD~1)
PREVIOUS_MSG=$(git log -1 --pretty=%s HEAD~1)

echo -e "${CYAN}当前版本:${NC} $CURRENT_COMMIT - $CURRENT_MSG"
echo -e "${CYAN}回滚目标:${NC} $PREVIOUS_COMMIT - $PREVIOUS_MSG"
echo ""

# 3. 确认回滚
read -p "确认回滚到上一个版本? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消回滚"
    exit 0
fi

# 4. 执行回滚
echo -e "${CYAN}执行回滚...${NC}"
git reset --hard HEAD~1 || {
    echo -e "${RED}回滚失败${NC}"
    exit 1
}

# 5. 强制推送
echo -e "${CYAN}推送到远程仓库...${NC}"
git push --force || {
    echo -e "${RED}推送失败${NC}"
    exit 1
}

# 6. 显示结果
echo ""
echo -e "${GREEN}✅ 回滚成功！${NC}"
echo -e "当前版本: $(git rev-parse --short HEAD) - $(git log -1 --pretty=%s)"
echo ""
echo -e "${YELLOW}注意: GitHub Actions将自动部署回滚后的版本${NC}"
echo -e "查看部署状态: ${CYAN}https://github.com/zylen97/research-dashboard/actions${NC}"