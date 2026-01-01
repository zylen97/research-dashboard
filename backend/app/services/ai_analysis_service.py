"""
论文AI分析服务
使用ChatAnywhere API分析论文的idea迁移价值
"""
import asyncio
import json
import logging
import httpx
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import Paper, SystemConfig
from ..prompts.paper_analysis_prompts import PromptBuilder

logger = logging.getLogger(__name__)


class AIAnalysisService:
    """论文AI分析服务"""

    # 配置键名
    CONFIG_KEYS = {
        "api_key": "chatanywhere.api_key",
        "base_url": "chatanywhere.base_url",
        "model": "paper.analysis.model",
        "prompt_version": "paper.prompt_version",
        "user_profile": "paper.user_profile",
        "research_fields": "paper.research_fields",
    }

    # 默认配置
    DEFAULT_CONFIG = {
        "base_url": "https://api.chatanywhere.tech/v1",
        "model": "gpt-4o-mini",
        "prompt_version": "v1_basic",
        "user_profile": "我是一个研究人员，致力于探索和验证新的研究想法。",
        "research_fields": json.dumps(["人工智能", "机器学习", "数据挖掘"]),
    }

    @classmethod
    def get_config(cls, db: Session) -> Dict[str, str]:
        """
        从数据库获取AI配置

        Args:
            db: 数据库会话

        Returns:
            配置字典
        """
        config = cls.DEFAULT_CONFIG.copy()

        try:
            db_configs = db.query(SystemConfig).filter(
                SystemConfig.key.in_(list(cls.CONFIG_KEYS.values())),
                SystemConfig.is_active == True
            ).all()

            for cfg in db_configs:
                if cfg.key == cls.CONFIG_KEYS["api_key"]:
                    config["api_key"] = cfg.value
                elif cfg.key == cls.CONFIG_KEYS["base_url"]:
                    config["base_url"] = cfg.value
                elif cfg.key == cls.CONFIG_KEYS["model"]:
                    config["model"] = cfg.value
                elif cfg.key == cls.CONFIG_KEYS["prompt_version"]:
                    config["prompt_version"] = cfg.value
                elif cfg.key == cls.CONFIG_KEYS["user_profile"]:
                    config["user_profile"] = cfg.value
                elif cfg.key == cls.CONFIG_KEYS["research_fields"]:
                    config["research_fields"] = cfg.value

        except Exception as e:
            logger.error(f"Error loading AI config: {str(e)}")

        # 检查必需的API key
        if "api_key" not in config or not config["api_key"]:
            raise ValueError("AI API key not configured. Please set it in system configs.")

        return config

    @classmethod
    async def call_llm_api(
        cls,
        prompt: str,
        config: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        调用LLM API

        Args:
            prompt: 完整的Prompt
            config: API配置

        Returns:
            API响应
        """
        api_url = f"{config['base_url'].rstrip('/')}/chat/completions"

        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": config.get("model", cls.DEFAULT_CONFIG["model"]),
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 2000
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(api_url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()

            except httpx.HTTPError as e:
                logger.error(f"LLM API call failed: {str(e)}")
                raise

    @classmethod
    def parse_ai_response(cls, response_text: str) -> Optional[Dict[str, Any]]:
        """
        解析AI返回的JSON响应

        Args:
            response_text: AI返回的文本

        Returns:
            解析后的字典，解析失败返回None
        """
        try:
            # 尝试直接解析
            return json.loads(response_text)
        except json.JSONDecodeError:
            # 尝试提取JSON部分
            try:
                start = response_text.find("{")
                end = response_text.rfind("}") + 1
                if start != -1 and end > start:
                    json_str = response_text[start:end]
                    return json.loads(json_str)
            except:
                pass

        logger.error(f"Failed to parse AI response: {response_text[:200]}...")
        return None

    @classmethod
    async def analyze_single_paper(
        cls,
        paper: Paper,
        db: Session,
        config: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        分析单篇论文

        Args:
            paper: 论文对象
            db: 数据库会话
            config: 可选的自定义配置（覆盖默认配置）
                   支持 custom_prompt: 自定义提示词模板

        Returns:
            分析结果字典
        """
        try:
            # 获取配置（优先使用传入的配置）
            if config is None:
                config = cls.get_config(db)
            else:
                # 合并默认配置和自定义配置
                default_config = cls.DEFAULT_CONFIG.copy()
                default_config.update(config)
                config = default_config

            # 构建Prompt
            paper_data = {
                "title": paper.title,
                "authors": paper.authors or "未知",
                "abstract": paper.abstract or "无摘要",
                "keywords": paper.keywords or "无关键词",
                "year": paper.year or "未知",
                "journal_name": paper.journal.name if paper.journal else "未知期刊"
            }

            user_profile = config.get("user_profile", cls.DEFAULT_CONFIG["user_profile"])

            research_fields_json = config.get("research_fields", cls.DEFAULT_CONFIG["research_fields"])
            try:
                research_fields = json.loads(research_fields_json)
            except:
                research_fields = cls.DEFAULT_CONFIG["research_fields"]

            # 判断是否使用自定义提示词
            if "custom_prompt" in config:
                # 使用自定义提示词模板
                prompt = config["custom_prompt"]

                # 准备研究领域字符串
                if research_fields:
                    fields_str = "\n".join([f"- {field}" for field in research_fields])
                else:
                    fields_str = "- 未指定"

                # 替换内置变量
                prompt = prompt.format(
                    title=paper_data.get("title", ""),
                    authors=paper_data.get("authors", "未知"),
                    abstract=paper_data.get("abstract", "无摘要"),
                    keywords=paper_data.get("keywords", "无关键词"),
                    year=paper_data.get("year", "未知"),
                    journal_name=paper_data.get("journal_name", "未知期刊"),
                    user_profile=user_profile,
                    research_fields=fields_str
                )
            else:
                # 使用预定义的提示词版本
                prompt_version = config.get("prompt_version", cls.DEFAULT_CONFIG["prompt_version"])
                prompt = PromptBuilder.build_analysis_prompt(
                    prompt_version=prompt_version,
                    paper_data=paper_data,
                    user_profile=user_profile,
                    research_fields=research_fields
                )

            # 调用API
            api_response = await cls.call_llm_api(prompt, config)

            # 提取结果
            if "choices" in api_response and len(api_response["choices"]) > 0:
                content = api_response["choices"][0]["message"]["content"]

                # 解析JSON
                analysis_result = cls.parse_ai_response(content)

                if analysis_result:
                    # 更新论文记录
                    paper.ai_analysis_result = json.dumps(analysis_result, ensure_ascii=False)
                    paper.migration_potential = analysis_result.get("migration_potential", "low")
                    paper.core_idea_summary = analysis_result.get("core_idea", "")
                    paper.innovation_points = json.dumps(analysis_result.get("innovation_points", []), ensure_ascii=False)
                    paper.ai_analyzed_at = datetime.utcnow()
                    paper.status = "analyzed"
                    paper.updated_at = datetime.utcnow()

                    db.commit()

                    return {
                        "success": True,
                        "paper_id": paper.id,
                        "analysis": analysis_result
                    }
                else:
                    return {
                        "success": False,
                        "paper_id": paper.id,
                        "error": "Failed to parse AI response"
                    }
            else:
                return {
                    "success": False,
                    "paper_id": paper.id,
                    "error": "Invalid API response format"
                }

        except Exception as e:
            logger.error(f"Error analyzing paper {paper.id}: {str(e)}")
            return {
                "success": False,
                "paper_id": paper.id,
                "error": str(e)
            }

    @classmethod
    async def batch_analyze_papers(
        cls,
        paper_ids: List[int],
        db: Session,
        max_concurrent: int = 3,
        config: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        批量分析论文

        Args:
            paper_ids: 论文ID列表
            db: 数据库会话
            max_concurrent: 最大并发数
            config: 可选的自定义配置（覆盖默认配置）

        Returns:
            批量分析结果
        """
        results = {
            "total": len(paper_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }

        # 获取论文对象
        papers = db.query(Paper).filter(Paper.id.in_(paper_ids)).all()

        if not papers:
            return {
                "total": 0,
                "success": 0,
                "failed": 0,
                "details": [],
                "error": "No papers found"
            }

        # 创建并发控制
        semaphore = asyncio.Semaphore(max_concurrent)

        async def analyze_with_semaphore(paper: Paper):
            async with semaphore:
                return await cls.analyze_single_paper(paper, db, config)

        # 并发分析
        tasks = [analyze_with_semaphore(paper) for paper in papers]
        analysis_results = await asyncio.gather(*tasks)

        # 统计结果
        for result in analysis_results:
            results["details"].append(result)
            if result.get("success"):
                results["success"] += 1
            else:
                results["failed"] += 1

        return results
