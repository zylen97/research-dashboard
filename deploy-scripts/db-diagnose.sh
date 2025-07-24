#!/bin/bash

echo "🔍 Research Dashboard 数据库诊断开始..."
echo "执行时间: $(date)"
echo "=" * 60

# 进入后端目录
cd /var/www/research-backend || {
    echo "❌ 无法进入 /var/www/research-backend 目录"
    exit 1
}

echo "📁 当前工作目录: $(pwd)"
echo ""

# 检查数据库文件
echo "1️⃣ 检查数据库文件状态..."
DB_FILE="data/research_dashboard_prod.db"

if [ -f "$DB_FILE" ]; then
    echo "✅ 数据库文件存在: $DB_FILE"
    echo "📊 文件大小: $(du -h $DB_FILE | cut -f1)"
    echo "🔐 文件权限: $(ls -la $DB_FILE)"
    echo "👤 文件所有者: $(stat -c '%U:%G' $DB_FILE 2>/dev/null || stat -f '%Su:%Sg' $DB_FILE)"
else
    echo "❌ 数据库文件不存在: $DB_FILE"
    echo "📁 data目录内容:"
    ls -la data/ 2>/dev/null || echo "data目录不存在"
fi

echo ""

# 检查数据目录权限
echo "2️⃣ 检查data目录权限..."
if [ -d "data" ]; then
    echo "📁 data目录权限: $(ls -ld data)"
    echo "👤 data目录所有者: $(stat -c '%U:%G' data 2>/dev/null || stat -f '%Su:%Sg' data)"
else
    echo "❌ data目录不存在"
    echo "正在尝试创建data目录..."
    mkdir -p data
    echo "✅ data目录已创建"
fi

echo ""

# 测试数据库连接
echo "3️⃣ 测试数据库连接..."
if [ -f "$DB_FILE" ]; then
    echo "🔌 测试SQLite连接..."
    sqlite3 "$DB_FILE" "SELECT 'Database connection OK' as status;" 2>/dev/null && echo "✅ 数据库连接正常" || echo "❌ 数据库连接失败"
    
    echo ""
    echo "📋 检查表结构..."
    sqlite3 "$DB_FILE" ".tables" 2>/dev/null && echo "✅ 可以读取表列表" || echo "❌ 无法读取表列表"
    
    echo ""
    echo "🔍 检查collaborators表..."
    sqlite3 "$DB_FILE" "PRAGMA table_info(collaborators);" 2>/dev/null | head -10 && echo "✅ collaborators表结构可读" || echo "❌ collaborators表不存在或不可读"
    
    echo ""
    echo "📊 检查数据统计..."
    echo "collaborators表记录数: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM collaborators;" 2>/dev/null || echo '无法统计')"
    echo "research_projects表记录数: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM research_projects;" 2>/dev/null || echo '无法统计')"
    echo "ideas表记录数: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM ideas;" 2>/dev/null || echo '无法统计')"
else
    echo "❌ 数据库文件不存在，无法测试连接"
fi

echo ""

# 检查migration历史
echo "4️⃣ 检查migration历史..."
if [ -f "$DB_FILE" ]; then
    echo "📜 Migration执行历史:"
    sqlite3 "$DB_FILE" "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC;" 2>/dev/null || echo "❌ 无法读取migration历史"
else
    echo "❌ 数据库文件不存在，无法检查migration历史"
fi

echo ""

# 检查Python数据库连接
echo "5️⃣ 测试Python数据库连接..."
python3 -c "
import sys
import os
sys.path.insert(0, '/var/www/research-backend')

try:
    import sqlite3
    conn = sqlite3.connect('data/research_dashboard_prod.db')
    cursor = conn.cursor()
    cursor.execute('SELECT 1')
    print('✅ Python SQLite连接正常')
    
    # 测试FastAPI数据库连接
    try:
        from app.models.database import get_db
        db = next(get_db())
        db.execute('SELECT 1')
        print('✅ FastAPI数据库连接正常')
        db.close()
    except Exception as e:
        print(f'❌ FastAPI数据库连接失败: {e}')
    
    conn.close()
except Exception as e:
    print(f'❌ Python数据库连接失败: {e}')
" 2>/dev/null || echo "❌ Python数据库测试失败"

echo ""

# 检查服务状态
echo "6️⃣ 检查服务状态..."
echo "🔍 research-backend服务状态:"
systemctl is-active research-backend && echo "✅ 服务运行中" || echo "❌ 服务未运行"

echo ""
echo "📋 服务最新日志:"
journalctl -u research-backend --no-pager -n 10 --since "10 minutes ago" 2>/dev/null || echo "无法读取服务日志"

echo ""

# 检查端口监听
echo "7️⃣ 检查端口监听..."
echo "🔍 检查8080端口:"
netstat -tlnp | grep ":8080" && echo "✅ 8080端口有服务监听" || echo "❌ 8080端口无服务监听"

echo ""

# API健康检查
echo "8️⃣ 执行API健康检查..."
echo "🔍 测试全局健康检查:"
curl -s http://localhost:8080/api/health | head -200 2>/dev/null && echo "✅ 全局健康检查响应正常" || echo "❌ 全局健康检查失败"

echo ""
echo "🔍 测试Ideas健康检查:"
curl -s http://localhost:8080/api/ideas-management/health | head -200 2>/dev/null && echo "✅ Ideas健康检查响应正常" || echo "❌ Ideas健康检查失败"

echo ""

# 权限修复建议
echo "9️⃣ 权限修复建议..."
echo "如果发现权限问题，可以执行以下命令修复:"
echo "sudo chown -R research-user:research-user /var/www/research-backend/data/"
echo "sudo chmod 755 /var/www/research-backend/data/"
echo "sudo chmod 644 /var/www/research-backend/data/*.db"

echo ""
echo "🎯 诊断完成！"
echo "执行时间: $(date)"
echo "=" * 60