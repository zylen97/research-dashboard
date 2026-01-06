#!/usr/bin/env python3
"""
初始化 Prompts 数据
从 科研prompts.md 导入到数据库
"""
import sqlite3
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple


def extract_variables(content: str) -> List[str]:
    """
    提取提示词中的变量 {xxx}

    支持格式：
    - {title} - 简单变量
    - {abstract:100} - 限制长度100字符（未来扩展）
    - {journal|默认值} - 带默认值（未来扩展）
    """
    return list(set(re.findall(r'\{([a-zA-Z_][a-zA-Z0-9_]*)\}', content)))


def detect_category(title: str, content: str) -> str:
    """
    根据标题和内容自动分类

    分类规则：
    - reading: 包含"精读"、"迁移"、"GEMINI"、"文章"
    - writing: 包含"写作"、"Introduction"、"Method"、"section"
    - polishing: 包含"润色"、"polishing"、"语言"
    - reviewer: 包含"审稿"、"回复"、"reviewer"
    - horizontal: 包含"横向课题"、"总结精要"
    """
    text = (title + " " + content).lower()

    if any(keyword in text for keyword in ['精读', '迁移', 'gemini', '解析', '文章']):
        return 'reading'
    elif any(keyword in text for keyword in ['写作', 'introduction', 'method', 'section', 'latex', '公式']):
        return 'writing'
    elif any(keyword in text for keyword in ['润色', 'polishing', '语言', '英文', '中文', '翻译']):
        return 'polishing'
    elif any(keyword in text for keyword in ['审稿', '回复', 'reviewer', '评价']):
        return 'reviewer'
    elif any(keyword in text for keyword in ['横向课题', '总结精要', '书稿']):
        return 'horizontal'
    else:
        return 'writing'  # 默认归类到写作


def parse_markdown_prompts(content: str) -> List[Dict]:
    """
    解析 markdown 文件，提取提示词

    规则：
    - ## 标题 → 作为 prompt.title
    - 下的 ```代码块 → 作为 prompt.content
    - 根据标题和内容自动分类
    """
    prompts = []

    # 按章节分割
    sections = re.split(r'^##\s+', content, flags=re.MULTILINE)

    for section in sections:
        if not section.strip():
            continue

        # 分割标题和内容
        lines = section.strip().split('\n')
        if len(lines) < 2:
            continue

        title = lines[0].strip()
        body = '\n'.join(lines[1:])

        # 提取代码块
        code_blocks = re.findall(r'```(?:\w+)?\n(.*?)```', body, re.DOTALL)

        if code_blocks:
            # 如果有代码块，使用代码块作为内容
            content = '\n\n'.join(code_blocks).strip()
        else:
            # 如果没有代码块，使用整个章节内容
            content = body.strip()

        if not content:
            continue

        # 自动分类
        category = detect_category(title, content)

        # 提取变量
        variables = extract_variables(content)

        # 生成描述（使用第一行或前100字符）
        description = None
        first_line = content.split('\n')[0].strip()
        if first_line and len(first_line) < 200:
            description = first_line
        elif len(content) > 100:
            description = content[:100] + '...'

        prompts.append({
            'title': title,
            'content': content,
            'category': category,
            'description': description,
            'variables': json.dumps(variables),
            'usage_count': 0,
            'is_favorite': False,
            'is_active': True,
        })

    return prompts


def import_prompts_to_db(cursor, prompts: List[Dict]) -> int:
    """
    将解析的提示词导入数据库
    """
    inserted_count = 0

    for prompt in prompts:
        try:
            cursor.execute("""
                INSERT INTO prompts (title, content, category, description, variables, usage_count, is_favorite, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prompt['title'],
                prompt['content'],
                prompt['category'],
                prompt['description'],
                prompt['variables'],
                prompt['usage_count'],
                1 if prompt['is_favorite'] else 0,
                1 if prompt['is_active'] else 0,
            ))
            inserted_count += 1
            print(f"   ✅ 导入: {prompt['title'][:50]}...")
        except sqlite3.IntegrityError:
            print(f"   ⚠️  跳过（重复）: {prompt['title'][:50]}...")

    return inserted_count


def main():
    """主函数"""
    # 查找 markdown 文件
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    md_file = project_root / "科研prompts.md"

    if not md_file.exists():
        print(f"❌ 错误: 找不到文件 {md_file}")
        return

    print(f"📄 读取文件: {md_file}")

    # 读取 markdown 内容
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"📊 文件大小: {len(content)} 字符")

    # 解析 markdown
    print("\n🔍 开始解析 markdown 文件...")
    prompts = parse_markdown_prompts(content)

    print(f"✅ 解析完成，找到 {len(prompts)} 个提示词")

    if not prompts:
        print("⚠️  没有找到提示词，请检查 markdown 文件格式")
        return

    # 显示统计
    print("\n📋 分类统计:")
    category_counts = {}
    for prompt in prompts:
        cat = prompt['category']
        category_counts[cat] = category_counts.get(cat, 0) + 1

    for cat, count in sorted(category_counts.items()):
        print(f"   {cat}: {count} 个")

    # 查找数据库
    from migration_utils import find_database_path
    db_path = find_database_path()

    if not db_path:
        print("❌ 错误: 找不到数据库文件")
        return

    print(f"\n💾 数据库: {db_path}")

    # 连接数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 检查 prompts 表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='prompts'
        """)

        if not cursor.fetchone():
            print("❌ 错误: prompts 表不存在，请先运行 migration")
            return

        # 导入数据
        print("\n📥 开始导入数据...")
        inserted_count = import_prompts_to_db(cursor, prompts)

        # 提交事务
        conn.commit()

        print(f"\n🎉 导入完成！")
        print(f"   总共尝试导入: {len(prompts)} 个")
        print(f"   成功导入: {inserted_count} 个")
        print(f"   跳过重复: {len(prompts) - inserted_count} 个")

        # 显示导入的提示词列表
        print("\n📝 已导入的提示词:")
        cursor.execute("SELECT id, title, category FROM prompts ORDER BY id DESC LIMIT 10")
        recent_prompts = cursor.fetchall()

        for prompt_id, title, category in recent_prompts:
            print(f"   [{prompt_id}] {title[:50]}... ({category})")

    except Exception as e:
        print(f"❌ 导入失败: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
