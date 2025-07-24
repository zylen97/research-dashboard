#!/bin/bash

echo "🔍 测试SSH密钥连接..."
echo "========================"

# SSH选项
SSH_OPTIONS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"

# 1. 测试密钥文件
echo "1. 检查本地SSH密钥:"
if [ -f ~/.ssh/id_rsa ]; then
    echo "   ✅ ~/.ssh/id_rsa 存在"
    ls -la ~/.ssh/id_rsa
else
    echo "   ❌ ~/.ssh/id_rsa 不存在"
fi

# 2. 测试SSH连接（详细模式）
echo ""
echo "2. 测试SSH连接（详细日志）:"
ssh -vvv $SSH_OPTIONS root@45.149.156.216 "echo 'SSH连接成功'" 2>&1 | grep -E "(debug1|Connection|Permission|publickey|password)" | tail -20

# 3. 检查known_hosts
echo ""
echo "3. 检查known_hosts:"
if grep -q "45.149.156.216" ~/.ssh/known_hosts 2>/dev/null; then
    echo "   ✅ 服务器在known_hosts中"
else
    echo "   ⚠️ 服务器不在known_hosts中"
fi

# 4. 尝试不同的认证方法
echo ""
echo "4. 测试不同的SSH选项:"
echo "   测试1: 基本连接"
ssh $SSH_OPTIONS root@45.149.156.216 "echo OK" 2>&1 | tail -5

echo ""
echo "   测试2: 指定密钥文件"
if [ -f ~/.ssh/id_rsa ]; then
    ssh $SSH_OPTIONS -i ~/.ssh/id_rsa root@45.149.156.216 "echo OK" 2>&1 | tail -5
fi

echo ""
echo "   测试3: 仅密钥认证"
ssh $SSH_OPTIONS -o PasswordAuthentication=no root@45.149.156.216 "echo OK" 2>&1 | tail -5

echo ""
echo "5. 建议："
echo "   - 如果是'Connection closed'，可能是服务器端问题"
echo "   - 如果是'Permission denied'，可能是密钥不匹配"
echo "   - 如果是'Connection refused'，SSH服务可能未运行"
echo ""
echo "6. GitHub Actions使用的密钥："
echo "   GitHub Actions使用的是secrets.VPS_SSH_KEY"
echo "   请确保这个密钥与服务器上的authorized_keys匹配"