#!/usr/bin/env python3
"""
紧急修复脚本 - 移除有问题的 prompts 端点
"""

import re

# 读取文件
with open('app/routes/literature.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 移除 prompts 端点（从 @router.get("/prompts") 到 return prompts）
pattern = r'@router\.get\("/prompts"\).*?return prompts'
content = re.sub(pattern, '', content, flags=re.DOTALL)

# 写回文件
with open('app/routes/literature.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 已移除 prompts 端点")