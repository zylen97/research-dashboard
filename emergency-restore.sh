#!/bin/bash

# 🚨 紧急数据恢复脚本
# 修复迁移系统错误并恢复数据

echo "🚨 开始紧急数据恢复..."
echo "时间: $(date)"
echo "=========================================="

# 进入项目目录
cd /var/www/research-dashboard/backend || {
    echo "❌ 无法进入项目目录!"
    exit 1
}

# 停止服务
echo "🛑 停止后端服务..."
sudo systemctl stop research-backend
sleep 2

# 备份当前可能损坏的数据库
if [ -f "data/research_dashboard_prod.db" ]; then
    cp data/research_dashboard_prod.db data/research_dashboard_prod.db.corrupted.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份当前数据库"
fi

# 查找最新的备份文件
echo "🔍 查找可用备份文件..."

# 1. 检查项目数据目录的备份
LATEST_PROJECT_BACKUP=$(ls -t data/*.backup* 2>/dev/null | head -1)

# 2. 检查系统备份目录
LATEST_SYSTEM_BACKUP=$(ls -t /opt/backups/research-dashboard/backup_before_deploy_*.gz 2>/dev/null | head -1)

echo "项目备份: $LATEST_PROJECT_BACKUP"
echo "系统备份: $LATEST_SYSTEM_BACKUP"

# 选择最新的备份文件
RESTORE_FILE=""
if [ -n "$LATEST_PROJECT_BACKUP" ] && [ -n "$LATEST_SYSTEM_BACKUP" ]; then
    # 比较两个文件的时间戳，选择最新的
    if [ "$LATEST_PROJECT_BACKUP" -nt "$LATEST_SYSTEM_BACKUP" ]; then
        RESTORE_FILE="$LATEST_PROJECT_BACKUP"
    else
        RESTORE_FILE="$LATEST_SYSTEM_BACKUP"
    fi
elif [ -n "$LATEST_PROJECT_BACKUP" ]; then
    RESTORE_FILE="$LATEST_PROJECT_BACKUP"
elif [ -n "$LATEST_SYSTEM_BACKUP" ]; then
    RESTORE_FILE="$LATEST_SYSTEM_BACKUP"
fi

if [ -n "$RESTORE_FILE" ]; then
    echo "🚀 找到备份文件: $RESTORE_FILE"
    
    # 恢复数据库
    if [[ "$RESTORE_FILE" == *.gz ]]; then
        echo "📦 解压备份文件..."
        zcat "$RESTORE_FILE" > data/research_dashboard_prod.db
    else
        echo "📄 复制备份文件..."
        cp "$RESTORE_FILE" data/research_dashboard_prod.db
    fi
    
    # 验证恢复的数据库
    echo "✅ 验证恢复的数据库..."
    USER_COUNT=$(sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    PROJECT_COUNT=$(sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM research_projects;" 2>/dev/null || echo "0")
    COLLABORATOR_COUNT=$(sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators;" 2>/dev/null || echo "0")
    
    echo "恢复后统计："
    echo "- 用户数量: $USER_COUNT"
    echo "- 项目数量: $PROJECT_COUNT" 
    echo "- 合作者数量: $COLLABORATOR_COUNT"
    
    if [ "$USER_COUNT" -gt "0" ]; then
        echo "✅ 数据库恢复成功！"
        
        # 清理迁移历史表，防止重复执行问题迁移
        echo "🧹 清理有问题的迁移记录..."
        sqlite3 data/research_dashboard_prod.db "DELETE FROM migration_history WHERE version LIKE '%v1.6%';" 2>/dev/null || true
        
        echo "✅ 迁移记录已清理"
    else
        echo "❌ 恢复的数据库似乎是空的"
    fi
else
    echo "❌ 没有找到可用的备份文件！"
    echo "🔍 尝试查找其他位置的备份..."
    find /opt -name "*research*backup*" 2>/dev/null | head -5
    find /var -name "*research*backup*" 2>/dev/null | head -5
    
    # 如果没有备份，重新初始化基本用户数据
    echo "⚠️  没有备份，重新初始化基本用户数据..."
    
    # 确保数据库存在并初始化
    sqlite3 data/research_dashboard_prod.db << EOF
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    hashed_password VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认用户 (密码: 123)
INSERT OR IGNORE INTO users (username, hashed_password) VALUES 
('zl', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYkTqt8ZKg7uC4u'),
('zz', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYkTqt8ZKg7uC4u'),
('yq', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYkTqt8ZKg7uC4u'),
('dj', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYkTqt8ZKg7uC4u');

-- 清理有问题的迁移记录
DELETE FROM migration_history WHERE version LIKE '%v1.6%';
EOF

    echo "✅ 基本用户数据已重新创建"
fi

# 设置正确的文件权限
chmod 644 data/research_dashboard_prod.db
chown www-data:www-data data/research_dashboard_prod.db 2>/dev/null || true

# 重启服务
echo "🚀 重启后端服务..."
sudo systemctl start research-backend
sleep 3

# 检查服务状态
if systemctl is-active --quiet research-backend; then
    echo "✅ 后端服务启动成功"
else
    echo "❌ 后端服务启动失败"
    echo "📋 服务状态:"
    systemctl status research-backend --no-pager -l
fi

echo "=========================================="
echo "🎉 紧急恢复完成: $(date)"
echo ""
echo "请立即检查网站："
echo "http://45.149.156.216:3001"
echo ""
echo "如果数据仍然不正确，请检查:"
echo "1. /opt/backups/research-dashboard/ 目录下的其他备份"
echo "2. 可能需要从开发环境恢复数据"