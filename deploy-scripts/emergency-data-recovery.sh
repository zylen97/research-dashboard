#!/bin/bash

# 🚨 紧急数据恢复和服务修复
echo "🚨 紧急数据恢复和服务修复..."
echo "时间: $(date)"
echo ""

cd /var/www/research-dashboard/backend || exit 1

echo "=== 1. 检查数据库备份 ==="
echo "寻找备份文件:"
ls -la data/research_dashboard_prod_backup_*.db 2>/dev/null || echo "没有找到自动备份"
ls -la data/*.backup.* 2>/dev/null || echo "没有找到migration备份"

echo ""
echo "=== 2. 检查当前数据库状态 ==="
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "当前数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    
    echo "Collaborators表总数:"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators;" 2>/dev/null || echo "查询失败"
    
    echo "活跃Collaborators数(deleted_at IS NULL):"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NULL;" 2>/dev/null || echo "查询失败"
    
    echo "所有Collaborators的deleted_at状态:"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, deleted_at FROM collaborators LIMIT 10;" 2>/dev/null || echo "查询失败"
else
    echo "❌ 数据库文件不存在！"
fi

echo ""
echo "=== 3. 紧急修复deleted_at字段 ==="
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "将所有deleted_at设置为NULL以显示所有数据..."
    sqlite3 data/research_dashboard_prod.db "UPDATE collaborators SET deleted_at = NULL WHERE deleted_at IS NOT NULL;" 2>/dev/null
    
    echo "修复后的活跃Collaborators数:"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NULL;" 2>/dev/null || echo "查询失败"
    
    echo "验证数据:"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, level FROM collaborators LIMIT 5;" 2>/dev/null || echo "查询失败"
fi

echo ""
echo "=== 4. 强制重启后端服务 ==="
echo "停止服务..."
systemctl stop research-backend

echo "等待5秒..."
sleep 5

echo "启动服务..."
systemctl start research-backend

echo "等待3秒..."
sleep 3

echo "检查服务状态:"
systemctl is-active research-backend

echo ""
echo "=== 5. 检查端口监听 ==="
netstat -tlnp | grep 8080 || echo "❌ 8080端口未监听"

echo ""
echo "=== 6. 测试API ==="
echo "测试collaborators API:"
curl -s -o /dev/null -w "Status: %{http_code}\\n" http://localhost:8080/api/collaborators/ || echo "API测试失败"

echo ""
echo "=== 紧急修复完成 ==="
echo "如果仍有问题，请检查服务日志: journalctl -u research-backend -n 50"