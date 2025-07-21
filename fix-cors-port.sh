#!/bin/bash

echo "=== 修复CORS端口问题 ==="
echo ""

echo "1. 检查前端是否有auth相关的硬编码URL"
echo "查找前端代码中的auth相关请求："
find /var/www/html -name "*.js" -type f -exec grep -l "auth/login" {} \; 2>/dev/null

echo ""
echo "2. 检查前端打包文件中的实际API调用"
echo "搜索API URL模式："
if [ -f /var/www/html/static/js/main.*.js ]; then
    echo "查找硬编码的URL："
    grep -o "http://[^\"']*api[^\"']*" /var/www/html/static/js/main.*.js | sort -u | head -10
    echo ""
    echo "查找API路径："
    grep -o "/api/auth/login" /var/www/html/static/js/main.*.js | head -5
fi

echo ""
echo "3. 重新构建前端确保使用正确配置"
echo "设置环境变量强制指定API URL："
export REACT_APP_API_URL=http://45.149.156.216:3001

echo ""
echo "4. 临时解决方案 - 确保nginx正确配置CORS"
cat > /tmp/nginx-cors-fix.conf << 'EOF'
    # CORS configuration
    set $cors_origin "$http_origin";
    if ($cors_origin = '') {
        set $cors_origin "*";
    }
    
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept, Accept-Language, Content-Language, Content-Type, Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # Handle preflight requests
    if ($request_method = OPTIONS) {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Accept, Accept-Language, Content-Language, Content-Type, Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 86400;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }
EOF

echo ""
echo "5. 检查是否有其他地方在监听80端口"
sudo netstat -tlnp | grep :80

echo ""
echo "修复建议："
echo "- 如果前端代码中有硬编码的URL，需要修改为使用window.location.origin"
echo "- 确保清除浏览器缓存和localStorage"
echo "- 可以在浏览器控制台运行: localStorage.clear(); sessionStorage.clear();"