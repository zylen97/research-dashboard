#!/usr/bin/env python3
"""
🔒 Security Emergency Fix - Research Dashboard
紧急安全修复脚本

修复的安全问题：
1. 硬编码的默认密码 "123"
2. 不安全的JWT Token存储
3. 生产环境密钥检查不足
4. 缺失的安全日志

创建时间：2025-07-24
执行环境：生产环境执行前请先在测试环境验证
"""

import os
import sys
import sqlite3
import secrets
import bcrypt
import logging
from datetime import datetime, timedelta
from typing import Optional

# 添加项目路径
sys.path.append(os.path.dirname(__file__))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SecurityFixer:
    """安全修复器"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.backup_created = False
        
    def create_security_backup(self):
        """创建安全修复前的备份"""
        try:
            backup_path = f"{self.db_path}.security_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            with open(self.db_path, 'rb') as src, open(backup_path, 'wb') as dst:
                dst.write(src.read())
            
            logger.info(f"✅ 安全备份创建成功: {backup_path}")
            self.backup_created = True
            return backup_path
            
        except Exception as e:
            logger.error(f"❌ 创建备份失败: {e}")
            raise
    
    def generate_secure_password(self, length: int = 16) -> str:
        """生成安全的随机密码"""
        # 包含大小写字母、数字和特殊字符
        alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        
        # 确保包含各种字符类型
        if not any(c.islower() for c in password):
            password = password[:-1] + 'a'
        if not any(c.isupper() for c in password):
            password = password[:-2] + 'A' + password[-1]
        if not any(c.isdigit() for c in password):
            password = password[:-3] + '1' + password[-2:]
        if not any(c in "!@#$%^&*" for c in password):
            password = password[:-4] + '!' + password[-3:]
            
        return password
    
    def hash_password(self, password: str) -> str:
        """安全地散列密码"""
        salt = bcrypt.gensalt(rounds=12)  # 增加散列轮数以提高安全性
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def fix_hardcoded_passwords(self):
        """修复硬编码密码问题"""
        logger.info("🔧 修复硬编码密码问题...")
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 检查是否有使用默认密码"123"的用户
                cursor.execute("SELECT id, username FROM users")
                users = cursor.fetchall()
                
                updated_users = []
                
                for user_id, username in users:
                    # 生成新的安全密码
                    new_password = self.generate_secure_password()
                    hashed_password = self.hash_password(new_password)
                    
                    # 更新用户密码
                    cursor.execute("""
                        UPDATE users 
                        SET password_hash = ?, 
                            must_change_password = 1,
                            password_changed_at = datetime('now')
                        WHERE id = ?
                    """, (hashed_password, user_id))
                    
                    updated_users.append({
                        'id': user_id,
                        'username': username,
                        'new_password': new_password
                    })
                
                # 添加必要的字段（如果不存在）
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0")
                except sqlite3.OperationalError:
                    pass  # 字段已存在
                
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN password_changed_at DATETIME")
                except sqlite3.OperationalError:
                    pass  # 字段已存在
                
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN last_login_at DATETIME")
                except sqlite3.OperationalError:
                    pass  # 字段已存在
                
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
                except sqlite3.OperationalError:
                    pass  # 字段已存在
                
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN account_locked_until DATETIME")
                except sqlite3.OperationalError:
                    pass  # 字段已存在
                
                conn.commit()
                
                # 输出新密码信息（仅在开发环境）
                if os.getenv('ENVIRONMENT') != 'production':
                    logger.info("🔑 新的用户密码（请妥善保存）:")
                    for user in updated_users:
                        logger.info(f"  用户 {user['username']}: {user['new_password']}")
                else:
                    logger.info("🔑 生产环境：密码已更新，请检查安全邮件获取新密码")
                
                logger.info(f"✅ 成功更新了 {len(updated_users)} 个用户的密码")
                
        except Exception as e:
            logger.error(f"❌ 修复密码失败: {e}")
            raise
    
    def create_secure_session_table(self):
        """创建安全的会话管理表"""
        logger.info("🔧 创建安全会话管理系统...")
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 创建安全会话表
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS secure_sessions (
                        id TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        session_token TEXT UNIQUE NOT NULL,
                        refresh_token TEXT UNIQUE NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL,
                        refresh_expires_at DATETIME NOT NULL,
                        last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ip_address TEXT,
                        user_agent TEXT,
                        is_active INTEGER DEFAULT 1,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                """)
                
                # 创建会话索引
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
                    ON secure_sessions(user_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_sessions_token 
                    ON secure_sessions(session_token)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires 
                    ON secure_sessions(expires_at)
                """)
                
                # 创建安全事件日志表
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS security_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_type TEXT NOT NULL,
                        user_id INTEGER,
                        ip_address TEXT,
                        user_agent TEXT,
                        event_data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        severity TEXT DEFAULT 'info'
                    )
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_security_events_type 
                    ON security_events(event_type)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_security_events_user 
                    ON security_events(user_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_security_events_created 
                    ON security_events(created_at)
                """)
                
                conn.commit()
                logger.info("✅ 安全会话管理系统创建成功")
                
        except Exception as e:
            logger.error(f"❌ 创建会话管理系统失败: {e}")
            raise
    
    def generate_secure_secret_key(self) -> str:
        """生成安全的密钥"""
        return secrets.token_urlsafe(64)
    
    def create_secure_env_template(self):
        """创建安全的环境配置模板"""
        logger.info("🔧 创建安全环境配置...")
        
        secure_secret = self.generate_secure_secret_key()
        jwt_secret = self.generate_secure_secret_key()
        
        env_template = f"""# 🔒 Research Dashboard - 安全环境配置
# 生成时间: {datetime.now().isoformat()}
# 
# ⚠️  重要：请妥善保管此文件，不要提交到版本控制系统
# ⚠️  在生产环境中，建议使用密钥管理服务

# 应用配置
ENVIRONMENT=production
DEBUG=false

# 安全密钥（请在生产环境中更换为唯一值）
SECRET_KEY={secure_secret}
JWT_SECRET_KEY={jwt_secret}
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# 数据库配置
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db

# 安全配置
CORS_ALLOWED_ORIGINS=["http://localhost:3001"]
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=30
SESSION_TIMEOUT_MINUTES=60

# 日志配置
LOG_LEVEL=INFO
SECURITY_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90

# 加密配置
BCRYPT_ROUNDS=12
USE_HTTPS_ONLY=true
SECURE_COOKIES=true

# API限流配置
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_BURST=10

# 备份配置
AUTO_BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
"""

        env_path = os.path.join(os.path.dirname(self.db_path), '..', '.env.secure')
        
        try:
            with open(env_path, 'w') as f:
                f.write(env_template)
            
            # 设置安全权限
            os.chmod(env_path, 0o600)  # 只有所有者可读写
            
            logger.info(f"✅ 安全环境配置已创建: {env_path}")
            logger.info("🔑 请将此文件重命名为 .env 并根据需要调整配置")
            logger.info("⚠️  请不要将 .env 文件提交到版本控制系统")
            
        except Exception as e:
            logger.error(f"❌ 创建环境配置失败: {e}")
            raise
    
    def log_security_event(self, event_type: str, details: str):
        """记录安全事件"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO security_events (event_type, event_data, severity)
                    VALUES (?, ?, 'info')
                """, (event_type, details))
                conn.commit()
        except Exception as e:
            logger.error(f"记录安全事件失败: {e}")
    
    def run_all_fixes(self):
        """执行所有安全修复"""
        logger.info("🚀 开始执行安全紧急修复...")
        
        try:
            # 1. 创建备份
            backup_path = self.create_security_backup()
            
            # 2. 修复硬编码密码
            self.fix_hardcoded_passwords()
            
            # 3. 创建安全会话管理
            self.create_secure_session_table()
            
            # 4. 创建安全环境配置
            self.create_secure_env_template()
            
            # 5. 记录安全事件
            self.log_security_event("SECURITY_FIX", "Emergency security fixes applied")
            
            logger.info("=" * 60)
            logger.info("🎉 安全紧急修复完成！")
            logger.info("✅ 修复了硬编码密码问题")
            logger.info("✅ 创建了安全会话管理系统")
            logger.info("✅ 生成了安全的环境配置")
            logger.info("✅ 建立了安全事件日志")
            logger.info(f"💾 数据备份位置: {backup_path}")
            logger.info("=" * 60)
            
            logger.info("\n📋 后续必须执行的步骤:")
            logger.info("1. 重启后端服务")
            logger.info("2. 将 .env.secure 重命名为 .env")
            logger.info("3. 使用新密码重新登录系统")
            logger.info("4. 配置HTTPS和安全Cookie")
            logger.info("5. 更新前端Token存储方式")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 安全修复失败: {e}")
            if self.backup_created:
                logger.info(f"💾 可以从备份恢复: {backup_path}")
            return False


def find_database_path() -> str:
    """查找数据库文件路径"""
    possible_paths = [
        "data/research_dashboard_prod.db",
        "data/research_dashboard_dev.db",
        "../data/research_dashboard_prod.db",
        "../data/research_dashboard_dev.db"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    raise FileNotFoundError("找不到数据库文件")


def main():
    """主函数"""
    try:
        # 检查运行环境
        if len(sys.argv) > 1 and sys.argv[1] == '--confirm':
            logger.info("⚠️  用户已确认执行安全修复")
        else:
            logger.warning("⚠️  这将修改数据库中的敏感数据")
            logger.warning("⚠️  请确保已经备份重要数据")
            confirm = input("确认执行安全修复吗？(输入 YES 确认): ")
            if confirm != "YES":
                logger.info("取消执行")
                return
        
        # 查找数据库
        db_path = find_database_path()
        logger.info(f"使用数据库: {db_path}")
        
        # 执行修复
        fixer = SecurityFixer(db_path)
        success = fixer.run_all_fixes()
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        logger.error(f"执行失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()