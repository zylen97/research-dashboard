#!/bin/bash

# 调试版本问题的脚本

echo "=== 版本调试信息 ==="
echo ""

echo "1. Git仓库信息："
cd /var/www/research-dashboard
git log --oneline -3
echo ""

echo "2. 源代码中的版本："
grep -n "Research Dashboard v" frontend/src/components/MainLayout.tsx | head -5
echo ""

echo "3. 构建目录中的版本（如果存在）："
if [ -d "frontend/build" ]; then
    grep -o "Research Dashboard v[0-9]\.[0-9]" frontend/build/static/js/main.*.js 2>/dev/null | head -1 || echo "未找到版本信息"
else
    echo "构建目录不存在"
fi
echo ""

echo "4. 网站目录中的版本："
if [ -d "/var/www/html" ]; then
    ls -la /var/www/html/static/js/main.*.js
    grep -o "Research Dashboard v[0-9]\.[0-9]" /var/www/html/static/js/main.*.js 2>/dev/null | head -1 || echo "未找到版本信息"
else
    echo "网站目录不存在"
fi
echo ""

echo "5. 最后修改时间："
echo "源代码: $(stat -c %y frontend/src/components/MainLayout.tsx 2>/dev/null | cut -d' ' -f1-2)"
echo "网站文件: $(stat -c %y /var/www/html/static/js/main.*.js 2>/dev/null | cut -d' ' -f1-2)"
echo ""

echo "6. 尝试重新构建："
cd /var/www/research-dashboard/frontend
echo "清理旧构建..."
rm -rf build
echo "安装依赖..."
npm ci
echo "构建前端..."
npm run build
echo ""

echo "7. 构建后的版本："
grep -o "Research Dashboard v[0-9]\.[0-9]" build/static/js/main.*.js 2>/dev/null | head -1 || echo "构建失败或未找到版本"
echo ""

echo "8. 部署新版本："
echo "备份当前版本..."
mv /var/www/html /var/www/html.backup_$(date +%Y%m%d_%H%M%S)
echo "部署新版本..."
cp -r build /var/www/html
chown -R www-data:www-data /var/www/html
echo ""

echo "9. 最终验证："
grep -o "Research Dashboard v[0-9]\.[0-9]" /var/www/html/static/js/main.*.js 2>/dev/null | head -1 || echo "部署失败"

echo ""
echo "=== 调试完成 ==="
echo "请刷新浏览器查看是否更新到新版本"