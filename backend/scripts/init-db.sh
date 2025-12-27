#!/bin/bash

# 统一的数据库初始化脚本
# 根据环境变量自动处理开发和生产环境

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=== Research Dashboard 数据库初始化 ===${NC}"

# 进入后端目录
cd "$BACKEND_DIR"

# 统一使用单一数据库
DB_FILE="data/research_dashboard.db"
ENV_FILE=".env"

echo -e "${YELLOW}数据库文件: $DB_FILE${NC}"

# 创建必要的目录
mkdir -p data logs uploads backups

# 检查数据库是否已存在
if [ -f "$DB_FILE" ]; then
    echo -e "${YELLOW}数据库已存在，是否要重新初始化？这将删除所有现有数据！${NC}"
    read -p "继续吗？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}取消初始化${NC}"
        exit 0
    fi
    
    # 备份现有数据库
    BACKUP_NAME="backup_before_reinit_$(date +%Y%m%d_%H%M%S).db"
    cp "$DB_FILE" "backups/$BACKUP_NAME"
    echo -e "${GREEN}✅ 已备份现有数据库到: backups/$BACKUP_NAME${NC}"
    
    # 删除现有数据库
    rm -f "$DB_FILE"
fi

# 设置环境变量（如果.env文件存在）
if [ -f "$ENV_FILE" ]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ 已加载环境配置: $ENV_FILE${NC}"
fi

# 初始化数据库
echo -e "${YELLOW}正在初始化数据库...${NC}"

python3 << EOF
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, '.')

try:
    from app.utils.db_init import init_database, init_users
    from app.models.database import SessionLocal, engine
    from sqlalchemy import text
    
    # 1. 创建数据库表
    print("创建数据库表结构...")
    init_database()
    
    # 2. 初始化默认用户
    print("初始化默认用户...")
    init_users()
    
    # 3. 显示结果
    db = SessionLocal()
    try:
        # 统计表
        with engine.connect() as conn:
            tables = conn.execute(text('''
                SELECT name FROM sqlite_master 
                WHERE type="table" AND name NOT LIKE "sqlite_%"
                ORDER BY name
            ''')).fetchall()
            
            print(f"\n📊 已创建 {len(tables)} 个表:")
            for table in tables:
                print(f"  - {table[0]}")
            
            # 统计用户
            users = conn.execute(text('SELECT username, display_name FROM users')).fetchall()
            print(f"\n👥 已创建 {len(users)} 个用户:")
            for user in users:
                print(f"  - {user[0]} ({user[1]})")
                
    finally:
        db.close()
    
    print("\n✅ 数据库初始化成功！")
    
except Exception as e:
    print(f"\n❌ 初始化失败: {e}")
    sys.exit(1)
EOF

# 检查初始化结果
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库初始化完成！${NC}"
    echo -e "${BLUE}数据库位置: $BACKEND_DIR/$DB_FILE${NC}"
    
    # 设置权限（在生产环境）
    if [ "$ENV" = "production" ] && [ -f "$DB_FILE" ]; then
        # 如果是root用户运行，设置www-data权限
        if [ "$EUID" -eq 0 ]; then
            chown www-data:www-data "$DB_FILE"
            chown -R www-data:www-data data logs uploads
            echo -e "${GREEN}✅ 已设置生产环境权限${NC}"
        fi
    fi
    
    echo ""
    echo -e "${BLUE}下一步：${NC}"
    if [ "$ENV" = "production" ]; then
        echo "1. 重启后端服务: systemctl restart research-backend"
        echo "2. 设置自动备份: cd deployment && ./setup-backup.sh"
    else
        echo "1. 启动开发服务器: cd .. && ./start-dev.sh"
        echo "2. 访问应用: http://localhost:3001"
    fi
else
    echo -e "${RED}❌ 数据库初始化失败${NC}"
    exit 1
fi