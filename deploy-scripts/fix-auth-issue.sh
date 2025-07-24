#!/bin/bash

# 紧急修复认证问题脚本

set -e

echo "🔧 Research Dashboard 认证问题紧急修复"
echo "时间: $(date)"
echo "================================"

# 进入项目目录
cd /var/www/research-dashboard

echo "1️⃣ 拉取最新代码..."
git pull origin main

echo "2️⃣ 安装/更新后端依赖..."
cd backend
pip install -r requirements.txt --upgrade

echo "3️⃣ 检查数据库连接..."
python3 -c "
from app.models.database import SessionLocal
from sqlalchemy import text
try:
    db = SessionLocal()
    db.execute(text('SELECT 1'))
    print('✅ 数据库连接正常')
    db.close()
except Exception as e:
    print(f'❌ 数据库连接失败: {e}')
"

echo "4️⃣ 修复数据库权限..."
cd ..
sudo chown -R www-data:www-data backend/data/
sudo chmod 755 backend/data/
sudo chmod 644 backend/data/*.db

echo "5️⃣ 重启后端服务..."
sudo systemctl restart research-backend

echo "6️⃣ 等待服务启动..."
sleep 5

echo "7️⃣ 检查服务状态..."
systemctl status research-backend --no-pager | head -10

echo "8️⃣ 测试健康检查端点..."
echo "  测试全局健康检查..."
curl -s http://localhost:8080/api/health | head -100

echo ""
echo "  测试Ideas健康检查..."
curl -s http://localhost:8080/api/ideas-management/health | head -100

echo ""
echo "9️⃣ 运行完整验证..."
if [ -f /var/www/research-dashboard/deploy-scripts/post-deploy-verify.sh ]; then
    /var/www/research-dashboard/deploy-scripts/post-deploy-verify.sh
else
    echo "验证脚本不存在，跳过"
fi

echo ""
echo "✅ 认证修复脚本执行完成！"
echo "如果还有问题，请查看日志："
echo "  sudo journalctl -u research-backend -f"