#!/bin/bash

# 🔍 Research Dashboard Nginx 配置诊断脚本
# 用于诊断VPS上的nginx配置问题，特别是端口重定向和502错误
# 
# 使用方法: 
#   ./diagnose-nginx-config.sh                # 完整诊断
#   ./diagnose-nginx-config.sh --quick        # 快速检查
#   ./diagnose-nginx-config.sh --fix          # 自动修复建议的问题
#   ./diagnose-nginx-config.sh --logs-only    # 仅查看日志

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 配置变量
VPS_IP="45.149.156.216"
VPS_PORT="3001"
BACKEND_PORT="8080"
API_ENDPOINT="/api/ideas-management"

# 解析参数
QUICK_MODE=false
FIX_MODE=false
LOGS_ONLY=false

for arg in "$@"; do
    case $arg in
        --quick)
            QUICK_MODE=true
            ;;
        --fix)
            FIX_MODE=true
            ;;
        --logs-only)
            LOGS_ONLY=true
            ;;
        --help|-h)
            echo -e "${BLUE}=== Research Dashboard Nginx 诊断脚本 ===${NC}"
            echo ""
            echo -e "${YELLOW}用法:${NC}"
            echo "  $0                    # 完整诊断（推荐）"
            echo "  $0 --quick           # 快速检查，跳过外部连接测试"
            echo "  $0 --fix             # 自动修复发现的问题"
            echo "  $0 --logs-only       # 仅查看和分析日志"
            echo "  $0 --help            # 显示此帮助信息"
            echo ""
            echo -e "${YELLOW}功能说明:${NC}"
            echo "  🔍 检查nginx服务状态和配置语法"
            echo "  🔍 检查端口3001和8080的监听状态"
            echo "  🔍 检查后端服务运行状态"
            echo "  🔍 测试API连接和重定向问题"
            echo "  🔍 分析nginx错误日志和访问日志"
            echo "  🔧 提供针对性的修复建议"
            echo ""
            echo -e "${YELLOW}常见问题解决:${NC}"
            echo "  • 502 Bad Gateway 错误"
            echo "  • 端口重定向导致端口号丢失"
            echo "  • 后端服务连接问题"
            echo "  • nginx配置错误"
            echo ""
            echo -e "${CYAN}目标环境: http://45.149.156.216:3001${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}未知参数: $arg${NC}"
            echo "用法: $0 [--quick] [--fix] [--logs-only] [--help]"
            echo "使用 $0 --help 查看详细帮助"
            exit 1
            ;;
    esac
done

# 打印标题
print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}  Nginx 配置诊断脚本${NC}"
    echo -e "${BLUE}  Research Dashboard 项目${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo ""
    echo -e "${CYAN}目标环境: http://${VPS_IP}:${VPS_PORT}${NC}"
    echo -e "${CYAN}诊断时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
}

# 仅查看日志模式
if [ "$LOGS_ONLY" = true ]; then
    print_header
    echo -e "${YELLOW}📋 仅查看日志模式${NC}"
    echo ""
    
    echo -e "${CYAN}=== Nginx 错误日志 (最近50行) ===${NC}"
    if [ -f "/var/log/nginx/error.log" ]; then
        tail -50 /var/log/nginx/error.log | while read line; do
            if [[ $line == *"error"* ]] || [[ $line == *"502"* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ $line == *"warn"* ]]; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        done
    else
        echo -e "${RED}❌ 无法访问 /var/log/nginx/error.log${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}=== Nginx 访问日志 (最近20行，端口3001相关) ===${NC}"
    if [ -f "/var/log/nginx/access.log" ]; then
        tail -50 /var/log/nginx/access.log | grep ":3001" | tail -20 | while read line; do
            if [[ $line == *" 502 "* ]] || [[ $line == *" 500 "* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ $line == *" 301 "* ]] || [[ $line == *" 302 "* ]]; then
                echo -e "${YELLOW}$line${NC}"
            elif [[ $line == *" 200 "* ]]; then
                echo -e "${GREEN}$line${NC}"
            else
                echo "$line"
            fi
        done
    else
        echo -e "${RED}❌ 无法访问 /var/log/nginx/access.log${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}=== 系统日志中的 Nginx 相关错误 ===${NC}"
    journalctl -u nginx --since "1 hour ago" --no-pager | head -20
    
    exit 0
fi

print_header

# 诊断函数定义
check_nginx_status() {
    echo -e "${YELLOW}🔍 检查 Nginx 服务状态...${NC}"
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx 服务正在运行${NC}"
        
        # 显示nginx进程信息
        echo -e "${CYAN}进程信息:${NC}"
        ps aux | grep nginx | grep -v grep
    else
        echo -e "${RED}❌ Nginx 服务未运行${NC}"
        echo -e "${YELLOW}建议: 运行 'sudo systemctl start nginx'${NC}"
        return 1
    fi
    
    echo ""
}

check_nginx_config_syntax() {
    echo -e "${YELLOW}🔍 检查 Nginx 配置语法...${NC}"
    
    if nginx -t &>/dev/null; then
        echo -e "${GREEN}✅ Nginx 配置语法正确${NC}"
    else
        echo -e "${RED}❌ Nginx 配置语法错误:${NC}"
        nginx -t 2>&1 | while read line; do
            echo -e "${RED}  $line${NC}"
        done
        return 1
    fi
    
    echo ""
}

check_port_3001_config() {
    echo -e "${YELLOW}🔍 检查端口 3001 配置...${NC}"
    
    # 查找端口3001的配置文件
    local config_files=(
        "/etc/nginx/sites-enabled/research-dashboard-3001"
        "/etc/nginx/sites-available/research-dashboard-3001"
        "/etc/nginx/conf.d/research-dashboard-3001.conf"
    )
    
    local found_config=false
    
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            echo -e "${GREEN}✅ 找到配置文件: $config_file${NC}"
            found_config=true
            
            # 检查监听端口
            if grep -q "listen 3001" "$config_file"; then
                echo -e "${GREEN}✅ 正确监听端口 3001${NC}"
            else
                echo -e "${RED}❌ 未找到 'listen 3001' 配置${NC}"
            fi
            
            # 检查API代理配置
            if grep -q "location /api/" "$config_file"; then
                echo -e "${GREEN}✅ 找到 API 代理配置${NC}"
                echo -e "${CYAN}API 代理配置:${NC}"
                grep -A 10 "location /api/" "$config_file" | while read line; do
                    echo -e "${CYAN}  $line${NC}"
                done
            else
                echo -e "${RED}❌ 未找到 API 代理配置${NC}"
            fi
            
            # 检查proxy_pass配置
            local proxy_pass=$(grep "proxy_pass" "$config_file" || true)
            if [ -n "$proxy_pass" ]; then
                echo -e "${CYAN}Proxy Pass 配置: $proxy_pass${NC}"
                
                # 检查是否指向正确的后端端口
                if [[ $proxy_pass == *"localhost:$BACKEND_PORT"* ]] || [[ $proxy_pass == *"127.0.0.1:$BACKEND_PORT"* ]]; then
                    echo -e "${GREEN}✅ 后端代理端口配置正确 ($BACKEND_PORT)${NC}"
                else
                    echo -e "${YELLOW}⚠️ 后端代理端口可能不正确${NC}"
                    echo -e "${YELLOW}期望: localhost:$BACKEND_PORT${NC}"
                    echo -e "${YELLOW}实际: $proxy_pass${NC}"
                fi
            else
                echo -e "${RED}❌ 未找到 proxy_pass 配置${NC}"
            fi
            
            echo ""
        fi
    done
    
    if [ "$found_config" = false ]; then
        echo -e "${RED}❌ 未找到端口 3001 的 Nginx 配置文件${NC}"
        echo -e "${YELLOW}期望位置:${NC}"
        for config_file in "${config_files[@]}"; do
            echo -e "${YELLOW}  - $config_file${NC}"
        done
        return 1
    fi
    
    echo ""
}

check_port_listening() {
    echo -e "${YELLOW}🔍 检查端口监听状态...${NC}"
    
    # 检查端口3001
    if netstat -tuln | grep -q ":3001 "; then
        echo -e "${GREEN}✅ 端口 3001 正在监听${NC}"
        netstat -tuln | grep ":3001 " | while read line; do
            echo -e "${GREEN}  $line${NC}"
        done
    else
        echo -e "${RED}❌ 端口 3001 未在监听${NC}"
    fi
    
    # 检查后端端口8080
    if netstat -tuln | grep -q ":$BACKEND_PORT "; then
        echo -e "${GREEN}✅ 后端端口 $BACKEND_PORT 正在监听${NC}"
        netstat -tuln | grep ":$BACKEND_PORT " | while read line; do
            echo -e "${GREEN}  $line${NC}"
        done
    else
        echo -e "${RED}❌ 后端端口 $BACKEND_PORT 未在监听${NC}"
        echo -e "${YELLOW}这可能是 502 错误的原因${NC}"
    fi
    
    echo ""
}

check_backend_service() {
    echo -e "${YELLOW}🔍 检查后端服务状态...${NC}"
    
    # 检查systemd服务
    local service_names=("research-backend" "research-dashboard" "fastapi")
    local found_service=false
    
    for service in "${service_names[@]}"; do
        if systemctl list-units --all | grep -q "$service"; then
            echo -e "${GREEN}✅ 找到服务: $service${NC}"
            found_service=true
            
            if systemctl is-active --quiet "$service"; then
                echo -e "${GREEN}✅ 服务 $service 正在运行${NC}"
            else
                echo -e "${RED}❌ 服务 $service 未运行${NC}"
                echo -e "${YELLOW}状态详情:${NC}"
                systemctl status "$service" --no-pager -l | head -10
            fi
        fi
    done
    
    if [ "$found_service" = false ]; then
        echo -e "${YELLOW}⚠️ 未找到已知的后端服务${NC}"
        echo -e "${YELLOW}检查是否有Python进程在端口 $BACKEND_PORT 运行...${NC}"
        
        local python_process=$(ps aux | grep python | grep -v grep | grep -E "(main\.py|uvicorn|fastapi)" || true)
        if [ -n "$python_process" ]; then
            echo -e "${GREEN}✅ 找到Python后端进程:${NC}"
            echo "$python_process" | while read line; do
                echo -e "${GREEN}  $line${NC}"
            done
        else
            echo -e "${RED}❌ 未找到Python后端进程${NC}"
        fi
    fi
    
    echo ""
}

test_api_connectivity() {
    echo -e "${YELLOW}🔍 测试 API 连接...${NC}"
    
    # 测试本地后端连接
    echo -e "${CYAN}测试本地后端 (localhost:$BACKEND_PORT)...${NC}"
    if curl -s --connect-timeout 5 "http://localhost:$BACKEND_PORT/api/" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 本地后端连接成功${NC}"
    else
        echo -e "${RED}❌ 本地后端连接失败${NC}"
        echo -e "${YELLOW}这可能是 502 错误的根本原因${NC}"
    fi
    
    # 测试通过nginx的连接
    echo -e "${CYAN}测试通过 Nginx 的连接 (localhost:3001)...${NC}"
    local nginx_response=$(curl -s -w "%{http_code}" --connect-timeout 5 "http://localhost:3001$API_ENDPOINT" 2>/dev/null || echo "000")
    
    case $nginx_response in
        *200*)
            echo -e "${GREEN}✅ Nginx 代理连接成功 (200)${NC}"
            ;;
        *301*|*302*)
            echo -e "${YELLOW}⚠️ 发生重定向 ($nginx_response)${NC}"
            echo -e "${YELLOW}这可能就是你遇到的问题 - 重定向时端口号丢失${NC}"
            ;;
        *502*)
            echo -e "${RED}❌ 502 Bad Gateway 错误${NC}"
            echo -e "${YELLOW}这确认了你遇到的问题${NC}"
            ;;
        *000*)
            echo -e "${RED}❌ 连接失败${NC}"
            ;;
        *)
            echo -e "${YELLOW}⚠️ 收到响应码: $nginx_response${NC}"
            ;;
    esac
    
    # 测试外部访问
    if [ "$QUICK_MODE" = false ]; then
        echo -e "${CYAN}测试外部访问 ($VPS_IP:$VPS_PORT)...${NC}"
        local external_response=$(curl -s -w "%{http_code}" --connect-timeout 10 "http://$VPS_IP:$VPS_PORT$API_ENDPOINT" 2>/dev/null || echo "000")
        
        case $external_response in
            *200*)
                echo -e "${GREEN}✅ 外部访问成功 (200)${NC}"
                ;;
            *301*|*302*)
                echo -e "${YELLOW}⚠️ 外部访问发生重定向 ($external_response)${NC}"
                ;;
            *502*)
                echo -e "${RED}❌ 外部访问 502 错误${NC}"
                ;;
            *000*)
                echo -e "${RED}❌ 外部访问失败${NC}"
                ;;
            *)
                echo -e "${YELLOW}⚠️ 外部访问响应码: $external_response${NC}"
                ;;
        esac
    fi
    
    echo ""
}

check_nginx_logs() {
    echo -e "${YELLOW}🔍 分析 Nginx 日志...${NC}"
    
    # 检查错误日志
    if [ -f "/var/log/nginx/error.log" ]; then
        echo -e "${CYAN}最近的错误日志 (与端口3001相关):${NC}"
        tail -20 /var/log/nginx/error.log | grep -E "(3001|$BACKEND_PORT|502|upstream)" | while read line; do
            if [[ $line == *"502"* ]] || [[ $line == *"upstream"* ]]; then
                echo -e "${RED}  $line${NC}"
            else
                echo -e "${YELLOW}  $line${NC}"
            fi
        done || echo -e "${YELLOW}  没有找到相关错误${NC}"
    else
        echo -e "${RED}❌ 无法访问 /var/log/nginx/error.log${NC}"
    fi
    
    echo ""
    
    # 检查访问日志中的重定向
    if [ -f "/var/log/nginx/access.log" ]; then
        echo -e "${CYAN}最近的重定向记录 (3xx状态码):${NC}"
        tail -50 /var/log/nginx/access.log | grep -E " 30[1-9] " | grep "3001" | tail -5 | while read line; do
            echo -e "${YELLOW}  $line${NC}"
        done || echo -e "${YELLOW}  没有找到重定向记录${NC}"
        
        echo ""
        echo -e "${CYAN}最近的502错误记录:${NC}"
        tail -50 /var/log/nginx/access.log | grep " 502 " | tail -5 | while read line; do
            echo -e "${RED}  $line${NC}"
        done || echo -e "${YELLOW}  没有找到502错误记录${NC}"
    else
        echo -e "${RED}❌ 无法访问 /var/log/nginx/access.log${NC}"
    fi
    
    echo ""
}

analyze_redirect_issue() {
    echo -e "${YELLOW}🔍 分析重定向问题...${NC}"
    
    # 检查可能导致重定向的配置
    local config_files=(
        "/etc/nginx/sites-enabled/research-dashboard-3001"
        "/etc/nginx/sites-available/research-dashboard-3001"
        "/etc/nginx/conf.d/research-dashboard-3001.conf"
    )
    
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            echo -e "${CYAN}检查配置文件: $config_file${NC}"
            
            # 检查可能导致重定向的配置项
            local issues_found=false
            
            # 检查 server_name 配置
            local server_name=$(grep "server_name" "$config_file" || true)
            if [ -n "$server_name" ]; then
                echo -e "${CYAN}Server Name: $server_name${NC}"
                if [[ $server_name != *"$VPS_IP"* ]]; then
                    echo -e "${YELLOW}⚠️ server_name 中可能缺少 $VPS_IP${NC}"
                    issues_found=true
                fi
            fi
            
            # 检查是否有trailing slash重定向
            if grep -q "try_files.*\$uri/" "$config_file"; then
                echo -e "${YELLOW}⚠️ 发现 try_files 配置中有尾部斜杠，可能导致重定向${NC}"
                grep "try_files" "$config_file" | while read line; do
                    echo -e "${YELLOW}  $line${NC}"
                done
                issues_found=true
            fi
            
            # 检查Location块配置
            if grep -q "location.*\/$" "$config_file"; then
                echo -e "${YELLOW}⚠️ 发现以斜杠结尾的location配置，检查是否合适${NC}"
                grep "location.*\/$" "$config_file" | while read line; do
                    echo -e "${YELLOW}  $line${NC}"
                done
            fi
            
            # 检查proxy_pass末尾是否有斜杠
            local proxy_pass_line=$(grep "proxy_pass" "$config_file" || true)
            if [ -n "$proxy_pass_line" ]; then
                if [[ $proxy_pass_line == *"proxy_pass http"*";" ]]; then
                    if [[ $proxy_pass_line != *"/" ]]; then
                        echo -e "${YELLOW}⚠️ proxy_pass 末尾可能需要斜杠${NC}"
                        echo -e "${YELLOW}  当前: $proxy_pass_line${NC}"
                        issues_found=true
                    fi
                fi
            fi
            
            if [ "$issues_found" = false ]; then
                echo -e "${GREEN}✅ 未发现明显的重定向配置问题${NC}"
            fi
        fi
    done
    
    echo ""
}

provide_fix_suggestions() {
    echo -e "${YELLOW}🔧 修复建议...${NC}"
    echo ""
    
    echo -e "${BLUE}=== 主要问题和解决方案 ===${NC}"
    echo ""
    
    # 检查后端服务状态
    if ! curl -s --connect-timeout 5 "http://localhost:$BACKEND_PORT/api/" > /dev/null 2>&1; then
        echo -e "${RED}1. 后端服务问题 (可能是502错误的根本原因)${NC}"
        echo -e "${YELLOW}   解决方案:${NC}"
        echo -e "${CYAN}   sudo systemctl status research-backend${NC}"
        echo -e "${CYAN}   sudo systemctl restart research-backend${NC}"
        echo -e "${CYAN}   journalctl -u research-backend -f${NC}"
        echo ""
    fi
    
    # 检查nginx配置
    echo -e "${RED}2. 重定向问题修复${NC}"
    echo -e "${YELLOW}   解决方案:${NC}"
    echo -e "${CYAN}   # 检查nginx配置中的API location块${NC}"
    echo -e "${CYAN}   sudo nano /etc/nginx/sites-enabled/research-dashboard-3001${NC}"
    echo ""
    echo -e "${YELLOW}   确保API配置如下:${NC}"
    echo -e "${GREEN}   location /api/ {${NC}"
    echo -e "${GREEN}       proxy_pass http://localhost:$BACKEND_PORT/;${NC}"
    echo -e "${GREEN}       proxy_set_header Host \$host:\$server_port;${NC}"
    echo -e "${GREEN}       proxy_set_header X-Real-IP \$remote_addr;${NC}"
    echo -e "${GREEN}       proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;${NC}"
    echo -e "${GREEN}       proxy_set_header X-Forwarded-Proto \$scheme;${NC}"
    echo -e "${GREEN}   }${NC}"
    echo ""
    
    echo -e "${RED}3. 重启服务${NC}"
    echo -e "${YELLOW}   解决方案:${NC}"
    echo -e "${CYAN}   sudo nginx -t                    # 测试配置${NC}"
    echo -e "${CYAN}   sudo systemctl reload nginx     # 重载nginx${NC}"
    echo -e "${CYAN}   sudo systemctl restart research-backend  # 重启后端${NC}"
    echo ""
    
    echo -e "${RED}4. 端口和防火墙检查${NC}"
    echo -e "${YELLOW}   解决方案:${NC}"
    echo -e "${CYAN}   sudo ufw status                  # 检查防火墙${NC}"
    echo -e "${CYAN}   sudo ufw allow 3001              # 允许端口3001${NC}"
    echo -e "${CYAN}   netstat -tuln | grep -E ':(3001|$BACKEND_PORT) '${NC}"
    echo ""
    
    if [ "$FIX_MODE" = true ]; then
        echo -e "${YELLOW}=== 自动修复模式 ===${NC}"
        echo -e "${YELLOW}正在尝试自动修复...${NC}"
        
        # 重启后端服务
        echo -e "${CYAN}重启后端服务...${NC}"
        if systemctl list-units --all | grep -q "research-backend"; then
            sudo systemctl restart research-backend
            echo -e "${GREEN}✅ 后端服务已重启${NC}"
        fi
        
        # 重载nginx
        echo -e "${CYAN}重载nginx配置...${NC}"
        if nginx -t; then
            sudo systemctl reload nginx
            echo -e "${GREEN}✅ Nginx配置已重载${NC}"
        else
            echo -e "${RED}❌ Nginx配置有误，跳过重载${NC}"
        fi
        
        # 等待几秒后测试
        echo -e "${CYAN}等待服务启动...${NC}"
        sleep 5
        
        echo -e "${CYAN}重新测试连接...${NC}"
        test_api_connectivity
    fi
}

# 主执行流程
main() {
    print_header
    
    # 基础检查
    check_nginx_status || exit 1
    check_nginx_config_syntax || exit 1
    
    # 详细检查
    check_port_3001_config
    check_port_listening
    check_backend_service
    
    if [ "$QUICK_MODE" = false ]; then
        test_api_connectivity
        check_nginx_logs
        analyze_redirect_issue
    fi
    
    # 提供修复建议
    provide_fix_suggestions
    
    echo ""
    echo -e "${BLUE}=== 诊断完成 ===${NC}"
    echo -e "${CYAN}时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
    echo -e "${YELLOW}💡 提示: 使用 --logs-only 参数查看详细日志${NC}"
    echo -e "${YELLOW}💡 提示: 使用 --fix 参数尝试自动修复${NC}"
}

# 检查是否以root权限运行（某些命令需要）
if [[ $EUID -ne 0 ]] && [[ "$1" != "--help" ]]; then
    echo -e "${YELLOW}⚠️ 某些检查可能需要sudo权限${NC}"
    echo -e "${YELLOW}建议使用: sudo $0 $@${NC}"
    echo ""
fi

# 执行主函数
main