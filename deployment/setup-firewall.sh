#!/bin/bash

# 多端口Web应用防火墙配置脚本
# 用于开放多个端口支持不同的Web应用

set -e

echo "🔥 开始配置防火墙规则..."

# 检查ufw是否安装
if ! command -v ufw &> /dev/null; then
    echo "❌ ufw未安装，正在安装..."
    apt update && apt install -y ufw
fi

# 重置防火墙规则（可选，谨慎使用）
echo "🔄 配置基础防火墙规则..."

# 允许SSH（确保不会断开连接）
ufw allow ssh
ufw allow 22

# 允许HTTP和HTTPS（传统端口）
ufw allow 80
ufw allow 443

# 允许Research Dashboard（端口3001）
echo "📊 开放Research Dashboard端口3001..."
ufw allow 3001

# 预留其他Web应用端口
echo "🌐 预留其他Web应用端口..."
ufw allow 3002  # 预留给第二个应用
ufw allow 3003  # 预留给第三个应用
ufw allow 3004  # 预留给第四个应用
ufw allow 3005  # 预留给第五个应用

# 允许后端API端口（内部使用，不对外开放）
# ufw allow from 127.0.0.1 to any port 8080

# 启用防火墙
echo "✅ 启用防火墙..."
ufw --force enable

# 显示当前状态
echo "📋 当前防火墙状态："
ufw status numbered

echo "🎉 防火墙配置完成！"
echo ""
echo "📝 已开放的端口："
echo "  - 22   (SSH)"
echo "  - 80   (HTTP)"
echo "  - 443  (HTTPS)"
echo "  - 3001 (Research Dashboard)"
echo "  - 3002-3005 (预留给其他Web应用)"
echo ""
echo "💡 提示："
echo "  - 后端API端口8080仅限内部访问"
echo "  - 可以通过 'ufw status' 查看状态"
echo "  - 添加新端口：'ufw allow <端口号>'"
echo "  - 删除端口：'ufw delete allow <端口号>'"