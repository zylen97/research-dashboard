#!/bin/bash

# VPS部署检查脚本
# 用于诊断前端部署问题

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Research Dashboard 部署诊断 ===${NC}"
echo -e "检查时间: $(date)"
echo ""

# 1. 检查Nginx配置
echo -e "${CYAN}[1] Nginx配置检查：${NC}"
echo "Sites-enabled目录内容："
ls -la /etc/nginx/sites-enabled/ | grep -E "(3001|research|html)" || echo "未找到相关配置"
echo ""

echo "查找所有nginx配置中的3001端口："
grep -r "listen.*3001" /etc/nginx/ 2>/dev/null || echo "未找到3001端口配置"
echo ""

# 2. 检查端口监听
echo -e "${CYAN}[2] 端口监听检查：${NC}"
netstat -tlnp | grep -E "(3001|80|8080)" || echo "未找到相关端口"
echo ""

# 3. 检查前端文件位置
echo -e "${CYAN}[3] 前端文件检查：${NC}"
echo "/var/www/html/目录内容："
ls -la /var/www/html/ | head -10
echo ""

echo "检查index.html中的JS文件版本："
grep -o 'main\.[^"]*\.js' /var/www/html/index.html 2>/dev/null | head -1 || echo "未找到main.js引用"
echo ""

echo "实际JS文件："
ls -la /var/www/html/static/js/main.*.js 2>/dev/null || echo "未找到main.js文件"
echo ""

# 4. 检查其他可能的前端目录
echo -e "${CYAN}[4] 其他可能的前端目录：${NC}"
echo "检查/var/www/research-dashboard/frontend/build："
ls -la /var/www/research-dashboard/frontend/build/ 2>/dev/null | head -5 || echo "目录不存在"
echo ""

# 5. 检查Nginx错误日志
echo -e "${CYAN}[5] Nginx错误日志（最近10行）：${NC}"
tail -10 /var/log/nginx/error.log 2>/dev/null || echo "无法读取错误日志"
echo ""

# 6. 检查部署日志
echo -e "${CYAN}[6] 部署日志（最近20行）：${NC}"
tail -20 /var/log/research-dashboard-deploy.log 2>/dev/null || echo "无法读取部署日志"
echo ""

# 7. 检查进程
echo -e "${CYAN}[7] 相关进程检查：${NC}"
ps aux | grep -E "(nginx|node|python)" | grep -v grep | head -10
echo ""

# 8. 检查build.tar.gz
echo -e "${CYAN}[8] 构建文件检查：${NC}"
if [ -f "/var/www/research-dashboard/frontend/build.tar.gz" ]; then
    echo "build.tar.gz存在，检查其中的JS版本："
    cd /var/www/research-dashboard/frontend
    tar -tzf build.tar.gz | grep "main.*\.js$" | head -1
    echo "文件时间戳："
    ls -la build.tar.gz
else
    echo "build.tar.gz不存在"
fi
echo ""

# 9. 测试实际访问
echo -e "${CYAN}[9] 实际访问测试：${NC}"
echo "测试3001端口响应："
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://localhost:3001
echo ""

echo "获取实际返回的JS版本："
curl -s http://localhost:3001 | grep -o 'main\.[^"]*\.js' | head -1 || echo "无法获取JS版本"
echo ""

# 10. 系统状态
echo -e "${CYAN}[10] 系统状态：${NC}"
echo "磁盘空间："
df -h | grep -E "(/$|/var)"
echo ""

echo -e "${GREEN}=== 诊断完成 ===${NC}"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo "1. 如果3001端口没有nginx监听，检查nginx配置"
echo "2. 如果JS版本不匹配，可能是缓存或部署路径问题"
echo "3. 如果build.tar.gz版本正确但网站显示旧版本，需要检查nginx配置指向的目录"