#!/bin/bash

# 🔍 检查VPS上的自动部署机制
# 帮助确定为什么每次git push都会触发502错误

echo "🔍 检查VPS自动部署机制 - $(date)"
echo "========================================"

# 检查是否在VPS环境
if [ ! -f "/etc/systemd/system/research-backend.service" ]; then
    echo "❌ 不在VPS环境中，请在VPS上执行此脚本"
    exit 1
fi

echo "✅ 确认在VPS环境中"
echo ""

# 1. 检查GitHub webhooks相关服务
echo "=== 1. 检查GitHub webhooks和自动部署服务 ==="

# 检查是否有webhook监听服务
webhook_processes=$(ps aux | grep -E "(webhook|github|deploy)" | grep -v grep)
if [ -n "$webhook_processes" ]; then
    echo "🔍 发现可能的webhook进程:"
    echo "$webhook_processes"
else
    echo "❌ 未发现明显的webhook进程"
fi

# 检查常见webhook端口
common_ports=(9000 3000 8000 4567 5000)
for port in "${common_ports[@]}"; do
    if ss -tlnp | grep ":$port" >/dev/null; then
        listening_process=$(ss -tlnp | grep ":$port")
        echo "🔍 端口 $port 有进程监听: $listening_process"
    fi
done

echo ""

# 2. 检查systemd定时器和path units
echo "=== 2. 检查systemd自动化服务 ==="

# 检查是否有监控文件变化的path unit
path_units=$(systemctl list-units --type=path --all | grep -E "(research|deploy|git)")
if [ -n "$path_units" ]; then
    echo "🔍 发现path监控单元:"
    echo "$path_units"
else
    echo "❌ 未发现path监控单元"
fi

# 检查定时器
timer_units=$(systemctl list-units --type=timer --all | grep -E "(research|deploy|git)")
if [ -n "$timer_units" ]; then
    echo "🔍 发现定时器单元:"
    echo "$timer_units"
else
    echo "❌ 未发现相关定时器"
fi

echo ""

# 3. 检查cron jobs
echo "=== 3. 检查cron任务 ==="

# 检查root用户的cron
root_cron=$(crontab -l 2>/dev/null | grep -E "(git|deploy|research)")
if [ -n "$root_cron" ]; then
    echo "🔍 发现root用户cron任务:"
    echo "$root_cron"
else
    echo "❌ root用户无相关cron任务"
fi

# 检查系统级cron
system_cron=$(grep -r "git\|deploy\|research" /etc/cron* 2>/dev/null)
if [ -n "$system_cron" ]; then
    echo "🔍 发现系统级cron任务:"
    echo "$system_cron"
else
    echo "❌ 未发现系统级cron任务"
fi

echo ""

# 4. 检查git hooks
echo "=== 4. 检查Git hooks ==="

cd /var/www/research-dashboard

if [ -d ".git/hooks" ]; then
    echo "🔍 检查git hooks目录:"
    ls -la .git/hooks/
    
    # 检查是否有可执行的hooks
    executable_hooks=$(find .git/hooks/ -type f -executable 2>/dev/null)
    if [ -n "$executable_hooks" ]; then
        echo ""
        echo "🔍 发现可执行的git hooks:"
        echo "$executable_hooks"
        
        # 显示hooks内容
        for hook in $executable_hooks; do
            echo ""
            echo "--- $hook 内容 ---"
            head -20 "$hook"
            echo "---"
        done
    fi
else
    echo "❌ 未找到git hooks目录"
fi

echo ""

# 5. 检查GitHub Actions runner
echo "=== 5. 检查GitHub Actions runner ==="

# 检查是否有GitHub Actions runner进程
runner_processes=$(ps aux | grep -E "(runner|actions)" | grep -v grep)
if [ -n "$runner_processes" ]; then
    echo "🔍 发现GitHub Actions runner进程:"
    echo "$runner_processes"
    
    # 检查runner目录
    runner_dirs=$(find /opt /home -name "*runner*" -type d 2>/dev/null | head -5)
    if [ -n "$runner_dirs" ]; then
        echo ""
        echo "🔍 发现runner目录:"
        echo "$runner_dirs"
    fi
else
    echo "❌ 未发现GitHub Actions runner"
fi

echo ""

# 6. 检查最近的部署活动
echo "=== 6. 检查最近的部署活动 ==="

# 检查git状态和最近的pull
echo "Git仓库状态:"
git status --porcelain
echo ""
echo "最近的git操作:"
git log --oneline -5

# 检查最近的服务重启
echo ""
echo "最近的backend服务操作:"
journalctl -u research-backend --since="1 hour ago" --no-pager | tail -10

echo ""

# 7. 检查可能的部署脚本
echo "=== 7. 检查部署相关脚本 ==="

# 查找可能的部署脚本
deploy_scripts=$(find /opt /usr/local/bin /home -name "*deploy*" -o -name "*webhook*" -o -name "*github*" 2>/dev/null | grep -v node_modules | head -10)
if [ -n "$deploy_scripts" ]; then
    echo "🔍 发现可能的部署脚本:"
    echo "$deploy_scripts"
else
    echo "❌ 未发现明显的部署脚本"
fi

echo ""

# 8. 检查网络连接和最近的HTTP请求
echo "=== 8. 检查网络活动 ==="

# 检查nginx访问日志中的webhook相关请求
if [ -f "/var/log/nginx/access.log" ]; then
    echo "检查nginx日志中的webhook相关请求:"
    grep -E "(webhook|github|payload)" /var/log/nginx/access.log | tail -5
fi

echo ""
echo "========================================"
echo "🔍 自动部署机制检查完成"
echo ""
echo "📋 下一步建议:"
echo "1. 如果发现webhook进程，检查其配置文件"
echo "2. 如果发现git hooks，分析其执行逻辑"
echo "3. 如果发现GitHub Actions runner，检查其工作流配置"
echo "4. 查看最近的服务日志，找出重启失败的具体原因"
echo ""
echo "🎯 关键问题: 找到 git push -> 自动部署 -> 服务重启失败 的具体环节"