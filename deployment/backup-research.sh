#!/bin/bash

# Research Dashboard 自动备份脚本
# 每天自动备份数据库文件

# 配置
DB_PATH="/var/www/research-dashboard/backend/research_dashboard.db"
BACKUP_DIR="/var/backups/research-dashboard"
DATE=$(date +%Y%m%d)
BACKUP_FILE="database_backup_${DATE}.db.gz"
LOG_FILE="/var/log/research-backup.log"

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

# 清理30天前的旧备份
find "$BACKUP_DIR" -name "database_backup_*.db.gz" -mtime +30 -delete
DELETED=$(find "$BACKUP_DIR" -name "database_backup_*.db.gz" -mtime +30 2>/dev/null | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "$(date): Cleaned up $DELETED old backup files" >> "$LOG_FILE"
fi

# 显示当前备份数量
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/database_backup_*.db.gz 2>/dev/null | wc -l)
echo "$(date): Total backups: $BACKUP_COUNT" >> "$LOG_FILE"
echo "$(date): Backup completed successfully" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"