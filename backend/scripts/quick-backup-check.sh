#!/bin/bash

# 快速备份检查脚本 - 可以直接在VPS上运行

echo "=== 快速备份检查 ==="

cd /var/www/research-dashboard/backend

# 检查备份文件
echo "📁 备份文件列表:"
ls -lah backups/production/*.db 2>/dev/null | tail -5 || ls -lah backups/prod/*.db 2>/dev/null | tail -5

echo -e "\n🔍 最新5个备份的数据对比:"

# 获取最新5个备份（检查两个可能的路径）
BACKUPS=($(ls -1t backups/production/*.db 2>/dev/null | head -5))
if [ ${#BACKUPS[@]} -eq 0 ]; then
    BACKUPS=($(ls -1t backups/prod/*.db 2>/dev/null | head -5))
fi

for backup in "${BACKUPS[@]}"; do
    name=$(basename "$backup")
    size=$(du -h "$backup" | cut -f1)
    
    # 获取关键数据
    users=$(sqlite3 "$backup" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    collaborators=$(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;" 2>/dev/null || echo "0")
    projects=$(sqlite3 "$backup" "SELECT COUNT(*) FROM research_projects;" 2>/dev/null || echo "0")
    logs=$(sqlite3 "$backup" "SELECT COUNT(*) FROM communication_logs;" 2>/dev/null || echo "0")
    
    echo "$name ($size): 用户:$users 合作者:$collaborators 项目:$projects 日志:$logs"
done

echo -e "\n📊 当前运行数据库:"
if [ -f "research_dashboard.db" ]; then
    size=$(du -h research_dashboard.db | cut -f1)
    users=$(sqlite3 research_dashboard.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    collaborators=$(sqlite3 research_dashboard.db "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;" 2>/dev/null || echo "0")
    projects=$(sqlite3 research_dashboard.db "SELECT COUNT(*) FROM research_projects;" 2>/dev/null || echo "0")
    logs=$(sqlite3 research_dashboard.db "SELECT COUNT(*) FROM communication_logs;" 2>/dev/null || echo "0")
    echo "当前数据库 ($size): 用户:$users 合作者:$collaborators 项目:$projects 日志:$logs"
else
    echo "❌ 未找到当前数据库文件"
fi

echo -e "\n🔐 最新3个备份的MD5:"
for backup in "${BACKUPS[@]:0:3}"; do
    name=$(basename "$backup")
    md5=$(md5sum "$backup" 2>/dev/null | cut -d' ' -f1 || echo "无法计算")
    echo "$name: $md5"
done

echo -e "\n✅ 检查完成"