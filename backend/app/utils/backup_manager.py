"""
数据库备份管理器
处理本地、GitHub和服务器的数据库备份
"""
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BackupManager:
    """数据库备份管理器"""
    
    def __init__(self):
        self.backend_dir = Path(__file__).parent.parent
        self.db_path = self.backend_dir / "research_dashboard.db"
        self.backup_dir = self.backend_dir / "backups" / "local"
        self.max_backups = 7  # 保留最近7个备份
        
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
        backup_file = backup_folder / "research_dashboard.db"
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
        backup_path = self.backup_dir / backup_name / "research_dashboard.db"
        
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
                db_file = folder / "research_dashboard.db"
                
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
                    
                    backups.append(info)
        
        return backups
    
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