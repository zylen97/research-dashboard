#\!/bin/bash

echo "=== 查找部署目录 ==="
echo ""

echo "1. 查找diagnose-cors.sh文件："
find / -name "diagnose-cors.sh" -type f 2>/dev/null | grep -v proc
echo ""

echo "2. 查找research-dashboard目录："
find / -type d -name "*research*" 2>/dev/null | grep -v proc | head -10
echo ""

echo "3. 查看/var/www目录结构："
ls -la /var/www/
echo ""

echo "4. 查看home目录："
ls -la /home/
echo ""

echo "5. 查看当前用户home目录："
ls -la ~/
echo ""

echo "6. 查找nginx配置中的root路径："
grep -r "root" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "#"
