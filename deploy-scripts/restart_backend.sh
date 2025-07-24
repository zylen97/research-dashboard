#!/bin/bash

echo "重启后端服务..."
systemctl restart research-backend
echo "✅ 后端服务已重启"
echo ""
echo "请现在尝试登录："
echo "用户名: zl"
echo "密码: 123"