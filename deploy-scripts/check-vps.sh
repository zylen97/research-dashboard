#!/bin/bash

# 🔍 VPS状态检查脚本 - 检查VPS是否可访问及服务状态

set -e

VPS_HOST="45.149.156.216"
VPS_USER="root"

echo "🔍 检查VPS状态..."

# 1. 检查网络连通性
echo "📡 测试网络连通性..."
if ping -c 3 $VPS_HOST > /dev/null 2>&1; then
    echo "✅ 网络连通正常"
else
    echo "❌ 网络连通失败"
    exit 1
fi

# 2. 检查SSH端口
echo "🔑 检查SSH端口(22)..."
if nc -z -w5 $VPS_HOST 22 2>/dev/null; then
    echo "✅ SSH端口开放"
else
    echo "❌ SSH端口不可访问"
    exit 1
fi

# 3. 检查Web端口
echo "🌐 检查Web端口(3001)..."
if nc -z -w5 $VPS_HOST 3001 2>/dev/null; then
    echo "✅ Web端口(3001)开放"
else
    echo "❌ Web端口(3001)不可访问"
fi

echo "🌐 检查后端端口(8080)..."
if nc -z -w5 $VPS_HOST 8080 2>/dev/null; then
    echo "✅ 后端端口(8080)开放"
else
    echo "❌ 后端端口(8080)不可访问"
fi

# 4. 检查HTTP响应
echo "📡 检查前端HTTP响应..."
if curl -I -m 10 http://$VPS_HOST:3001 2>/dev/null | head -1 | grep -q "200\|301\|302"; then
    echo "✅ 前端HTTP响应正常"
else
    echo "❌ 前端HTTP响应异常"
fi

echo "📡 检查后端API响应..."
if curl -I -m 10 http://$VPS_HOST:8080/docs 2>/dev/null | head -1; then
    echo "✅ 后端API响应存在"
else
    echo "❌ 后端API无响应（可能502错误）"
fi

echo ""
echo "🎯 建议下一步："
echo "1. 如果SSH不可访问，联系VPS服务商"
echo "2. 如果端口不开放，检查防火墙设置"
echo "3. 如果API无响应，需要手动重启后端服务"
echo ""
echo "📱 联系信息或手动操作："
echo "ssh $VPS_USER@$VPS_HOST"
echo "systemctl restart research-backend"