#!/bin/bash

# 在VPS上安装备份系统的脚本

echo "🔧 设置研究仪表板自动备份系统..."

# 1. 复制备份脚本到系统目录
echo "📋 复制备份脚本..."
sudo cp backup-research.sh /usr/local/bin/backup-research.sh
sudo chmod +x /usr/local/bin/backup-research.sh

# 2. 创建备份目录
echo "📁 创建备份目录..."
sudo mkdir -p /var/backups/research-dashboard
sudo mkdir -p /var/log

# 3. 设置cron定时任务
echo "⏰ 设置定时任务..."
# 检查是否已存在任务
if ! sudo crontab -l 2>/dev/null | grep -q "backup-research.sh"; then
    # 添加定时任务：每天凌晨2点执行备份
    (sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-research.sh") | sudo crontab -
    echo "✅ 已添加每日凌晨2点自动备份任务"
else
    echo "✅ 备份任务已存在"
fi

# 4. 执行一次测试备份
echo "🧪 执行测试备份..."
sudo /usr/local/bin/backup-research.sh

# 5. 检查备份结果
if [ -f "/var/backups/research-dashboard/database_backup_$(date +%Y%m%d).db.gz" ]; then
    echo "✅ 测试备份成功!"
    echo "📊 备份文件位置: /var/backups/research-dashboard/"
    echo "📝 备份日志位置: /var/log/research-backup.log"
else
    echo "❌ 测试备份失败，请检查日志"
fi

echo ""
echo "🎉 自动备份系统设置完成!"
echo ""
echo "💡 使用说明："
echo "- 每天凌晨2点自动备份"
echo "- 备份文件保存30天"
echo "- 查看备份: ls -la /var/backups/research-dashboard/"
echo "- 查看日志: tail -f /var/log/research-backup.log"
echo "- 手动备份: sudo /usr/local/bin/backup-research.sh"