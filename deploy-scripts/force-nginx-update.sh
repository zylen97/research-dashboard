#!/bin/bash

# 强制更新VPS上的nginx配置
echo "🔥 强制更新nginx配置到VPS..."

# 通过GitHub Actions触发强制nginx更新
git add -A
git commit -m "force: Trigger nginx config update - emergency CORS fix

This commit forces nginx configuration update on VPS to fix CORS redirect issue.
The nginx-3001.conf should be properly synced to resolve API redirect problems.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>" || echo "No changes to commit"

git push origin main

echo "✅ 强制推送完成，等待VPS部署..."
echo "📋 请等待2-3分钟后测试：http://45.149.156.216:3001"