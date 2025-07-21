#!/bin/bash

# 在VPS上安装备份系统的脚本

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔧 设置研究仪表板自动备份系统...${NC}"

# 检查是否在正确的目录
if [ ! -f "backup-research.sh" ]; then
    echo -e "${RED}错误: 请在 deployment 目录下运行此脚本${NC}"
    exit 1
fi

# 1. 复制备份脚本到系统目录
echo -e "${YELLOW}📋 复制备份脚本...${NC}"
sudo cp backup-research.sh /usr/local/bin/backup-research.sh
sudo chmod +x /usr/local/bin/backup-research.sh

# 2. 创建备份目录
echo -e "${YELLOW}📁 创建备份目录...${NC}"
sudo mkdir -p /var/backups/research-dashboard
sudo mkdir -p /var/log

# 检查数据库文件是否存在
DB_PATH="/var/www/research-dashboard/backend/data/research_dashboard_prod.db"
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}警告: 数据库文件不存在: $DB_PATH${NC}"
    echo -e "${YELLOW}请先运行 ./deploy-scripts/init-database.sh 初始化数据库${NC}"
fi

# 3. 设置cron定时任务
echo -e "${YELLOW}⏰ 设置定时任务...${NC}"
# 检查是否已存在任务
if ! sudo crontab -l 2>/dev/null | grep -q "backup-research.sh"; then
    # 添加定时任务：每天凌晨2点执行备份
    (sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-research.sh") | sudo crontab -
    echo -e "${GREEN}✅ 已添加每日凌晨2点自动备份任务${NC}"
else
    echo -e "${GREEN}✅ 备份任务已存在${NC}"
fi

# 4. 执行一次测试备份
echo -e "${YELLOW}🧪 执行测试备份...${NC}"
if [ -f "$DB_PATH" ]; then
    sudo /usr/local/bin/backup-research.sh
    
    # 5. 检查备份结果
    LATEST_BACKUP=$(ls -t /var/backups/research-dashboard/db_backup_*.db.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo -e "${GREEN}✅ 测试备份成功!${NC}"
        echo -e "${BLUE}📊 最新备份: $LATEST_BACKUP${NC}"
        echo -e "${BLUE}📝 备份日志: /var/log/research-backup.log${NC}"
    else
        echo -e "${RED}❌ 测试备份失败，请检查日志${NC}"
        sudo tail -n 20 /var/log/research-backup.log
    fi
else
    echo -e "${YELLOW}跳过测试备份（数据库不存在）${NC}"
fi

echo ""
echo -e "${GREEN}🎉 自动备份系统设置完成!${NC}"
echo ""
echo -e "${BLUE}💡 使用说明：${NC}"
echo "- 每天凌晨2点自动备份"
echo "- 保留最近7天的备份"
echo "- 查看备份: ls -la /var/backups/research-dashboard/"
echo "- 查看日志: tail -f /var/log/research-backup.log"
echo "- 手动备份: sudo /usr/local/bin/backup-research.sh"
echo ""
echo -e "${YELLOW}📌 重要提醒：${NC}"
echo "- 定期检查备份是否正常运行"
echo "- 建议定期下载备份到本地保存"
echo "- 可以修改 crontab 调整备份时间"