"""
数据库迁移脚本：添加用户和团队相关表，以及多租户支持

运行方式：
python migrations/add_user_team_tables.py
"""

import sqlite3
import os
import sys
from datetime import datetime

# 添加父目录到 Python 路径，以便导入应用模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def backup_database(db_path):
    """备份数据库"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_{timestamp}"
    
    try:
        # 读取原数据库
        with open(db_path, 'rb') as src:
            with open(backup_path, 'wb') as dst:
                dst.write(src.read())
        print(f"✅ 数据库备份完成: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"❌ 备份失败: {e}")
        return None

def execute_sql(cursor, sql, description):
    """执行SQL语句并处理错误"""
    try:
        cursor.execute(sql)
        print(f"✅ {description}")
        return True
    except sqlite3.Error as e:
        print(f"❌ {description} 失败: {e}")
        return False

def migrate_database():
    """执行数据库迁移"""
    db_path = "research_dashboard.db"
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        return False
    
    # 备份数据库
    backup_path = backup_database(db_path)
    if not backup_path:
        print("❌ 无法备份数据库，取消迁移")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🚀 开始数据库迁移...")
        
        # 1. 创建用户表
        create_users_table = """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            avatar_url VARCHAR(500),
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        );
        """
        execute_sql(cursor, create_users_table, "创建用户表")
        
        # 2. 创建团队表
        create_teams_table = """
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            invite_code VARCHAR(20) UNIQUE NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            max_members INTEGER DEFAULT 10,
            creator_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creator_id) REFERENCES users(id)
        );
        """
        execute_sql(cursor, create_teams_table, "创建团队表")
        
        # 3. 创建用户团队关联表
        create_user_teams_table = """
        CREATE TABLE IF NOT EXISTS user_teams (
            user_id INTEGER,
            team_id INTEGER,
            role VARCHAR(20) DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, team_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (team_id) REFERENCES teams(id)
        );
        """
        execute_sql(cursor, create_user_teams_table, "创建用户团队关联表")
        
        # 4. 创建索引
        indexes = [
            ("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);", "用户名索引"),
            ("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);", "邮箱索引"),
            ("CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON teams(invite_code);", "邀请码索引"),
            ("CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);", "用户团队关联索引"),
            ("CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);", "团队用户关联索引"),
        ]
        
        for sql, description in indexes:
            execute_sql(cursor, sql, f"创建{description}")
        
        # 5. 为现有表添加team_id字段（如果不存在）
        tables_to_modify = [
            ("collaborators", "合作者表"),
            ("research_projects", "研究项目表"),  
            ("literature", "文献表"),
            ("ideas", "想法表"),
            ("audit_logs", "审计日志表")
        ]
        
        for table_name, description in tables_to_modify:
            # 检查表是否存在
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}';")
            if cursor.fetchone():
                # 检查team_id列是否已存在
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [column[1] for column in cursor.fetchall()]
                
                if 'team_id' not in columns:
                    if table_name == 'audit_logs':
                        # audit_logs表的team_id可以为空
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN team_id INTEGER REFERENCES teams(id);"
                    else:
                        # 其他表的team_id不能为空，但先添加为可空，后续需要手动更新
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN team_id INTEGER REFERENCES teams(id);"
                    
                    execute_sql(cursor, alter_sql, f"为{description}添加team_id字段")
                    
                    # 创建team_id索引
                    index_sql = f"CREATE INDEX IF NOT EXISTS idx_{table_name}_team_id ON {table_name}(team_id);"
                    execute_sql(cursor, index_sql, f"为{description}创建team_id索引")
                else:
                    print(f"✅ {description}已有team_id字段，跳过")
        
        # 6. 更新audit_logs表的user_id字段类型（如果需要）
        cursor.execute("PRAGMA table_info(audit_logs)")
        audit_columns = {column[1]: column[2] for column in cursor.fetchall()}
        
        if 'user_id' in audit_columns and 'VARCHAR' in audit_columns['user_id'].upper():
            print("⚠️  audit_logs表的user_id字段需要手动更新为INTEGER类型")
            print("   请在用户系统启用后手动处理历史数据")
        
        # 提交事务
        conn.commit()
        print("✅ 数据库迁移完成!")
        
        # 显示迁移后的表结构
        print("\n📊 迁移后的数据库结构:")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        tables = cursor.fetchall()
        for table in tables:
            print(f"  - {table[0]}")
        
        return True
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        # 尝试恢复备份
        try:
            conn.rollback()
            conn.close()
            
            # 恢复备份
            with open(backup_path, 'rb') as src:
                with open(db_path, 'wb') as dst:
                    dst.write(src.read())
            print(f"✅ 已从备份恢复数据库: {backup_path}")
        except Exception as restore_error:
            print(f"❌ 恢复备份失败: {restore_error}")
        
        return False
    
    finally:
        if 'conn' in locals():
            conn.close()

def show_migration_notes():
    """显示迁移后的注意事项"""
    print("\n" + "="*60)
    print("📝 迁移完成后的注意事项：")
    print("="*60)
    print("1. ⚠️  现有数据的team_id字段为空，需要：")
    print("   - 创建默认团队")
    print("   - 将现有数据分配给默认团队")
    print("   - 或删除现有测试数据")
    print()
    print("2. 🔧 后续需要手动操作：")
    print("   - 在前端添加用户注册/登录界面")
    print("   - 启用认证中间件")
    print("   - 测试多租户数据隔离")
    print()
    print("3. 📚 API变更：")
    print("   - 所有API现在需要JWT认证")
    print("   - 新增认证相关端点：/api/auth/*")
    print("   - 数据查询自动过滤team_id")
    print()
    print("4. 🔍 测试建议：")
    print("   - 创建测试用户和团队")
    print("   - 验证邀请码功能")
    print("   - 测试数据隔离效果")

if __name__ == "__main__":
    print("🔄 研究看板多用户协作系统 - 数据库迁移")
    print("="*60)
    
    if migrate_database():
        show_migration_notes()
    else:
        print("\n❌ 迁移失败，请检查错误信息")
        sys.exit(1)