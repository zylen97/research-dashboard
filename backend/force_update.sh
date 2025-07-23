#!/bin/bash

# 强制更新脚本 - 确保VPS拉取最新代码

echo "=== 强制更新文件夹功能 ==="
echo ""
echo "这个脚本将："
echo "1. 添加一个标记文件来触发VPS更新"
echo "2. 强制git推送"
echo "3. 触发VPS重新拉取和重启"
echo ""

# 创建一个标记文件
echo "FORCE_UPDATE: $(date)" > FORCE_UPDATE_FOLDERS.txt

# 添加到git
git add FORCE_UPDATE_FOLDERS.txt

# 提交
git commit -m "force: Trigger VPS update for folders API"

# 推送
git push origin main

echo ""
echo "✅ 强制更新已触发！"
echo ""
echo "请等待2-3分钟让VPS完成更新。"
echo ""

# 清理标记文件
rm -f FORCE_UPDATE_FOLDERS.txt