#!/usr/bin/env python3
"""
通用数据库迁移脚本
- 每次数据库修改时，更新此文件内容
- 执行完成后自动标记为已完成
- 下次部署时如无新迁移则跳过
"""

import sqlite3
import sys
import os
import logging
from datetime import datetime

# 修复模块路径问题
sys.path.insert(0, os.path.dirname(__file__))

# 导入迁移工具
from migration_utils import setup_migration_logging, find_database_path, backup_database, get_table_columns, table_exists

logger = setup_migration_logging()

# 迁移版本号 - 创建prompts管理系统
MIGRATION_VERSION = "v1.29_create_simple_prompts"

def check_if_migration_completed(db_path):
    """检查迁移是否已完成"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 创建迁移记录表（如果不存在）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS migration_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT UNIQUE,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 检查当前版本是否已执行
        cursor.execute("SELECT version FROM migration_history WHERE version = ?", (MIGRATION_VERSION,))
        result = cursor.fetchone()
        
        conn.close()
        return result is not None
    except Exception as e:
        logger.error(f"检查迁移状态失败: {e}")
        return False

def mark_migration_completed(db_path):
    """标记迁移为已完成"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO migration_history (version) VALUES (?)", (MIGRATION_VERSION,))
        conn.commit()
        conn.close()
        logger.info(f"迁移版本 {MIGRATION_VERSION} 已标记为完成")
    except Exception as e:
        logger.error(f"标记迁移完成失败: {e}")

def run_migration():
    """执行当前迁移任务"""
    # 使用工具函数查找数据库路径
    db_path = find_database_path()
    if not db_path:
        logger.error("找不到数据库文件")
        return False
    
    logger.info(f"使用数据库文件: {db_path}")
    
    # 检查是否已执行过
    if check_if_migration_completed(db_path):
        logger.info(f"迁移 {MIGRATION_VERSION} 已执行过，跳过")
        return True
    
    # 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info(f"开始执行迁移: {MIGRATION_VERSION}")
        
        # ===========================================
        # 🔧 v1.29迁移任务：创建prompts管理系统
        # 用户需求：独立的prompt管理，不与用户关联 - 2025-07-26
        # ===========================================
        
        logger.info("🔧 开始v1.29迁移：创建prompts管理系统...")
        logger.info("🎯 目标：创建独立的prompts表，支持CRUD操作")
        
        # 第一步：创建prompts表
        logger.info("📋 创建prompts表...")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        logger.info("✅ prompts表创建成功")
        
        # 第二步：创建更新时间触发器
        logger.info("📋 创建更新时间触发器...")
        
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_prompts_timestamp 
            AFTER UPDATE ON prompts
            FOR EACH ROW
            BEGIN
                UPDATE prompts SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = NEW.id;
            END
        """)
        
        logger.info("✅ 触发器创建成功")
        
        # 第三步：插入默认prompt模板
        logger.info("📋 插入默认prompt模板...")
        
        default_prompts = [
            ("默认研究建议", """基于提供的文献标题和摘要，请生成一个简洁的研究迁移建议。

要求：
1. 分析该研究的核心技术或方法
2. 建议如何将其应用到其他领域或问题
3. 提出具体的迁移方向或应用场景
4. 建议控制在50-100字内

请直接给出建议内容，不需要格式化或额外说明。"""),
            
            ("创新分析", """请分析以下研究的创新点和突破性，并提出如何将其创新思路应用到其他领域。

分析要点：
1. 识别核心创新要素
2. 评估创新的独特性和价值
3. 提出跨领域应用建议
4. 预测潜在的发展方向

控制在80字内，突出创新价值和应用潜力。"""),
            
            ("应用转化", """评估以下研究的实际应用价值和产业转化潜力。

评估维度：
1. 技术成熟度和可行性
2. 市场需求和商业价值
3. 转化路径和关键节点
4. 产业化建议和时间预期

简洁评估，控制在100字内，重点关注实用性和转化前景。"""),
            
            ("跨学科研究", """从跨学科角度分析以下研究，提出学科融合建议。

分析角度：
1. 识别涉及的学科领域
2. 分析学科交叉的创新点
3. 提出进一步融合的方向
4. 建议协作的学科和方法

控制在90字内，突出跨学科合作的价值和可能性。""")
        ]
        
        for name, content in default_prompts:
            cursor.execute(
                "INSERT OR IGNORE INTO prompts (name, content) VALUES (?, ?)",
                (name, content)
            )
            logger.info(f"✅ 插入默认prompt: {name}")
        
        # 第四步：验证迁移结果
        logger.info("🔍 验证迁移结果...")
        cursor.execute("SELECT COUNT(*) FROM prompts")
        count = cursor.fetchone()[0]
        logger.info(f"✅ prompts表中有 {count} 条记录")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.29 prompts管理系统创建完成！")
        logger.info("✅ 创建了prompts表")
        logger.info("✅ 插入了4个默认prompt模板")
        logger.info("✅ 支持独立的prompt CRUD管理")
        logger.info("✅ 为Excel处理提供prompt选择功能")
        logger.info("✅ 完全独立，不依赖用户系统")
        logger.info("🚀 Prompt管理更加简单直观")
        logger.info("=" * 70)
        
        conn.close()
        
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {e}")
        logger.error(f"错误类型: {type(e).__name__}")
        logger.error(f"详细错误信息: {str(e)}")
        
        # 尝试回滚事务
        try:
            conn.rollback()
            logger.info("事务已回滚")
        except:
            logger.error("无法回滚事务")
        
        # 关闭连接
        try:
            conn.close()
        except:
            pass
            
        logger.info(f"数据库备份位于: {backup_path}")
        logger.error("建议从备份恢复数据库")
        return False

if __name__ == "__main__":
    logger.info(f"开始执行迁移版本: {MIGRATION_VERSION}")
    logger.info(f"执行时间: {datetime.now()}")
    
    try:
        success = run_migration()
        
        if success:
            logger.info("✅ 迁移执行成功")
            print("Migration completed successfully")
            sys.exit(0)
        else:
            logger.error("❌ 迁移执行失败")
            print("Migration failed")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.warning("迁移被用户中断")
        print("Migration interrupted by user")
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"未预期的错误: {e}")
        print(f"Unexpected error: {e}")
        sys.exit(1)