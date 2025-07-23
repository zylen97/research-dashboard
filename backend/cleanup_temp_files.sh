#!/bin/bash

# 清理backend目录中的临时测试脚本
# Ultra Think 优化：只删除确认无用的临时文件

echo "🧹 开始清理backend临时文件..."
echo ""

# 删除测试脚本（保留test_integration.py因为部署脚本需要）
echo "📝 删除临时测试脚本..."
rm -f test_api_response.py
rm -f test_communication_logs.py  
rm -f test_simple_api.py
rm -f check_prod_folders.py
rm -f diagnose_folders.py
rm -f verify_folders.py
rm -f emergency_fix.py

# 删除临时shell脚本
echo "🔧 删除临时脚本..."
rm -f force_update.sh

# 清理旧的数据库备份（保留最近3个）
echo "💾 清理旧数据库备份..."
cd data
# 保留最新的3个dev备份
ls -t research_dashboard_dev.db.backup.* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null
# 保留最新的3个prod备份  
ls -t research_dashboard_prod.db.backup.* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null
cd ..

# 清理Python缓存
echo "🗑️ 清理Python缓存..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -exec rm -f {} + 2>/dev/null

# 显示清理结果
echo ""
echo "✅ 清理完成！"
echo ""
echo "📋 保留的重要文件："
echo "  - test_integration.py (系统集成测试)"
echo "  - init_db.py (数据库初始化)"
echo "  - main.py (主程序)"
echo "  - migrations/* (数据库迁移)"
echo "  - requirements.txt (依赖配置)"
echo ""
echo "💡 提示：此脚本执行后可以自行删除"