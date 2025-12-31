#!/usr/bin/env python3
"""
期刊数据导入脚本
从项目根目录的"期刊检索.md"文件中提取期刊信息并导入到数据库
"""

import sys
import os
import re
import sqlite3
from pathlib import Path
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

def find_database_path():
    """查找数据库文件路径"""
    # 尝试多个可能的路径
    possible_paths = [
        Path(__file__).parent.parent / "data" / "research_dashboard.db",
        Path(__file__).parent.parent.parent / "backend" / "data" / "research_dashboard.db",
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    raise FileNotFoundError("找不到数据库文件")


def find_markdown_file():
    """查找期刊检索.md文件路径"""
    # 从backend/scripts出发，向上两级到项目根目录
    possible_paths = [
        Path(__file__).parent.parent.parent / "期刊检索.md",
        Path(__file__).parent.parent / "期刊检索.md",
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    raise FileNotFoundError("找不到'期刊检索.md'文件")


def parse_english_journals(content: str):
    """
    解析英文期刊（从WOS查询语句中提取）

    返回: [(name, category), ...]
    """
    journals = []

    # 查找所有以"## "开头的分类标题和其后的so=查询语句
    pattern = r'## ([^\n]+)\n((?:so = .*?\n?)+)'

    matches = re.finditer(pattern, content, re.MULTILINE)

    for match in matches:
        category_raw = match.group(1).strip()
        query_text = match.group(2)

        # 跳过非期刊分类（如"文件名："）
        if '文件名' in category_raw or '类型' in category_raw:
            continue

        # 清理分类名称
        category = category_raw.replace('包含部分UTD', '').strip()

        # 提取期刊名称（括号内的内容）
        # 匹配模式: so = (journal name) 或 so= (journal name)
        journal_pattern = r'so\s*=\s*\(([^)]+)\)'
        journal_matches = re.findall(journal_pattern, query_text, re.IGNORECASE)

        for journal_name in journal_matches:
            journal_name = journal_name.strip()
            if journal_name:
                journals.append((journal_name, category))

    return journals


def parse_chinese_journals(content: str):
    """
    解析中文期刊（从列表中提取）

    返回: [(name, category, level), ...]
    """
    journals = []

    # 查找"## 同济列表A"等分类
    tongji_pattern = r'## (同济列表[ABab][12]?)\n(.+?)(?=\n##|\Z)'

    matches = re.finditer(tongji_pattern, content, re.DOTALL)

    for match in matches:
        level = match.group(1).strip()
        journal_list = match.group(2).strip()

        # 分割期刊名称（使用 + 或换行）
        names = re.split(r'\s*\+\s*|\n', journal_list)

        for name in names:
            name = name.strip()
            # 移除数字编号、空格、引号
            name = re.sub(r'^\d+[\.\、]\s*', '', name)
            name = name.strip('""\'\'')

            if name and len(name) > 2:  # 排除太短的内容
                category = "中文期刊"
                journals.append((name, category, level))

    # 查找"## 农林经济四大期刊"
    agri_pattern = r'## (农林经济四大期刊)\n(.+?)(?=\n##|\Z)'
    match = re.search(agri_pattern, content, re.DOTALL)

    if match:
        category = match.group(1).strip()
        journal_list = match.group(2).strip()
        names = re.split(r'\s*\+\s*|\n', journal_list)

        for name in names:
            name = name.strip()
            name = re.sub(r'^\d+[\.\、]\s*', '', name)
            name = name.strip('""\'\'')

            if name and len(name) > 2:
                journals.append((name, category, None))

    # 查找"## 工程类期刊"
    engi_pattern = r'## (工程类期刊)\n(.+?)(?=\n##|\Z)'
    match = re.search(engi_pattern, content, re.DOTALL)

    if match:
        category = match.group(1).strip()
        journal_list = match.group(2).strip()
        names = re.split(r'\s*\+\s*|\n', journal_list)

        for name in names:
            name = name.strip()
            name = re.sub(r'^\d+[\.\、]\s*', '', name)
            name = name.strip('""\'\'')

            if name and len(name) > 2:
                journals.append((name, category, None))

    return journals


def import_journals_to_db(db_path: str, journals_data: list):
    """
    导入期刊数据到数据库

    参数:
        db_path: 数据库路径
        journals_data: [(name, language, category, level), ...]
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    imported_count = 0
    skipped_count = 0
    error_count = 0

    for journal_info in journals_data:
        name, language, category, level = journal_info

        try:
            # 检查是否已存在
            cursor.execute("SELECT id FROM journals WHERE name = ?", (name,))
            existing = cursor.fetchone()

            if existing:
                print(f"⏭️  跳过已存在的期刊: {name}")
                skipped_count += 1
                continue

            # 插入新期刊
            cursor.execute("""
                INSERT INTO journals (name, language, category, level, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (name, language, category, level, datetime.utcnow(), datetime.utcnow()))

            imported_count += 1
            print(f"✅ 导入期刊: {name} (分类: {category}, 等级: {level or 'N/A'})")

        except Exception as e:
            error_count += 1
            print(f"❌ 导入失败: {name} - {str(e)}")

    conn.commit()
    conn.close()

    return imported_count, skipped_count, error_count


def main():
    """主函数"""
    print("=" * 70)
    print("📚 期刊数据导入脚本")
    print("=" * 70)

    # 查找文件路径
    try:
        db_path = find_database_path()
        md_path = find_markdown_file()

        print(f"✅ 数据库路径: {db_path}")
        print(f"✅ Markdown文件路径: {md_path}")
    except FileNotFoundError as e:
        print(f"❌ 错误: {e}")
        return 1

    # 读取markdown文件
    print("\n📖 读取期刊检索.md文件...")
    try:
        with open(md_path, 'r', encoding='utf-8') as f:
            content = f.read()
        print(f"✅ 文件读取成功，共 {len(content)} 字符")
    except Exception as e:
        print(f"❌ 读取文件失败: {e}")
        return 1

    # 解析英文期刊
    print("\n🌍 解析英文期刊...")
    english_journals_raw = parse_english_journals(content)
    print(f"✅ 找到 {len(english_journals_raw)} 个英文期刊")

    # 转换为统一格式: (name, language, category, level)
    english_journals = [(name, 'en', category, None) for name, category in english_journals_raw]

    # 解析中文期刊
    print("\n🇨🇳 解析中文期刊...")
    chinese_journals_raw = parse_chinese_journals(content)
    print(f"✅ 找到 {len(chinese_journals_raw)} 个中文期刊")

    # 转换为统一格式
    chinese_journals = []
    for item in chinese_journals_raw:
        if len(item) == 3:
            name, category, level = item
            chinese_journals.append((name, 'zh', category, level))
        else:
            # 如果解析结果不是3个元素，跳过
            print(f"⚠️  跳过格式不正确的期刊: {item}")

    # 合并所有期刊
    all_journals = english_journals + chinese_journals
    print(f"\n📊 总共需要导入 {len(all_journals)} 个期刊")
    print(f"   - 英文期刊: {len(english_journals)}")
    print(f"   - 中文期刊: {len(chinese_journals)}")

    # 导入到数据库
    print("\n💾 开始导入数据库...")
    print("-" * 70)

    imported, skipped, errors = import_journals_to_db(db_path, all_journals)

    # 打印统计
    print("-" * 70)
    print("\n" + "=" * 70)
    print("🎉 导入完成！")
    print("=" * 70)
    print(f"✅ 成功导入: {imported} 个期刊")
    print(f"⏭️  跳过已存在: {skipped} 个期刊")
    print(f"❌ 导入失败: {errors} 个期刊")
    print(f"📊 总计: {imported + skipped + errors} 个期刊")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
