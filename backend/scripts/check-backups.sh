#!/bin/bash

# 数据库备份完整性检查脚本
# 用于验证VPS上的备份是否真的包含不同的数据

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 数据库备份完整性检查 ===${NC}"

# 检查是否在VPS环境
if [ ! -d "/var/www/research-dashboard" ]; then
    echo -e "${RED}错误: 此脚本需要在VPS上运行${NC}"
    exit 1
fi

# 进入项目目录
cd /var/www/research-dashboard/backend

# 查找所有备份文件
echo -e "${YELLOW}📂 查找备份文件...${NC}"
BACKUP_DIR="backups/production"
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}错误: 备份目录 $BACKUP_DIR 不存在${NC}"
    exit 1
fi

# 获取所有备份文件（按时间排序）
BACKUPS=($(ls -1t $BACKUP_DIR/*.db 2>/dev/null | head -5))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}错误: 未找到任何备份文件${NC}"
    exit 1
fi

echo -e "${GREEN}找到 ${#BACKUPS[@]} 个备份文件${NC}"

# 检查函数：获取数据库统计信息
check_database() {
    local db_file="$1"
    local db_name=$(basename "$db_file")
    
    echo -e "\n${YELLOW}🔍 检查: $db_name${NC}"
    echo "文件大小: $(du -h "$db_file" | cut -f1)"
    echo "创建时间: $(stat -c '%y' "$db_file" 2>/dev/null || stat -f '%Sm' "$db_file")"
    
    # 连接数据库并获取统计信息
    sqlite3 "$db_file" << 'EOF'
.headers on
.mode column

-- 检查用户数据
SELECT '=== 用户表 ===' as info;
SELECT COUNT(*) as user_count, 
       GROUP_CONCAT(username) as usernames 
FROM users;

-- 检查合作者数据  
SELECT '=== 合作者表 ===' as info;
SELECT COUNT(*) as collaborator_count,
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) as active_count,
       COUNT(CASE WHEN is_senior = 1 THEN 1 END) as senior_count
FROM collaborators;

-- 检查项目数据
SELECT '=== 项目表 ===' as info;
SELECT COUNT(*) as project_count,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects
FROM research_projects;

-- 检查交流日志数据
SELECT '=== 交流日志表 ===' as info;
SELECT COUNT(*) as log_count,
       COUNT(DISTINCT project_id) as projects_with_logs
FROM communication_logs;

-- 检查文献数据
SELECT '=== 文献表 ===' as info;
SELECT COUNT(*) as literature_count,
       COUNT(CASE WHEN validation_status = 'validated' THEN 1 END) as validated_count
FROM literature;

-- 检查Idea数据
SELECT '=== Idea表 ===' as info;
SELECT COUNT(*) as idea_count,
       COUNT(CASE WHEN status = 'pool' THEN 1 END) as pool_ideas,
       COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority
FROM ideas;

-- 检查迁移历史
SELECT '=== 迁移历史 ===' as info;
SELECT COUNT(*) as migration_count,
       GROUP_CONCAT(version) as versions
FROM migration_history;

EOF
    
    echo -e "${GREEN}✓ 检查完成${NC}"
}

# 主检查流程
echo -e "\n${BLUE}开始详细检查...${NC}"

for i in "${!BACKUPS[@]}"; do
    echo -e "\n${BLUE}==================== 备份 $((i+1)) ====================${NC}"
    check_database "${BACKUPS[$i]}"
done

# 比较分析
echo -e "\n${BLUE}=== 备份差异分析 ===${NC}"

# 生成摘要比较
echo -e "${YELLOW}📊 数据量对比:${NC}"
for backup in "${BACKUPS[@]}"; do
    db_name=$(basename "$backup")
    echo -n "$db_name: "
    
    # 获取关键数据量
    users=$(sqlite3 "$backup" "SELECT COUNT(*) FROM users;")
    collaborators=$(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;")
    projects=$(sqlite3 "$backup" "SELECT COUNT(*) FROM research_projects;")
    logs=$(sqlite3 "$backup" "SELECT COUNT(*) FROM communication_logs;")
    
    echo "用户:$users | 合作者:$collaborators | 项目:$projects | 日志:$logs"
done

# 检查是否有数据变化
echo -e "\n${YELLOW}🔄 变化检测:${NC}"
if [ ${#BACKUPS[@]} -gt 1 ]; then
    # 比较最新和最旧的备份
    newest="${BACKUPS[0]}"
    oldest="${BACKUPS[-1]}"
    
    newest_users=$(sqlite3 "$newest" "SELECT COUNT(*) FROM users;")
    oldest_users=$(sqlite3 "$oldest" "SELECT COUNT(*) FROM users;")
    
    newest_collaborators=$(sqlite3 "$newest" "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;")
    oldest_collaborators=$(sqlite3 "$oldest" "SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0;")
    
    newest_projects=$(sqlite3 "$newest" "SELECT COUNT(*) FROM research_projects;")
    oldest_projects=$(sqlite3 "$oldest" "SELECT COUNT(*) FROM research_projects;")
    
    echo "用户数变化: $oldest_users → $newest_users (${GREEN}$((newest_users - oldest_users))${NC})"
    echo "合作者变化: $oldest_collaborators → $newest_collaborators (${GREEN}$((newest_collaborators - oldest_collaborators))${NC})"
    echo "项目数变化: $oldest_projects → $newest_projects (${GREEN}$((newest_projects - oldest_projects))${NC})"
fi

# 检查当前运行中的数据库
echo -e "\n${BLUE}=== 当前运行数据库对比 ===${NC}"
CURRENT_DB="research_dashboard.db"
if [ -f "$CURRENT_DB" ]; then
    echo -e "${YELLOW}🔄 当前数据库状态:${NC}"
    check_database "$CURRENT_DB"
else
    echo -e "${RED}警告: 未找到当前运行的数据库文件${NC}"
fi

# 文件指纹检查
echo -e "\n${BLUE}=== 文件完整性检查 ===${NC}"
echo -e "${YELLOW}📋 文件MD5校验:${NC}"
for backup in "${BACKUPS[@]}"; do
    db_name=$(basename "$backup")
    md5=$(md5sum "$backup" 2>/dev/null | cut -d' ' -f1 || md5 "$backup" | cut -d'=' -f2 | tr -d ' ')
    echo "$db_name: $md5"
done

echo -e "\n${GREEN}=== 检查完成 ===${NC}"
echo -e "${BLUE}💡 建议:${NC}"
echo "1. 如果所有备份数据完全相同且MD5一致，说明备份可能有问题"
echo "2. 如果看到数据递增变化，说明备份正常工作"
echo "3. 对比当前数据库和最新备份，验证备份的及时性"