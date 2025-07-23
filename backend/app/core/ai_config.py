"""
AI批量处理配置模块
"""

from typing import Dict, Any
import os


class AIBatchConfig:
    """AI批量处理配置管理类"""

    # 默认配置
    DEFAULT_CONFIG = {
        # 批处理限制
        "batch_size_limit": 50,        # 单次最大处理数量
        "max_concurrent": 5,           # 最大并发数
        "max_retries": 2,              # 最大重试次数

        # HTTP客户端配置
        "http_config": {
            "max_keepalive_connections": 20,
            "max_connections": 100,
            "keepalive_expiry": 30.0,
            "connect_timeout": 10.0,
            "read_timeout": 60.0,
            "write_timeout": 10.0,
            "pool_timeout": 5.0,
            "enable_http2": True,
        },

        # AI API配置
        "ai_api_config": {
            "default_max_tokens": 1000,
            "default_temperature": 0.7,
            "timeout_per_request": 30.0,
            "exponential_backoff_base": 2,
            "exponential_backoff_multiplier": 0.5,
        },

        # 响应解析配置
        "response_parsing": {
            "positive_keywords": [
                "相关", "匹配", "relevant", "match",
                "suitable", "appropriate", "有用", "有价值"
            ],
            "negative_keywords": [
                "不相关", "无关", "不匹配", "irrelevant",
                "not relevant", "not match", "unsuitable"
            ],
            "default_positive_score": 0.8,
            "default_negative_score": 0.3,
            "neutral_score": 0.5,
            "score_adjustment_step": 0.1,
            "max_score": 0.9,
            "min_score": 0.1,
        }
    }

    @classmethod
    def get_config(cls) -> Dict[str, Any]:
        """
        获取AI批量处理配置

        Returns:
            配置字典
        """
        config = cls.DEFAULT_CONFIG.copy()

        # 从环境变量覆盖配置
        config["batch_size_limit"] = int(
            os.getenv("AI_BATCH_SIZE_LIMIT", config["batch_size_limit"])
        )
        config["max_concurrent"] = int(
            os.getenv("AI_MAX_CONCURRENT", config["max_concurrent"])
        )
        config["max_retries"] = int(
            os.getenv("AI_MAX_RETRIES", config["max_retries"])
        )

        return config

    @classmethod
    def get_batch_size_limit(cls) -> int:
        """获取批处理大小限制"""
        return cls.get_config()["batch_size_limit"]

    @classmethod
    def get_max_concurrent(cls) -> int:
        """获取最大并发数"""
        return cls.get_config()["max_concurrent"]

    @classmethod
    def get_max_retries(cls) -> int:
        """获取最大重试次数"""
        return cls.get_config()["max_retries"]

    @classmethod
    def get_http_config(cls) -> Dict[str, Any]:
        """获取HTTP配置"""
        return cls.get_config()["http_config"]

    @classmethod
    def get_ai_api_config(cls) -> Dict[str, Any]:
        """获取AI API配置"""
        return cls.get_config()["ai_api_config"]

    @classmethod
    def get_response_parsing_config(cls) -> Dict[str, Any]:
        """获取响应解析配置"""
        return cls.get_config()["response_parsing"]


class AIPerformanceMonitor:
    """AI性能监控类"""

    def __init__(self):
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_processing_time": 0.0,
            "average_processing_time": 0.0,
            "concurrent_requests": 0,
            "retry_count": 0,
        }

    def record_request(self, success: bool, processing_time: float,
                      retries: int = 0):
        """
        记录请求统计信息

        Args:
            success: 请求是否成功
            processing_time: 处理时间（秒）
            retries: 重试次数
        """
        self.stats["total_requests"] += 1
        if success:
            self.stats["successful_requests"] += 1
        else:
            self.stats["failed_requests"] += 1

        self.stats["total_processing_time"] += processing_time
        self.stats["average_processing_time"] = (
            self.stats["total_processing_time"] / self.stats["total_requests"]
        )
        self.stats["retry_count"] += retries

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.stats.copy()

    def get_success_rate(self) -> float:
        """获取成功率"""
        if self.stats["total_requests"] == 0:
            return 0.0
        return (self.stats["successful_requests"] /
                self.stats["total_requests"])

    def reset_stats(self):
        """重置统计信息"""
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_processing_time": 0.0,
            "average_processing_time": 0.0,
            "concurrent_requests": 0,
            "retry_count": 0,
        }


# 全局性能监控实例
performance_monitor = AIPerformanceMonitor()


def get_optimized_prompt_template(base_template: str,
                                 optimization_level: str = "standard") -> str:
    """
    获取优化的提示词模板

    Args:
        base_template: 基础模板
        optimization_level: 优化级别 (standard, fast, detailed)

    Returns:
        优化后的提示词模板
    """
    if optimization_level == "fast":
        # 快速模式：简化提示词，减少token数量
        return base_template + "\n\n请用一句话简要回答是否相关（相关/不相关）。"

    elif optimization_level == "detailed":
        # 详细模式：要求更详细的分析
        return (base_template +
                "\n\n请详细分析相关性，并提供1-10分的评分和具体理由。")

    else:
        # 标准模式
        return base_template + "\n\n请评估相关性并说明理由。"


def calculate_dynamic_batch_size(total_items: int,
                                system_load: float = 0.5) -> int:
    """
    根据系统负载动态计算批处理大小

    Args:
        total_items: 总项目数
        system_load: 系统负载 (0.0-1.0)

    Returns:
        推荐的批处理大小
    """
    config = AIBatchConfig.get_config()
    base_limit = config["batch_size_limit"]

    # 根据系统负载调整
    if system_load > 0.8:
        # 高负载时减少批处理大小
        return min(base_limit // 2, total_items)
    elif system_load < 0.3:
        # 低负载时可以增加批处理大小
        return min(int(base_limit * 1.5), total_items)
    else:
        # 正常负载
        return min(base_limit, total_items)


def estimate_processing_time(item_count: int,
                           avg_time_per_item: float = 2.0) -> float:
    """
    估算处理时间

    Args:
        item_count: 项目数量
        avg_time_per_item: 每项平均处理时间（秒）

    Returns:
        估算的总处理时间（秒）
    """
    config = AIBatchConfig.get_config()
    max_concurrent = config["max_concurrent"]

    # 考虑并发处理的时间优化
    concurrent_groups = ((item_count + max_concurrent - 1) //
                        max_concurrent)
    estimated_time = concurrent_groups * avg_time_per_item

    # 添加一些缓冲时间
    return estimated_time * 1.2
