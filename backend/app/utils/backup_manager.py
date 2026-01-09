"""
数据库备份管理器
处理本地、GitHub和服务器的数据库备份
"""
import os
import shutil
import sys
import sqlite3
from datetime import datetime
from pathlib import Path
import logging
from ..core.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BackupManager:
    """数据库备份管理器"""
    
    def __init__(self):
        self.backend_dir = Path(__file__).parent.parent.parent
        
        # 从DATABASE_URL动态解析真实数据库路径
        db_url = settings.DATABASE_URL
        if db_url.startswith("sqlite:///"):
            # 去掉 sqlite:/// 前缀，获取文件路径
            db_file_path = db_url[10:]  # 去掉 "sqlite:///"
            if db_file_path.startswith("./"):
                # 相对路径，相对于backend目录
                self.db_path = self.backend_dir / db_file_path[2:]
            else:
                # 绝对路径
                self.db_path = Path(db_file_path)
        else:
            # 非SQLite数据库，使用默认路径
            self.db_path = self.backend_dir / "research_dashboard.db"
        
        # 设置备份目录（统一使用单一目录）
        self.backup_dir = self.backend_dir / "backups"
        
        self.max_backups = 5  # 保留最近5个备份
        
        # 确保备份目录存在
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def create_backup(self, reason="manual"):
        """创建数据库备份"""
        if not self.db_path.exists():
            logger.warning("数据库文件不存在，跳过备份")
            return None
        
        # 创建时间戳目录
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_folder = self.backup_dir / timestamp
        backup_folder.mkdir(exist_ok=True)
        
        # 复制数据库文件
        backup_file = backup_folder / self.db_path.name
        shutil.copy2(self.db_path, backup_file)
        
        # 创建备份信息文件
        info_file = backup_folder / "backup_info.txt"
        with open(info_file, 'w') as f:
            f.write(f"Backup created at: {datetime.now()}\n")
            f.write(f"Reason: {reason}\n")
            f.write(f"Database size: {self.db_path.stat().st_size} bytes\n")
        
        logger.info(f"备份成功创建: {backup_folder}")
        
        # 清理旧备份
        self._cleanup_old_backups()
        
        return backup_folder
    
    def restore_backup(self, backup_name):
        """从备份恢复数据库"""
        backup_path = self.backup_dir / backup_name / self.db_path.name
        
        if not backup_path.exists():
            logger.error(f"备份不存在: {backup_name}")
            return False
        
        # 备份当前数据库（如果存在）
        if self.db_path.exists():
            self.create_backup("before_restore")
        
        # 恢复备份
        shutil.copy2(backup_path, self.db_path)
        logger.info(f"数据库已从备份恢复: {backup_name}")
        return True
    
    def list_backups(self):
        """列出所有可用备份"""
        backups = []
        
        if not self.backup_dir.exists():
            return backups
        
        for folder in sorted(self.backup_dir.iterdir(), reverse=True):
            if folder.is_dir() and folder.name != ".gitkeep":
                info_file = folder / "backup_info.txt"
                db_file = folder / self.db_path.name
                
                if db_file.exists():
                    info = {
                        "name": folder.name,
                        "path": str(folder),
                        "size": db_file.stat().st_size,
                        "created": datetime.fromtimestamp(folder.stat().st_mtime)
                    }
                    
                    # 读取备份信息
                    if info_file.exists():
                        with open(info_file, 'r') as f:
                            info["details"] = f.read()
                    
                    # 获取备份数据统计
                    stats = self.get_backup_data_stats(db_file)
                    info.update(stats)
                    
                    backups.append(info)
        
        return backups
    
    def get_backup_data_stats(self, backup_db_path: Path) -> dict:
        """获取备份数据库的统计信息"""
        try:
            conn = sqlite3.connect(backup_db_path)
            cursor = conn.cursor()

            # 统计活跃合作者数量（排除已删除的）
            cursor.execute("SELECT COUNT(*) FROM collaborators WHERE is_deleted = 0")
            collaborators_count = cursor.fetchone()[0]

            # 统计项目数量
            cursor.execute("SELECT COUNT(*) FROM research_projects")
            projects_count = cursor.fetchone()[0]

            # 统计交流日志数量
            cursor.execute("SELECT COUNT(*) FROM communication_logs")
            logs_count = cursor.fetchone()[0]

            # 统计Ideas数量 - 支持新旧表名
            try:
                cursor.execute("SELECT COUNT(*) FROM ideas")  # 新表名
                ideas_count = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                try:
                    cursor.execute("SELECT COUNT(*) FROM simple_ideas")  # 旧表名兼容
                    ideas_count = cursor.fetchone()[0]
                except sqlite3.OperationalError:
                    # 新旧表都不存在，设为0
                    ideas_count = 0

            # 统计期刊数量
            try:
                cursor.execute("SELECT COUNT(*) FROM journals")
                journals_count = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                # 表不存在，设为0
                journals_count = 0

            # 🆕 统计研究方法数量
            try:
                cursor.execute("SELECT COUNT(*) FROM research_methods")
                research_methods_count = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                research_methods_count = 0

            # 🆕 统计标签数量
            try:
                cursor.execute("SELECT COUNT(*) FROM tags")
                tags_count = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                tags_count = 0

            # 🆕 统计审计日志数量
            try:
                cursor.execute("SELECT COUNT(*) FROM audit_logs")
                audit_logs_count = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                audit_logs_count = 0

            conn.close()

            return {
                "collaborators_count": collaborators_count,
                "projects_count": projects_count,
                "logs_count": logs_count,
                "ideas_count": ideas_count,
                "journals_count": journals_count,
                "research_methods_count": research_methods_count,
                "tags_count": tags_count,
                "audit_logs_count": audit_logs_count,
            }
        except Exception as e:
            logger.warning(f"无法读取备份数据统计: {e}")
            return {
                "collaborators_count": 0,
                "projects_count": 0,
                "logs_count": 0,
                "ideas_count": 0,
                "journals_count": 0,
                "papers_count": 0,
                "research_methods_count": 0,
                "tags_count": 0,
                "audit_logs_count": 0,
            }
    
    def _cleanup_old_backups(self):
        """清理超过保留数量的旧备份"""
        backups = self.list_backups()
        
        if len(backups) > self.max_backups:
            # 删除最旧的备份
            for backup in backups[self.max_backups:]:
                backup_path = Path(backup["path"])
                shutil.rmtree(backup_path)
                logger.info(f"删除旧备份: {backup['name']}")
    
    def backup_to_github(self):
        """备份到GitHub（通过Git LFS或Release）"""
        # 这个功能将在GitHub Actions中实现
        logger.info("GitHub备份将通过GitHub Actions自动执行")
        pass
    
    def backup_to_server(self):
        """备份到服务器"""
        # 这个功能将在部署脚本中实现
        logger.info("服务器备份将在部署时自动执行")
        pass
    
    def get_backup_stats(self):
        """获取备份统计信息"""
        backups = self.list_backups()
        
        if not backups:
            return {
                "total_backups": 0,
                "total_size": 0,
                "oldest_backup": None,
                "newest_backup": None,
                "average_size": 0
            }
        
        total_size = sum(backup["size"] for backup in backups)
        
        return {
            "total_backups": len(backups),
            "total_size": total_size,
            "oldest_backup": backups[-1] if backups else None,
            "newest_backup": backups[0] if backups else None,
            "average_size": total_size // len(backups) if backups else 0,
            "max_backups": self.max_backups
        }


def main():
    """命令行接口"""
    manager = BackupManager()
    
    if len(sys.argv) < 2:
        print("用法: python backup_manager.py [create|restore|list]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "create":
        reason = sys.argv[2] if len(sys.argv) > 2 else "manual"
        backup_path = manager.create_backup(reason)
        if backup_path:
            print(f"备份已创建: {backup_path}")
    
    elif command == "restore":
        if len(sys.argv) < 3:
            print("用法: python backup_manager.py restore BACKUP_NAME")
            sys.exit(1)
        
        backup_name = sys.argv[2]
        if manager.restore_backup(backup_name):
            print(f"数据库已恢复: {backup_name}")
        else:
            print("恢复失败")
            sys.exit(1)
    
    elif command == "list":
        backups = manager.list_backups()
        if not backups:
            print("没有可用的备份")
        else:
            print(f"\n可用备份 (共 {len(backups)} 个):")
            print("-" * 60)
            for backup in backups:
                print(f"名称: {backup['name']}")
                print(f"大小: {backup['size']:,} bytes")
                print(f"创建时间: {backup['created']}")
                if "details" in backup:
                    print(f"详情:\n{backup['details']}")
                print("-" * 60)
    
    else:
        print(f"未知命令: {command}")
        print("用法: python backup_manager.py [create|restore|list]")
        sys.exit(1)


if __name__ == "__main__":
    main()