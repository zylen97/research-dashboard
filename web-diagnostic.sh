#!/bin/bash

# 🔍 Web可访问的系统诊断脚本
# 将所有诊断信息输出到Web目录，通过HTTP查看

DIAGNOSTIC_DIR="/var/www/html/diagnostic"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$DIAGNOSTIC_DIR/system_report_$TIMESTAMP.html"

# 创建诊断目录
mkdir -p "$DIAGNOSTIC_DIR"

# 开始生成HTML报告
cat > "$REPORT_FILE" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>VPS系统诊断报告</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #00ff00; }
        .section { border: 1px solid #333; margin: 10px 0; padding: 15px; background: #2a2a2a; }
        .error { color: #ff4444; }
        .warning { color: #ffaa00; }
        .success { color: #44ff44; }
        .header { color: #00aaff; font-size: 18px; font-weight: bold; }
        pre { overflow-x: auto; background: #1a1a1a; padding: 10px; border-left: 3px solid #00ff00; }
    </style>
</head>
<body>
    <h1>🔍 VPS系统诊断报告</h1>
    <p>生成时间: $(date)</p>
    <p>VPS地址: 45.149.156.216</p>
EOF

# 函数：添加章节
add_section() {
    local title="$1"
    local content="$2"
    echo "<div class='section'>" >> "$REPORT_FILE"
    echo "<div class='header'>$title</div>" >> "$REPORT_FILE"
    echo "<pre>$content</pre>" >> "$REPORT_FILE"
    echo "</div>" >> "$REPORT_FILE"
}

# 1. 系统基本信息
echo "收集系统基本信息..."
SYSTEM_INFO=$(cat << 'INFO'
主机名: $(hostname)
系统版本: $(cat /etc/os-release | grep PRETTY_NAME)
内核版本: $(uname -r)
当前时间: $(date)
运行时间: $(uptime)
系统负载: $(cat /proc/loadavg)
INFO
)
add_section "📊 系统基本信息" "$(eval echo "$SYSTEM_INFO")"

# 2. 内存和磁盘状况
echo "检查资源状况..."
RESOURCE_INFO=$(free -h && echo -e "\n=== 磁盘使用 ===" && df -h && echo -e "\n=== /var/www 目录大小 ===" && du -sh /var/www/* 2>/dev/null)
add_section "💾 内存和磁盘状况" "$RESOURCE_INFO"

# 3. 服务状态详情
echo "检查服务状态..."
SERVICE_INFO=$(cat << 'SVCINFO'
=== research-backend 服务状态 ===
$(systemctl status research-backend --no-pager -l 2>&1)

=== nginx 服务状态 ===  
$(systemctl status nginx --no-pager -l 2>&1)

=== 所有Python进程 ===
$(ps aux | grep python | grep -v grep)

=== 端口监听状况 ===
$(netstat -tulpn | grep -E ":(22|3001|8080)")

=== systemd 单元失败 ===
$(systemctl --failed --no-pager)
SVCINFO
)
add_section "🚀 服务状态详情" "$(eval echo "$SERVICE_INFO")"

# 4. 后端服务详细日志
echo "收集后端日志..."
BACKEND_LOGS=$(journalctl -u research-backend -n 50 --no-pager 2>&1)
add_section "📋 后端服务日志 (最近50条)" "$BACKEND_LOGS"

# 5. 项目文件状况
echo "检查项目文件..."
PROJECT_INFO=$(cat << 'PROJINFO'
=== 项目目录结构 ===
$(ls -la /var/www/research-dashboard/ 2>&1)

=== 后端目录 ===
$(ls -la /var/www/research-dashboard/backend/ 2>&1)

=== 后端配置文件 ===
$(if [ -f /var/www/research-dashboard/backend/.env ]; then
    echo "✅ .env 文件存在"
    echo "文件大小: $(wc -c < /var/www/research-dashboard/backend/.env) bytes"
    echo "权限: $(ls -l /var/www/research-dashboard/backend/.env)"
else
    echo "❌ .env 文件不存在"
fi)

=== 数据库文件 ===
$(if [ -f /var/www/research-dashboard/backend/data/research_dashboard_prod.db ]; then
    echo "✅ 数据库文件存在"
    echo "文件大小: $(ls -lh /var/www/research-dashboard/backend/data/research_dashboard_prod.db)"
    echo "数据库表检查: $(sqlite3 /var/www/research-dashboard/backend/data/research_dashboard_prod.db ".tables" 2>&1)"
else
    echo "❌ 数据库文件不存在"
fi)

=== Python环境检查 ===
$(cd /var/www/research-dashboard/backend && python3 -c "
import sys
print('Python版本:', sys.version)
try:
    import fastapi, uvicorn, sqlalchemy
    print('✅ 核心依赖可用')
except ImportError as e:
    print('❌ 依赖缺失:', e)
try:
    from main import app
    print('✅ main.py 可导入')
except Exception as e:
    print('❌ main.py 导入失败:', e)
" 2>&1)
PROJINFO
)
add_section "📁 项目文件状况" "$(eval echo "$PROJECT_INFO")"

# 6. 网络和连接
echo "检查网络状况..."
NETWORK_INFO=$(cat << 'NETINFO'
=== 网络接口 ===
$(ip addr show)

=== 防火墙状态 ===
$(ufw status 2>&1 || iptables -L 2>&1 | head -20)

=== nginx配置检查 ===
$(nginx -t 2>&1)

=== nginx配置文件关键部分 ===
$(grep -A 5 -B 5 "proxy_pass" /etc/nginx/sites-available/research-dashboard-3001 2>&1)
NETINFO
)
add_section "🌐 网络和连接" "$(eval echo "$NETWORK_INFO")"

# 7. 近期系统日志错误
echo "检查系统错误..."
SYSTEM_ERRORS=$(journalctl --since "1 hour ago" --priority=err --no-pager 2>&1 | tail -50)
add_section "⚠️ 近期系统错误" "$SYSTEM_ERRORS"

# 8. 手动启动测试
echo "尝试手动启动测试..."
MANUAL_TEST=$(cat << 'MANUAL'
=== 尝试手动启动后端 ===
$(cd /var/www/research-dashboard/backend && timeout 10 python3 main.py 2>&1 | head -20)

=== 检查端口占用变化 ===
$(netstat -tulpn | grep :8080)
MANUAL
)
add_section "🔧 手动启动测试" "$(eval echo "$MANUAL_TEST")"

# 结束HTML
cat >> "$REPORT_FILE" << 'EOF'
    <div class="section">
        <div class="header">🎯 诊断建议</div>
        <pre>
1. 如果Python依赖缺失 → 重新安装依赖
2. 如果数据库损坏 → 检查迁移脚本
3. 如果systemd失效 → 重新创建服务配置
4. 如果内存不足 → 重启VPS或升级配置
5. 如果权限问题 → 检查文件所有者
        </pre>
    </div>
    <p>访问地址: <a href="." style="color: #00aaff;">http://45.149.156.216:3001/diagnostic/</a></p>
</body>
</html>
EOF

# 创建索引页面
cat > "$DIAGNOSTIC_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>VPS诊断中心</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #00ff00; }
        a { color: #00aaff; }
        .latest { color: #ffaa00; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🔍 VPS诊断中心</h1>
    <h2>诊断报告列表:</h2>
    <ul>
EOF

# 添加所有报告链接
for report in $(ls -t "$DIAGNOSTIC_DIR"/system_report_*.html 2>/dev/null); do
    filename=$(basename "$report")
    if [[ "$filename" == "system_report_$TIMESTAMP.html" ]]; then
        echo "<li><a href='$filename' class='latest'>$filename (最新)</a></li>" >> "$DIAGNOSTIC_DIR/index.html"
    else
        echo "<li><a href='$filename'>$filename</a></li>" >> "$DIAGNOSTIC_DIR/index.html"
    fi
done

cat >> "$DIAGNOSTIC_DIR/index.html" << 'EOF'
    </ul>
    <p>刷新页面查看最新诊断结果</p>
</body>
</html>
EOF

# 设置权限
chmod 755 "$DIAGNOSTIC_DIR"
chmod 644 "$DIAGNOSTIC_DIR"/*.html

echo "✅ 诊断报告已生成"
echo "📍 访问地址: http://45.149.156.216:3001/diagnostic/"
echo "📝 报告文件: $REPORT_FILE"

# 显示简要摘要到控制台
echo ""
echo "=== 快速摘要 ==="
echo "后端服务状态: $(systemctl is-active research-backend 2>/dev/null || echo '未知')"
echo "端口8080监听: $(netstat -tulpn | grep :8080 | wc -l)个进程"
echo "Python进程数: $(ps aux | grep python | grep -v grep | wc -l)个"
echo "系统负载: $(cat /proc/loadavg | cut -d' ' -f1-3)"
echo "可用内存: $(free -h | grep '^Mem:' | awk '{print $7}')"