#!/bin/bash

# Research Dashboard 自动备份脚本
# 每天自动备份数据库文件

# 配置
PROJECT_DIR="/var/www/research-dashboard"
DB_PATH="$PROJECT_DIR/backend/data/research_dashboard_prod.db"
BACKUP_DIR="/var/backups/research-dashboard"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="db_backup_${DATE}.db.gz"
LOG_FILE="/var/log/research-backup.log"
MAX_BACKUPS=7  # 保留最近7天的备份

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 记录开始时间
echo "$(date): Starting backup..." >> "$LOG_FILE"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "$(date): ERROR - Database file not found: $DB_PATH" >> "$LOG_FILE"
    exit 1
fi

# 创建备份
if gzip -c "$DB_PATH" > "$BACKUP_DIR/$BACKUP_FILE"; then
    echo "$(date): Backup created successfully: $BACKUP_FILE" >> "$LOG_FILE"
    
    # 获取文件大小
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "$(date): Backup size: $SIZE" >> "$LOG_FILE"
else
    echo "$(date): ERROR - Failed to create backup" >> "$LOG_FILE"
    exit 1
fi

# 清理旧备份（保留最近的N个）
echo "$(date): Cleaning old backups..." >> "$LOG_FILE"
BACKUP_COUNT=$(ls -1t "$BACKUP_DIR"/db_backup_*.db.gz 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    # 获取要删除的文件列表
    DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "$BACKUP_DIR"/db_backup_*.db.gz | tail -n "$DELETE_COUNT" | while read -r file; do
        rm -f "$file"
        echo "$(date): Deleted old backup: $(basename "$file")" >> "$LOG_FILE"
    done
    echo "$(date): Cleaned up $DELETE_COUNT old backup files" >> "$LOG_FILE"
fi

# 显示当前备份数量
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/db_backup_*.db.gz 2>/dev/null | wc -l)
echo "$(date): Total backups: $BACKUP_COUNT" >> "$LOG_FILE"
echo "$(date): Backup completed successfully" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"