#!/bin/bash

# 检查VPS备份环境的脚本

echo "=== 检查VPS备份环境 ==="
echo ""

# 1. 检查数据库文件
echo "📁 检查数据库文件:"
DB_PATH="/var/www/research-dashboard/backend/data/research_dashboard_prod.db"
if [ -f "$DB_PATH" ]; then
    echo "✅ 数据库文件存在: $DB_PATH"
    echo "   大小: $(ls -lh $DB_PATH | awk '{print $5}')"
    echo "   权限: $(ls -l $DB_PATH | awk '{print $1}')"
    echo "   所有者: $(ls -l $DB_PATH | awk '{print $3":"$4}')"
else
    echo "❌ 数据库文件不存在: $DB_PATH"
fi
echo ""

# 2. 检查备份目录
echo "📁 检查备份目录:"
BACKUP_DIR="/var/www/research-dashboard/backend/backups"
if [ -d "$BACKUP_DIR" ]; then
    echo "✅ 备份根目录存在: $BACKUP_DIR"
    echo "   权限: $(ls -ld $BACKUP_DIR | awk '{print $1}')"
    echo "   所有者: $(ls -ld $BACKUP_DIR | awk '{print $3":"$4}')"
    
    # 检查prod子目录
    PROD_BACKUP_DIR="$BACKUP_DIR/prod"
    if [ -d "$PROD_BACKUP_DIR" ]; then
        echo "✅ 生产备份目录存在: $PROD_BACKUP_DIR"
        echo "   权限: $(ls -ld $PROD_BACKUP_DIR | awk '{print $1}')"
        echo "   所有者: $(ls -ld $PROD_BACKUP_DIR | awk '{print $3":"$4}')"
        echo "   备份数量: $(ls -1 $PROD_BACKUP_DIR 2>/dev/null | wc -l)"
    else
        echo "❌ 生产备份目录不存在: $PROD_BACKUP_DIR"
        echo "   尝试创建..."
        sudo mkdir -p "$PROD_BACKUP_DIR"
        sudo chown www-data:www-data "$PROD_BACKUP_DIR"
        sudo chmod 755 "$PROD_BACKUP_DIR"
    fi
else
    echo "❌ 备份根目录不存在: $BACKUP_DIR"
    echo "   尝试创建..."
    sudo mkdir -p "$BACKUP_DIR/prod"
    sudo chown -R www-data:www-data "$BACKUP_DIR"
    sudo chmod -R 755 "$BACKUP_DIR"
fi
echo ""

# 3. 检查服务运行用户
echo "👤 检查服务运行用户:"
SERVICE_USER=$(ps aux | grep -E "uvicorn|fastapi" | grep -v grep | awk '{print $1}' | head -1)
if [ -n "$SERVICE_USER" ]; then
    echo "✅ 后端服务运行用户: $SERVICE_USER"
else
    echo "⚠️  未找到运行中的后端服务"
fi
echo ""

# 4. 创建测试备份
echo "🔧 测试备份创建:"
if [ -f "$DB_PATH" ]; then
    TEST_BACKUP="/tmp/test_backup_$(date +%Y%m%d_%H%M%S).db"
    if sudo -u www-data cp "$DB_PATH" "$TEST_BACKUP" 2>/dev/null; then
        echo "✅ 测试备份创建成功"
        rm -f "$TEST_BACKUP"
    else
        echo "❌ 测试备份创建失败 (权限问题)"
        echo "   尝试修复权限..."
        sudo chown www-data:www-data "$DB_PATH"
        sudo chmod 664 "$DB_PATH"
    fi
fi
echo ""

# 5. 检查Python环境
echo "🐍 检查Python环境:"
PYTHON_PATH="/var/www/research-dashboard/backend/venv/bin/python"
if [ -f "$PYTHON_PATH" ]; then
    echo "✅ Python虚拟环境存在"
    # 测试导入
    cd /var/www/research-dashboard/backend
    if sudo -u www-data $PYTHON_PATH -c "from app.utils.backup_manager import BackupManager; print('✅ BackupManager导入成功')" 2>/dev/null; then
        echo "✅ 模块导入正常"
    else
        echo "❌ 模块导入失败"
        sudo -u www-data $PYTHON_PATH -c "from app.utils.backup_manager import BackupManager" 2>&1 | grep -E "(ImportError|ModuleNotFoundError|Permission)"
    fi
else
    echo "❌ Python虚拟环境不存在"
fi
echo ""

echo "=== 检查完成 ==="
echo ""
echo "📝 建议操作:"
echo "1. 确保所有目录权限正确 (www-data:www-data)"
echo "2. 确保数据库文件可被www-data用户读取"
echo "3. 检查后端服务日志: sudo journalctl -u research-backend -n 50"