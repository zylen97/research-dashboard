#!/bin/bash

# 🚨 紧急双重修复：API + 数据库字段映射
echo "🚨 紧急双重修复：API + 数据库字段映射"
echo "时间: $(date)"
echo ""

cd /var/www/research-dashboard/backend || exit 1

echo "=== 1. 强制拉取最新代码并重启服务 ==="
git pull
systemctl stop research-backend
sleep 2
systemctl start research-backend
sleep 3
echo "服务状态: $(systemctl is-active research-backend)"

echo ""
echo "=== 2. 测试API修复效果 ==="
echo "快速API测试:"
curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zl","password":"123"}' > /tmp/login_response.json

TOKEN=$(python3 -c "
import json
try:
    with open('/tmp/login_response.json', 'r') as f:
        data = json.load(f)
    print(data.get('access_token', ''))
except:
    print('')
")

if [ -n "$TOKEN" ]; then
    echo "测试collaborators API:"
    API_RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/collaborators/")
    echo "API返回长度: ${#API_RESULT}"
    echo "API前100字符: ${API_RESULT:0:100}"
    
    if [ "${#API_RESULT}" -le 5 ]; then
        echo "❌ API仍然返回空数组，需要进一步修复"
    else
        echo "✅ API返回有数据"
    fi
else
    echo "❌ 无法获取token"
fi

echo ""
echo "=== 3. 数据库字段映射修复 ==="
echo "当前数据混乱情况:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, email, institution, research_area FROM collaborators LIMIT 3;"

echo ""
echo "寻找最佳备份进行恢复..."

# 寻找有完整字段的备份
best_backup=""
for backup in data/research_dashboard_prod.db.backup.20250724_024312 data/research_dashboard_prod.db.backup.20250724_031835 data/research_dashboard_prod.db.backup.20250723_080709; do
    if [ -f "$backup" ]; then
        echo "检查备份: $backup"
        gender_count=$(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators WHERE gender IS NOT NULL AND gender != '';" 2>/dev/null || echo "0")
        echo "  有性别数据: $gender_count 条"
        
        if [ "$gender_count" -gt 20 ]; then
            best_backup=$backup
            echo "  ✅ 选择此备份"
            break
        fi
    fi
done

if [ -n "$best_backup" ]; then
    echo ""
    echo "=== 4. 执行数据库恢复 ==="
    echo "备份当前数据库..."
    cp data/research_dashboard_prod.db "data/research_dashboard_prod.db.broken_$(date +%Y%m%d_%H%M%S)"
    
    echo "恢复备份: $best_backup"
    cp "$best_backup" data/research_dashboard_prod.db
    
    echo "验证恢复效果:"
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);" | head -10
    
    echo "数据样例:"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, gender, class_name, future_plan FROM collaborators LIMIT 3;" 2>/dev/null || \
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, email, institution, research_area FROM collaborators LIMIT 3;"
    
    echo "总记录数: $(sqlite3 data/research_dashboard_prod.db 'SELECT COUNT(*) FROM collaborators;')"
    
else
    echo ""
    echo "=== 4. 手动修复字段映射 ==="
    echo "没有找到完整备份，手动修复字段映射..."
    
    # 创建临时表
    sqlite3 data/research_dashboard_prod.db "
    CREATE TABLE collaborators_fixed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        gender TEXT,
        class_name TEXT,
        future_plan TEXT,
        background TEXT,
        level VARCHAR(20) DEFAULT 'senior',
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    "
    
    # 修复数据映射
    sqlite3 data/research_dashboard_prod.db "
    INSERT INTO collaborators_fixed (id, name, gender, class_name, future_plan, level, created_at, updated_at)
    SELECT id, name, email, institution, research_area, level, created_at, updated_at
    FROM collaborators;
    "
    
    # 替换表
    sqlite3 data/research_dashboard_prod.db "
    DROP TABLE collaborators;
    ALTER TABLE collaborators_fixed RENAME TO collaborators;
    "
    
    echo "字段映射修复完成"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, gender, class_name FROM collaborators LIMIT 3;"
fi

echo ""
echo "=== 5. 重启服务并最终测试 ==="
systemctl restart research-backend
sleep 3
echo "服务状态: $(systemctl is-active research-backend)"

echo ""
echo "最终API测试:"
if [ -n "$TOKEN" ]; then
    FINAL_RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/collaborators/")
    echo "API返回长度: ${#FINAL_RESULT}"
    if [ "${#FINAL_RESULT}" -gt 10 ]; then
        echo "✅ API修复成功！"
        echo "返回数据样例:"
        echo "$FINAL_RESULT" | head -200
    else
        echo "❌ API仍有问题"
        echo "检查服务日志:"
        journalctl -u research-backend -n 10 --no-pager
    fi
fi

echo ""
echo "=== 修复完成 ==="
echo "请检查前端页面验证数据显示是否正常"