"""
简单AI配置管理器
不使用数据库，不使用缓存，直接管理配置
"""
import json
import os
from typing import Dict, Any, List, Optional
from pathlib import Path


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
        """初始化配置管理器"""
        self.config_file = Path(__file__).parent.parent / "data" / "ai_config.json"
        self.config_file.parent.mkdir(exist_ok=True)
        self._config = None
        
    def _load_config(self) -> Dict[str, Any]:
        """从文件加载配置"""
        if not self.config_file.exists():
            return self.DEFAULT_CONFIG.copy()
            
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # 确保配置完整
                for key, value in self.DEFAULT_CONFIG.items():
                    if key not in config:
                        config[key] = value
                return config
        except Exception:
            return self.DEFAULT_CONFIG.copy()
    
    def _save_config(self, config: Dict[str, Any]) -> None:
        """保存配置到文件"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception:
            pass
    
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