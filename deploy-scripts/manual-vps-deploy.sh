#!/bin/bash

# 🚀 手动VPS部署脚本 - 直接SSH到VPS进行部署
# 用于GitHub Actions失效时的紧急部署

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

VPS_HOST="45.149.156.216"
VPS_USER="root"
PROJECT_DIR="/var/www/research-dashboard"

echo -e "${BLUE}=== 手动VPS部署脚本 ===${NC}"
echo -e "${CYAN}目标VPS: ${VPS_HOST}${NC}"
echo -e "${CYAN}项目目录: ${PROJECT_DIR}${NC}"

# 函数：执行VPS命令
run_vps_command() {
    local cmd="$1"
    local desc="$2"
    echo -e "${YELLOW}🔄 ${desc}...${NC}"
    echo -e "${CYAN}执行: ${cmd}${NC}"
    ssh ${VPS_USER}@${VPS_HOST} "${cmd}"
}

# 函数：检查命令是否成功
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 成功${NC}"
    else
        echo -e "${RED}❌ 失败${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}🔍 开始手动部署流程...${NC}"

# 1. 检查VPS连接
echo -e "${YELLOW}📡 测试VPS连接...${NC}"
ssh ${VPS_USER}@${VPS_HOST} "echo 'VPS连接成功'" || {
    echo -e "${RED}❌ 无法连接到VPS${NC}"
    exit 1
}
echo -e "${GREEN}✅ VPS连接正常${NC}"

# 2. 检查项目目录和Git状态
run_vps_command "cd ${PROJECT_DIR} && pwd && ls -la" "检查项目目录"
check_success

run_vps_command "cd ${PROJECT_DIR} && git status && git log --oneline -5" "检查Git状态"
check_success

# 3. 拉取最新代码
run_vps_command "cd ${PROJECT_DIR} && git fetch origin && git reset --hard origin/main" "强制拉取最新代码"
check_success

# 4. 检查前端是否有变化
run_vps_command "cd ${PROJECT_DIR} && git log --oneline -3" "检查最新提交"
check_success

# 5. 安装/更新前端依赖
run_vps_command "cd ${PROJECT_DIR}/frontend && npm install" "更新前端依赖"
check_success

# 6. 构建前端
run_vps_command "cd ${PROJECT_DIR}/frontend && NODE_ENV=production npm run build" "构建前端"
check_success

# 7. 复制前端文件到nginx目录
run_vps_command "cd ${PROJECT_DIR}/frontend && cp -r build/* /var/www/html/" "部署前端静态文件"
check_success

# 8. 检查后端依赖
run_vps_command "cd ${PROJECT_DIR}/backend && pip3 install -r requirements.txt" "更新后端依赖"
check_success

# 9. 执行数据库迁移
run_vps_command "cd ${PROJECT_DIR}/backend && python3 migrations/migration.py" "执行数据库迁移"
check_success

# 10. 重启后端服务
run_vps_command "systemctl restart research-backend" "重启后端服务"
check_success

# 11. 检查服务状态
run_vps_command "systemctl status research-backend --no-pager -l" "检查后端服务状态"
check_success

# 12. 检查nginx状态
run_vps_command "systemctl status nginx --no-pager -l" "检查Nginx状态"
check_success

# 13. 检查端口监听
run_vps_command "netstat -tlnp | grep -E ':3001|:80|:443'" "检查端口监听状态"
check_success

# 14. 测试后端健康检查
run_vps_command "curl -s http://localhost:3001/health || echo '后端健康检查失败'" "测试后端健康检查"

# 15. 检查前端文件
run_vps_command "ls -la /var/www/html/ | head -10" "检查前端文件部署"
check_success

echo -e "${GREEN}🎉 手动部署完成！${NC}"
echo -e "${BLUE}📋 部署摘要：${NC}"
echo -e "${CYAN}  ✅ 代码已更新到最新版本${NC}"
echo -e "${CYAN}  ✅ 前端已重新构建并部署${NC}"
echo -e "${CYAN}  ✅ 后端服务已重启${NC}"
echo -e "${CYAN}  ✅ 数据库迁移已执行${NC}"
echo -e "${CYAN}  🌐 访问地址: http://${VPS_HOST}:3001${NC}"

echo -e "${YELLOW}🔍 最终检查建议：${NC}"
echo -e "${CYAN}1. 访问 http://${VPS_HOST}:3001 测试前端${NC}"
echo -e "${CYAN}2. 检查 'Idea发掘与AI配置中心' 页面布局${NC}"
echo -e "${CYAN}3. 确认AI配置面板是否更宽且默认展开${NC}"
echo -e "${CYAN}4. 如有问题，查看日志: journalctl -u research-backend -f${NC}"