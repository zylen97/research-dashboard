"""
修复Ideas表的responsible_person_id字段，允许NULL值

问题：数据库中responsible_person_id是NOT NULL，但模型定义中是nullable=True
解决方案：将数据库字段改为允许NULL
"""
import sqlite3
import os

def migrate():
    """执行迁移"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard.db')

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("开始修复 ideas.responsible_person_id 字段...")

        # SQLite不支持直接ALTER COLUMN，需要重建表
        # 1. 创建新表
        cursor.execute("""
            CREATE TABLE ideas_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT NOT NULL,
                project_description TEXT NOT NULL,
                research_method TEXT NOT NULL,
                source TEXT,
                reference_paper TEXT,
                reference_journal TEXT,
                target_journal TEXT,
                responsible_person_id INTEGER,
                maturity TEXT NOT NULL DEFAULT 'immature',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                source_paper_id INTEGER,
                FOREIGN KEY(responsible_person_id) REFERENCES collaborators (id),
                FOREIGN KEY(source_paper_id) REFERENCES papers (id) ON DELETE SET NULL
            )
        """)

        # 2. 复制数据
        cursor.execute("""
            INSERT INTO ideas_new
            SELECT * FROM ideas
        """)

        # 3. 删除旧表
        cursor.execute("DROP TABLE ideas")

        # 4. 重命名新表
        cursor.execute("ALTER TABLE ideas_new RENAME TO ideas")

        # 5. 重建索引
        cursor.execute("CREATE INDEX idx_ideas_maturity ON ideas(maturity)")
        cursor.execute("CREATE INDEX idx_ideas_responsible_person_id ON ideas(responsible_person_id)")
        cursor.execute("CREATE INDEX idx_ideas_created_at ON ideas(created_at)")

        conn.commit()
        print("✅ 迁移完成：responsible_person_id 现在允许 NULL")

    except Exception as e:
        conn.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
