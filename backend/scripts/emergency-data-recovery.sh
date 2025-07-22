#!/bin/bash

# 紧急数据恢复检查脚本
# 用于排查VPS上的数据丢失问题

set -e

echo "🚨 === 紧急数据恢复检查 === 🚨"

cd /var/www/research-dashboard

# 1. 寻找所有可能的数据库文件
echo "🔍 1. 搜索所有数据库文件:"
find . -name "*.db" -type f 2>/dev/null | while read db; do
    size=$(du -h "$db" | cut -f1)
    echo "找到: $db ($size)"
    
    # 快速检查内容
    if command -v sqlite3 >/dev/null 2>&1; then
        users=$(sqlite3 "$db" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "无法读取")
        collaborators=$(sqlite3 "$db" "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;" 2>/dev/null || echo "无法读取")
        echo "  → 用户:$users 合作者:$collaborators"
    fi
done

# 2. 寻找所有可能的备份目录
echo -e "\n🗂️ 2. 搜索备份目录:"
find . -name "backup*" -type d 2>/dev/null || echo "未找到backup目录"
find . -name "*backup*" -type f 2>/dev/null | head -10 || echo "未找到backup文件"

# 3. 检查Git历史中的数据库文件
echo -e "\n📜 3. 检查Git中是否有数据库文件:"
git log --name-only --pretty=format: | grep -E "\.db$" | sort | uniq || echo "Git历史中无数据库文件"

# 4. 寻找所有可能包含数据的文件
echo -e "\n🔎 4. 搜索可能的数据备份文件:"
find . -name "*.backup*" -type f 2>/dev/null || echo "未找到.backup文件"
find . -name "*.bak" -type f 2>/dev/null || echo "未找到.bak文件"
find . -name "*.sql" -type f 2>/dev/null || echo "未找到.sql文件"

# 5. 检查系统备份（如果有）
echo -e "\n💾 5. 检查系统级备份:"
if [ -d "/var/backups" ]; then
    ls -la /var/backups/ | grep -i research || echo "系统备份中无research相关文件"
fi

# 6. 检查临时文件
echo -e "\n📁 6. 检查临时目录:"
ls -la /tmp/ | grep -E "(research|db|backup)" || echo "临时目录无相关文件"

# 7. 检查当前进程使用的数据库
echo -e "\n🔄 7. 检查当前进程:"
ps aux | grep -E "(python|uvicorn|research)" | grep -v grep || echo "未找到相关进程"

# 8. 检查最近修改的文件
echo -e "\n⏰ 8. 最近修改的数据库相关文件:"
find . -name "*.db" -mtime -1 2>/dev/null || echo "24小时内无.db文件修改"

# 9. 检查服务配置
echo -e "\n⚙️ 9. 检查服务配置:"
if [ -f "/etc/systemd/system/research-backend.service" ]; then
    echo "服务文件存在:"
    grep -E "(WorkingDirectory|ExecStart)" /etc/systemd/system/research-backend.service
fi

# 10. 检查环境变量和配置
echo -e "\n🌍 10. 检查环境配置:"
if [ -f "backend/.env" ]; then
    echo "环境文件存在:"
    grep -E "(DATABASE|DB)" backend/.env 2>/dev/null || echo "无数据库配置"
fi

if [ -f "backend/.env.production" ]; then
    echo "生产环境文件存在:"
    grep -E "(DATABASE|DB)" backend/.env.production 2>/dev/null || echo "无数据库配置"
fi

echo -e "\n🔍 === 检查完成 ==="
echo "请查看上述信息，寻找可能包含数据的文件"