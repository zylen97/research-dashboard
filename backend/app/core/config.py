"""
应用配置管理
"""
import os
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

# 加载配置文件
load_dotenv()


class Settings:
    """应用配置类"""

    # 数据库配置
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/research_dashboard.db")

    # CORS配置
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")

    # 服务器配置
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))

    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: Optional[str] = os.getenv("LOG_FILE", None)

    # 文件上传配置
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB

    # 项目路径配置
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    LOGS_DIR: Path = BASE_DIR / "logs"

    def __init__(self):
        """初始化配置，创建必要的目录"""
        # 创建必要的目录
        self.DATA_DIR.mkdir(exist_ok=True)
        self.LOGS_DIR.mkdir(exist_ok=True)
        Path(self.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    def get_database_url(self) -> str:
        """获取数据库URL"""
        # 如果是相对路径的SQLite，转换为绝对路径
        if self.DATABASE_URL.startswith("sqlite:///./"):
            db_path = self.DATABASE_URL.replace("sqlite:///./", "")
            absolute_db_path = self.BASE_DIR / db_path
            # 确保父目录存在
            absolute_db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{absolute_db_path}"
        return self.DATABASE_URL

    def get_log_config(self) -> dict:
        """获取日志配置"""
        config = {
            "level": self.LOG_LEVEL,
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        }
        if self.LOG_FILE:
            config["filename"] = self.LOG_FILE
            config["filemode"] = "a"
        return config


# 创建全局配置实例
settings = Settings()
