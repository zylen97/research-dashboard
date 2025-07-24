#!/bin/bash

# 🚨 全面系统诊断脚本
# 检测所有可能导致API失败的问题

echo "🚨 开始全面系统诊断..."
echo "时间: $(date)"
echo "========================================"

# 1. 服务状态检查
echo ""
echo "=== 1. 后端服务状态 ==="
systemctl status research-backend --no-pager
echo ""
echo "服务是否在运行: $(systemctl is-active research-backend)"
echo "服务是否启用: $(systemctl is-enabled research-backend)"

# 2. 端口检查
echo ""
echo "=== 2. 端口监听状态 ==="
netstat -tlnp | grep ":8080" || echo "❌ 端口8080未监听"
netstat -tlnp | grep ":3001" || echo "❌ 端口3001未监听"

# 3. 进程检查
echo ""
echo "=== 3. Python进程检查 ==="
ps aux | grep "python.*uvicorn" | grep -v grep || echo "❌ 没有找到uvicorn进程"

# 4. 错误日志
echo ""
echo "=== 4. 最新错误日志 ==="
journalctl -u research-backend -n 50 --no-pager | grep -E "(ERROR|Exception|Traceback|Failed)" | tail -20

# 5. 直接测试API
echo ""
echo "=== 5. 直接测试本地API ==="
cd /var/www/research-dashboard/backend || exit 1

echo "测试基础API端点:"
curl -s -o /dev/null -w "Health: %{http_code}\n" http://localhost:8080/api/health || echo "Health: 连接失败"
curl -s -o /dev/null -w "Auth: %{http_code}\n" http://localhost:8080/api/auth/login || echo "Auth: 连接失败"

echo ""
echo "测试问题API端点:"
curl -s -o /dev/null -w "Collaborators: %{http_code}\n" http://localhost:8080/api/collaborators/ || echo "Collaborators: 连接失败"
curl -s -o /dev/null -w "Research: %{http_code}\n" http://localhost:8080/api/research/ || echo "Research: 连接失败"
curl -s -o /dev/null -w "Ideas-management: %{http_code}\n" http://localhost:8080/api/ideas-management/ || echo "Ideas-management: 连接失败"

# 6. 数据库检查
echo ""
echo "=== 6. 数据库状态检查 ==="
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 数据库文件存在"
    echo "数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    
    echo ""
    echo "表列表:"
    sqlite3 data/research_dashboard_prod.db ".tables"
    
    echo ""
    echo "Collaborators表结构:"
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);"
    
    echo ""
    echo "数据统计:"
    echo "Collaborators: $(sqlite3 data/research_dashboard_prod.db 'SELECT COUNT(*) FROM collaborators;')"
    echo "Research Projects: $(sqlite3 data/research_dashboard_prod.db 'SELECT COUNT(*) FROM research_projects;')"
    echo "Users: $(sqlite3 data/research_dashboard_prod.db 'SELECT COUNT(*) FROM users;')"
    
    echo ""
    echo "Level字段检查:"
    sqlite3 data/research_dashboard_prod.db "SELECT level, COUNT(*) FROM collaborators GROUP BY level;" || echo "Level字段查询失败"
    
    echo ""
    echo "Deleted_at字段检查:"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as total, COUNT(deleted_at) as deleted FROM collaborators;" || echo "Deleted_at字段查询失败"
else
    echo "❌ 数据库文件不存在!"
fi

# 7. Python环境检查
echo ""
echo "=== 7. Python环境检查 ==="
echo "Python版本: $(python3 --version)"
echo "当前目录: $(pwd)"

echo ""
echo "关键模块导入测试:"
python3 -c "
import sys
sys.path.insert(0, '.')

# 测试基础模块
try:
    import fastapi, sqlalchemy, pydantic, uvicorn
    print('✅ 基础依赖导入成功')
except Exception as e:
    print(f'❌ 基础依赖导入失败: {e}')

# 测试应用模块
try:
    from app.models.database import Collaborator, ResearchProject
    print('✅ 数据库模型导入成功')
    
    # 检查Collaborator字段
    cols = [c.name for c in Collaborator.__table__.columns]
    print(f'Collaborator数据库字段: {cols}')
    
    # 检查属性
    from app.models.database import Collaborator as CollabModel
    c = CollabModel()
    hasattr_results = {
        'has_level': hasattr(c, 'level'),
        'has_deleted_at': hasattr(c, 'deleted_at'),
        'has_is_deleted_prop': hasattr(c, 'is_deleted'),
        'has_is_senior_prop': hasattr(c, 'is_senior')
    }
    print(f'Collaborator属性检查: {hasattr_results}')
    
except Exception as e:
    print(f'❌ 应用模块导入失败: {e}')
    import traceback
    traceback.print_exc()

# 测试schemas
try:
    from app.models.schemas import Collaborator as CollabSchema
    print('✅ Schemas导入成功')
except Exception as e:
    print(f'❌ Schemas导入失败: {e}')
"

# 8. 手动启动测试
echo ""
echo "=== 8. 手动启动测试 ==="
echo "尝试手动启动服务(5秒测试):"
timeout 5 python3 -m uvicorn main:app --host 0.0.0.0 --port 8081 2>&1 | head -10 || echo "手动启动失败"

# 9. 配置文件检查
echo ""
echo "=== 9. 配置文件检查 ==="
if [ -f ".env" ]; then
    echo "✅ .env文件存在"
    grep -E "ENVIRONMENT|DATABASE_URL" .env || echo "关键配置缺失"
else
    echo "❌ .env文件不存在"
fi

# 10. 磁盘空间检查
echo ""
echo "=== 10. 系统资源检查 ==="
echo "磁盘使用:"
df -h | grep -E "(Filesystem|/var|/)"
echo ""
echo "内存使用:"
free -h
echo ""
echo "CPU负载:"
uptime

# 11. Nginx检查
echo ""
echo "=== 11. Nginx状态检查 ==="
systemctl status nginx --no-pager | head -5
echo ""
echo "Nginx配置测试:"
nginx -t

# 12. 最新部署日志
echo ""
echo "=== 12. 最新部署日志 ==="
if [ -f "/var/log/research-dashboard-deploy.log" ]; then
    echo "最近部署记录:"
    tail -30 /var/log/research-dashboard-deploy.log | grep -E "(ERROR|INFO|MIGRATION)" | tail -10
else
    echo "❌ 部署日志文件不存在"
fi

echo ""
echo "========================================"
echo "🎯 诊断完成!"
echo ""
echo "🔧 建议操作:"
echo "1. 检查服务是否正常启动"
echo "2. 检查Python模块导入是否有错误"
echo "3. 检查数据库字段是否正确"
echo "4. 手动重启服务: systemctl restart research-backend"
echo "5. 查看完整日志: journalctl -u research-backend -f"