#!/bin/bash

echo "=== 修复VPS备份功能 ==="

# 1. 确保备份目录存在并有正确权限
echo "📁 创建备份目录结构..."
sudo mkdir -p /var/www/research-dashboard/backend/backups/prod
sudo mkdir -p /var/www/research-dashboard/backend/backups/dev
sudo chown -R www-data:www-data /var/www/research-dashboard/backend/backups
sudo chmod -R 755 /var/www/research-dashboard/backend/backups

echo "✅ 备份目录创建完成"
echo ""

# 2. 检查目录结构
echo "📂 当前目录结构:"
ls -la /var/www/research-dashboard/backend/backups/
echo ""

# 3. 测试Python模块导入
echo "🐍 测试Python环境..."
cd /var/www/research-dashboard/backend

# VPS使用系统Python，不是虚拟环境
if python3 -c "from app.utils.backup_manager import BackupManager; print('✅ BackupManager导入成功')" 2>/dev/null; then
    echo "✅ Python模块正常"
else
    echo "❌ Python模块导入失败，查看错误:"
    python3 -c "from app.utils.backup_manager import BackupManager" 2>&1
fi
echo ""

# 4. 手动测试备份管理器
echo "🔧 测试备份管理器功能..."
python3 -c "
import sys
sys.path.insert(0, '/var/www/research-dashboard/backend')
try:
    from app.utils.backup_manager import BackupManager
    manager = BackupManager()
    stats = manager.get_backup_stats()
    print('✅ 备份管理器工作正常')
    print(f'   当前备份数: {stats[\"total_backups\"]}')
    print(f'   环境: {stats[\"current_environment\"]}')
except Exception as e:
    print(f'❌ 错误: {e}')
    import traceback
    traceback.print_exc()
"
echo ""

# 5. 重启服务
echo "🔄 重启后端服务..."
sudo systemctl restart research-backend
sleep 2

# 6. 检查服务状态
echo "📊 服务状态:"
sudo systemctl status research-backend --no-pager | head -10
echo ""

# 7. 查看最新日志
echo "📋 最新日志:"
sudo journalctl -u research-backend -n 20 --no-pager | grep -E "(backup|error|Error|ERROR)"
echo ""

echo "=== 修复完成 ==="
echo ""
echo "📝 现在请测试:"
echo "1. 访问 http://45.149.156.216:3001"
echo "2. 登录后进入数据库备份页面"
echo "3. 尝试创建备份"