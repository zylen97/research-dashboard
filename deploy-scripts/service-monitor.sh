#!/bin/bash

# 🔄 服务监控和自动恢复脚本
# 定期检查服务状态，自动修复502错误

echo "🔄 Research Dashboard 服务监控启动 - $(date)"

# 配置参数
CHECK_INTERVAL=30  # 检查间隔（秒）
MAX_FAILURES=3     # 最大失败次数
FAILURE_COUNT=0    # 失败计数器
LOG_FILE="/tmp/service-monitor-$(date +%Y%m%d).log"

# 记录日志
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a "$LOG_FILE"
}

# 检查服务状态
check_service_status() {
    local service_name=$1
    systemctl is-active "$service_name" >/dev/null 2>&1
    return $?
}

# 检查API健康状态
check_api_health() {
    local url=$1
    local timeout=10
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $timeout "$url" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# 自动修复服务
auto_repair_service() {
    log_message "🚨 检测到服务异常，开始自动修复"
    
    # 执行紧急修复脚本
    if [ -f "/var/www/research-dashboard/emergency-fix-502.sh" ]; then
        log_message "执行紧急修复脚本"
        cd /var/www/research-dashboard
        bash emergency-fix-502.sh >> "$LOG_FILE" 2>&1
        
        if [ $? -eq 0 ]; then
            log_message "自动修复完成"
            FAILURE_COUNT=0
            return 0
        else
            log_message "自动修复失败"
            return 1
        fi
    else
        log_message "紧急修复脚本不存在"
        return 1
    fi
}

# 发送告警（可以扩展为邮件、企业微信等）
send_alert() {
    local message=$1
    log_message "🚨 ALERT: $message"
    
    # 可以在这里添加邮件、Webhook等告警机制
    # 例如：curl -X POST -H 'Content-type: application/json' --data '{"text":"'$message'"}' YOUR_WEBHOOK_URL
}

# 主监控循环
monitor_services() {
    log_message "开始监控服务"
    
    while true; do
        # 检查时间戳，防止日志过大
        current_hour=$(date +%H)
        if [ "$current_hour" = "00" ] && [ ! -f "/tmp/log_rotated_$(date +%Y%m%d)" ]; then
            # 每天轮转日志
            mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d_%H%M%S)"
            touch "/tmp/log_rotated_$(date +%Y%m%d)"
            log_message "日志已轮转"
        fi
        
        # 检查nginx服务
        if ! check_service_status "nginx"; then
            log_message "❌ Nginx服务异常"
            ((FAILURE_COUNT++))
        elif ! check_service_status "research-backend"; then
            log_message "❌ Research Backend服务异常"
            ((FAILURE_COUNT++))
        elif ! check_api_health "http://localhost:8080/api/health"; then
            log_message "❌ Backend API健康检查失败"
            ((FAILURE_COUNT++))
        elif ! check_api_health "http://localhost:3001/api/health"; then
            log_message "❌ Nginx代理健康检查失败"
            ((FAILURE_COUNT++))
        else
            # 所有检查通过
            if [ $FAILURE_COUNT -gt 0 ]; then
                log_message "✅ 服务恢复正常"
                FAILURE_COUNT=0
            fi
        fi
        
        # 处理失败情况
        if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            log_message "连续失败 $FAILURE_COUNT 次，触发自动修复"
            
            if auto_repair_service; then
                log_message "自动修复成功"
                FAILURE_COUNT=0
            else
                log_message "自动修复失败，发送告警"
                send_alert "Research Dashboard服务异常，自动修复失败，需要人工介入"
                
                # 防止持续告警，设置冷却时间
                log_message "进入告警冷却期（5分钟）"
                sleep 300
                FAILURE_COUNT=0
            fi
        fi
        
        # 等待下次检查
        sleep $CHECK_INTERVAL
    done
}

# 信号处理
cleanup() {
    log_message "监控服务正在关闭"
    exit 0
}

trap cleanup SIGTERM SIGINT

# 显示使用说明
show_usage() {
    echo "使用方法："
    echo "  $0                    # 启动监控服务"
    echo "  $0 --daemon           # 后台运行"
    echo "  $0 --check            # 单次检查"
    echo "  $0 --stop             # 停止后台监控"
    echo ""
    echo "配置："
    echo "  检查间隔: ${CHECK_INTERVAL}秒"
    echo "  失败阈值: ${MAX_FAILURES}次"
    echo "  日志文件: $LOG_FILE"
}

# 参数处理
case "${1:-}" in
    --daemon)
        log_message "以守护进程模式启动监控"
        nohup "$0" > /dev/null 2>&1 &
        echo $! > /tmp/service-monitor.pid
        echo "监控服务已启动，PID: $(cat /tmp/service-monitor.pid)"
        echo "日志文件: $LOG_FILE"
        ;;
    --check)
        log_message "执行单次健康检查"
        
        echo "=== 服务状态检查 ==="
        echo -n "Nginx: "
        check_service_status "nginx" && echo "✅ 正常" || echo "❌ 异常"
        
        echo -n "Backend: "
        check_service_status "research-backend" && echo "✅ 正常" || echo "❌ 异常"
        
        echo -n "Backend API: "
        check_api_health "http://localhost:8080/api/health" && echo "✅ 正常" || echo "❌ 异常"
        
        echo -n "Nginx代理: "
        check_api_health "http://localhost:3001/api/health" && echo "✅ 正常" || echo "❌ 异常"
        
        echo ""
        echo "详细信息请查看日志: $LOG_FILE"
        ;;
    --stop)
        if [ -f /tmp/service-monitor.pid ]; then
            pid=$(cat /tmp/service-monitor.pid)
            if kill "$pid" 2>/dev/null; then
                echo "监控服务已停止 (PID: $pid)"
                rm -f /tmp/service-monitor.pid
            else
                echo "无法停止监控服务，可能已经停止"
                rm -f /tmp/service-monitor.pid
            fi
        else
            echo "监控服务未运行"
        fi
        ;;
    --help|-h)
        show_usage
        ;;
    "")
        log_message "交互式监控模式启动"
        echo "按 Ctrl+C 停止监控"
        monitor_services
        ;;
    *)
        echo "未知参数: $1"
        show_usage
        exit 1
        ;;
esac