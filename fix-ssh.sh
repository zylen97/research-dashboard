#!/bin/bash
# SSH连接修复脚本

echo "🔧 修复SSH连接问题..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "请使用root用户运行此脚本"
    exit 1
fi

# 重启SSH服务
echo "📡 重启SSH服务..."
systemctl restart ssh
systemctl enable ssh

# 检查SSH服务状态
echo "🔍 检查SSH服务状态..."
if systemctl is-active --quiet ssh; then
    echo "✅ SSH服务运行正常"
else
    echo "❌ SSH服务异常，尝试重新安装..."
    apt update
    apt install -y openssh-server
    systemctl start ssh
    systemctl enable ssh
fi

# 配置防火墙
echo "🔒 配置防火墙..."
ufw allow 22
echo "✅ 已允许SSH端口22"

# 检查SSH配置
echo "⚙️ 检查SSH配置..."
if [ ! -f /etc/ssh/sshd_config ]; then
    echo "❌ SSH配置文件不存在，重新创建..."
    apt install -y openssh-server
fi

# 确保SSH配置正确
sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# 重启SSH应用配置
systemctl restart ssh

# 检查端口监听
echo "🔍 检查端口监听状态..."
if netstat -tlnp | grep -q :22; then
    echo "✅ SSH端口22正在监听"
else
    echo "❌ SSH端口22未监听"
fi

# 显示服务状态
echo ""
echo "📊 当前状态："
echo "SSH服务: $(systemctl is-active ssh)"
echo "防火墙状态: $(ufw status | head -1)"
echo "监听端口:"
netstat -tlnp | grep :22

echo ""
echo "🎉 SSH修复完成！"
echo "现在可以尝试从本地连接："
echo "ssh root@62.106.70.2"
echo ""
echo "如果还有问题，请在Web控制台运行部署脚本："
echo "curl -s https://raw.githubusercontent.com/zylen97/research-dashboard/main/github-vps-deploy.sh | bash"