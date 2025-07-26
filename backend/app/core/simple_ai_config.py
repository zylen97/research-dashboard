"""
简单AI配置管理器
不使用数据库，不使用缓存，直接管理配置
使用安全的配置存储方式
"""
import json
import os
import tempfile
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class SimpleAIConfig:
    """简单AI配置管理器"""
    
    # 默认配置
    DEFAULT_CONFIG = {
        "api_key": "sk-LrOwl2ZEbKhZxW4s27EyGdjwnpZ1nDwjVRJk546lSspxHymY",
        "api_base": "https://api.chatanywhere.tech/v1",
        "model": "claude-3-7-sonnet-20250219"
    }
    
    # 可用模型列表
    AVAILABLE_MODELS = [
        {
            "id": "claude-3-7-sonnet-20250219",
            "name": "Claude 3.7 Sonnet", 
            "description": "高性能多模态模型"
        },
        {
            "id": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4",
            "description": "最新一代智能模型"
        },
        {
            "id": "claude-opus-4-20250514-thinking",
            "name": "Claude Opus 4 Thinking",
            "description": "Claude Opus 4思考版本"
        },
        {
            "id": "claude-opus-4-20250514",
            "name": "Claude Opus 4",
            "description": "Claude Opus 4标准版本"
        },
        {
            "id": "deepseek-v3",
            "name": "DeepSeek V3",
            "description": "DeepSeek第三代模型"
        },
        {
            "id": "deepseek-r1",
            "name": "DeepSeek R1",
            "description": "DeepSeek推理模型"
        },
        {
            "id": "gpt",
            "name": "GPT",
            "description": "OpenAI GPT模型"
        },
        {
            "id": "gpt-4.1",
            "name": "GPT-4.1",
            "description": "OpenAI GPT-4.1"
        },
        {
            "id": "gpt-4o",
            "name": "GPT-4o",
            "description": "OpenAI最新多模态模型"
        }
    ]
    
    def __init__(self):
        """初始化配置管理器 - 使用安全的存储方式"""
        self._config = None
        self.config_file = None
        
        # 尝试多种配置文件路径
        self._setup_config_file()
        
        logger.info(f"📁 AI配置文件路径: {self.config_file}")
        
    def _setup_config_file(self):
        """设置配置文件路径，按优先级尝试不同位置"""
        
        # 1. 尝试使用环境变量指定的路径
        env_config_path = os.getenv('AI_CONFIG_PATH')
        if env_config_path:
            try:
                config_path = Path(env_config_path)
                config_path.parent.mkdir(parents=True, exist_ok=True)
                # 测试写入权限
                test_file = config_path.parent / "test_write.tmp"
                test_file.write_text("test")
                test_file.unlink()
                self.config_file = config_path
                logger.info(f"✅ 使用环境变量配置路径: {self.config_file}")
                return
            except Exception as e:
                logger.warning(f"⚠️ 环境变量配置路径不可用: {e}")
        
        # 2. 尝试使用项目data目录
        try:
            project_data_path = Path(__file__).parent.parent / "data" / "ai_config.json"
            project_data_path.parent.mkdir(parents=True, exist_ok=True)
            # 测试写入权限
            test_file = project_data_path.parent / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()
            self.config_file = project_data_path
            logger.info(f"✅ 使用项目data目录: {self.config_file}")
            return
        except Exception as e:
            logger.warning(f"⚠️ 项目data目录不可用: {e}")
        
        # 3. 使用系统临时目录
        try:
            temp_dir = Path(tempfile.gettempdir()) / "research_dashboard"
            temp_dir.mkdir(exist_ok=True)
            temp_config_path = temp_dir / "ai_config.json"
            # 测试写入权限
            test_file = temp_dir / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()
            self.config_file = temp_config_path
            logger.info(f"✅ 使用系统临时目录: {self.config_file}")
            return
        except Exception as e:
            logger.warning(f"⚠️ 系统临时目录不可用: {e}")
        
        # 4. 使用用户临时目录作为最后备选
        try:
            user_temp = Path.home() / ".research_dashboard"
            user_temp.mkdir(exist_ok=True)
            user_config_path = user_temp / "ai_config.json"
            # 测试写入权限
            test_file = user_temp / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()
            self.config_file = user_config_path
            logger.info(f"✅ 使用用户目录: {self.config_file}")
            return
        except Exception as e:
            logger.error(f"❌ 用户目录也不可用: {e}")
        
        # 5. 如果都失败了，使用内存配置（不持久化）
        self.config_file = None
        logger.warning("⚠️ 所有配置文件路径都不可用，将使用内存配置（重启后丢失）")
        
    def _load_config(self) -> Dict[str, Any]:
        """从文件加载配置 - 支持内存模式"""
        # 如果没有配置文件，直接返回默认配置
        if not self.config_file:
            logger.info("📋 使用内存模式，返回默认配置")
            return self.DEFAULT_CONFIG.copy()
            
        if not self.config_file.exists():
            logger.info(f"📋 配置文件不存在，返回默认配置: {self.config_file}")
            return self.DEFAULT_CONFIG.copy()
            
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                logger.info(f"✅ 成功加载配置文件: {self.config_file}")
                
                # 确保配置完整
                updated = False
                for key, value in self.DEFAULT_CONFIG.items():
                    if key not in config:
                        config[key] = value
                        updated = True
                
                # 如果配置更新了，保存回文件
                if updated:
                    logger.info("📝 配置已更新，保存到文件")
                    self._save_config(config)
                
                return config
        except Exception as e:
            logger.error(f"❌ 加载配置文件失败: {e}")
            return self.DEFAULT_CONFIG.copy()
    
    def _save_config(self, config: Dict[str, Any]) -> None:
        """保存配置到文件 - 支持内存模式"""
        # 如果没有配置文件路径，跳过保存
        if not self.config_file:
            logger.warning("⚠️ 内存模式，跳过配置保存")
            return
            
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            logger.info(f"✅ 配置已保存到: {self.config_file}")
        except Exception as e:
            logger.error(f"❌ 保存配置文件失败: {e}")
    
    def get_config(self) -> Dict[str, Any]:
        """获取当前配置"""
        if self._config is None:
            self._config = self._load_config()
        return self._config.copy()
    
    def update_config(self, api_key: str, api_base: str, model: str) -> Dict[str, Any]:
        """更新配置"""
        config = {
            "api_key": api_key,
            "api_base": api_base,
            "model": model
        }
        self._config = config
        self._save_config(config)
        return config
    
    def get_models(self) -> List[Dict[str, str]]:
        """获取可用模型列表"""
        return self.AVAILABLE_MODELS.copy()
    
    def get_api_key(self) -> str:
        """获取API密钥"""
        return self.get_config().get("api_key", "")
    
    def get_api_base(self) -> str:
        """获取API地址"""
        return self.get_config().get("api_base", "")
    
    def get_model(self) -> str:
        """获取当前模型"""
        return self.get_config().get("model", "")


# 全局配置管理器实例
ai_config = SimpleAIConfig()