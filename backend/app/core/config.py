"""
应用配置管理
"""
import os
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

# 根据环境变量加载对应的 .env 文件
env = os.getenv("ENVIRONMENT", "development")
env_file = f".env.{env}"
if Path(env_file).exists():
    load_dotenv(env_file)
else:
    load_dotenv()  # 加载默认的 .env 文件


class Settings:
    """应用配置类"""

    # 环境配置
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION: bool = ENVIRONMENT == "production"
    IS_DEVELOPMENT: bool = ENVIRONMENT == "development"

    # 安全配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "default-secret-key-change-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

    # 数据库配置
    DATABASE_URL: str = os.getenv("DATABASE_URL", 
                                  f"sqlite:///./data/research_dashboard_{'prod' if os.getenv('ENVIRONMENT') == 'production' else 'dev'}.db")

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

        # 生产环境检查
        if self.IS_PRODUCTION and self.SECRET_KEY == "default-secret-key-change-in-production":
            raise ValueError("请在生产环境中设置 SECRET_KEY 环境变量！")

    def get_database_url(self) -> str:
        """获取数据库URL"""
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
