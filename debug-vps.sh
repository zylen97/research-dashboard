#!/bin/bash

# 直接SSH到VPS检查问题

echo "=== 直接检查VPS状态 ==="
echo ""

# 创建临时检查脚本
cat > /tmp/vps_check.sh << 'EOF'
#!/bin/bash
echo "=== VPS内部状态检查 ==="
echo "检查时间: $(date)"
echo ""

echo "1. 当前位置和Git状态:"
cd /var/www/research-dashboard || cd /root/research-dashboard
pwd
echo "Git最新提交:"
git log -3 --oneline

echo ""
echo "2. 前端文件状态:"
echo "frontend目录:"
ls -la frontend/ | head -10
echo ""
echo "是否有build.tar.gz:"
ls -la frontend/build.tar.gz 2>/dev/null || echo "❌ 没有build.tar.gz文件"

echo ""
echo "3. Web目录状态:"
ls -la /var/www/html/ | head -10
echo ""
echo "HTML文件内容片段:"
head -5 /var/www/html/index.html 2>/dev/null || echo "❌ 没有index.html"

echo ""
echo "4. 服务状态:"
echo "research-backend服务:"
systemctl status research-backend --no-pager -l | head -10

echo ""
echo "nginx服务:"
systemctl status nginx --no-pager -l | head -5

echo ""
echo "5. 部署日志:"
echo "最近的部署日志:"
tail -20 /var/log/research-dashboard-deploy.log 2>/dev/null || echo "❌ 没有部署日志"

echo ""
echo "6. 进程检查:"
echo "Python进程:"
ps aux | grep python | grep -v grep

echo ""
echo "7. 端口检查:"
echo "监听的端口:"
netstat -tlnp | grep -E ':80|:3001|:8080'

echo ""
echo "=== 检查完成 ==="
EOF

# 上传并执行检查脚本
echo "正在连接VPS并执行检查..."
scp /tmp/vps_check.sh root@45.149.156.216:/tmp/
ssh root@45.149.156.216 "chmod +x /tmp/vps_check.sh && /tmp/vps_check.sh"

# 清理
rm /tmp/vps_check.sh