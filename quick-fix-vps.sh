#!/bin/bash

echo "🚨 快速修复VPS上的CORS问题..."

ssh root@45.149.156.216 << 'EOF'
# 1. 首先确保后端服务在运行
echo "=== 检查后端服务状态 ==="
if ! systemctl is-active --quiet research-backend; then
    echo "❌ 后端服务未运行，正在启动..."
    systemctl start research-backend
    sleep 3
fi

# 2. 直接在VPS上修复CORS配置
echo -e "\n=== 修复CORS配置 ==="
cd /var/www/research-dashboard/backend

# 备份原文件
cp main.py main.py.bak

# 确保CORS配置包含所有必要的origin
cat > /tmp/cors_fix.py << 'PYTHON'
import re

with open('main.py', 'r') as f:
    content = f.read()

# 找到allow_origins配置
cors_pattern = r'allow_origins=\[(.*?)\]'
match = re.search(cors_pattern, content, re.DOTALL)

if match:
    # 确保包含所有必要的origin
    required_origins = [
        '"http://localhost:3000"',
        '"http://localhost:3001"',
        '"http://127.0.0.1:3000"',
        '"http://127.0.0.1:3001"',
        '"http://45.149.156.216"',
        '"http://45.149.156.216:80"',
        '"http://45.149.156.216:3001"',
        '"https://45.149.156.216"',
        '"https://45.149.156.216:3001"'
    ]
    
    new_origins = ',\n        '.join(required_origins)
    new_cors = f'allow_origins=[\n        {new_origins}\n    ]'
    
    content = re.sub(cors_pattern, new_cors, content, flags=re.DOTALL)
    
    with open('main.py', 'w') as f:
        f.write(content)
    
    print("✅ CORS配置已更新")
else:
    print("❌ 未找到CORS配置")
PYTHON

python3 /tmp/cors_fix.py

# 3. 显示更新后的CORS配置
echo -e "\n=== 当前CORS配置 ==="
grep -A 15 "allow_origins=" main.py

# 4. 重启后端服务
echo -e "\n=== 重启后端服务 ==="
systemctl restart research-backend
sleep 3

# 5. 验证服务状态
echo -e "\n=== 验证服务状态 ==="
systemctl status research-backend --no-pager | head -10

# 6. 测试CORS
echo -e "\n=== 测试CORS响应 ==="
curl -s -X OPTIONS http://localhost:8080/api/auth/login \
  -H "Origin: http://45.149.156.216:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -i "access-control" || echo "未找到CORS头"

# 7. 检查Nginx代理
echo -e "\n=== 检查Nginx配置 ==="
ls -la /etc/nginx/sites-enabled/ | grep research

echo -e "\n✅ 修复完成！"
EOF