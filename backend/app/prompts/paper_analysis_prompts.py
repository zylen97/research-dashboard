"""
论文AI分析Prompt模板
用于分析论文的idea迁移价值和可行性
"""

from typing import List, Dict, Any


# Prompt模板定义
PROMPT_TEMPLATES = {
    "v1_basic": """
你是一个研究顾问。请分析以下论文的idea是否适合迁移到我的研究领域。

【我的研究背景】
{user_profile}

【我关注的研究领域】
{research_fields}

【待分析的论文】
标题：{title}
作者：{authors}
摘要：{abstract}
关键词：{keywords}
发表年份：{year}

请分析并返回JSON格式：
{{
    "core_idea": "用一句话总结这篇论文的核心idea",
    "migration_potential": "high/medium/low",
    "reason": "判断理由，说明为什么适合或不适合迁移",
    "innovation_points": ["可能的创新点1", "可能的创新点2"]
}}

注意：请只返回JSON，不要包含其他文字。
""",

    "v2_detailed": """
你是一个资深研究员，帮我评估论文的研究价值和迁移可行性。

【我的研究方向】
{research_fields}

【我的研究背景】
{user_profile}

【论文信息】
标题：{title}
作者：{authors}
摘要：{abstract}
关键词：{keywords}
发表年份：{year}
期刊：{journal}

请从以下维度分析：
1. 技术相关性（与我的研究领域重合度）
2. 方法论新颖性
3. 数据可得性（如果迁移，数据是否容易获取）
4. 实现难度评估
5. 创新点提炼

返回JSON格式：
{{
    "core_idea": "核心idea总结",
    "migration_potential": "high/medium/low",
    "technical_relevance": "high/medium/low",
    "method_novelty": "high/medium/low",
    "data_feasibility": "high/medium/low",
    "implementation_difficulty": "high/medium/low",
    "reason": "综合分析理由",
    "innovation_points": ["创新点1", "创新点2"],
    "risks": ["潜在风险1", "潜在风险2"]
}}

注意：请只返回JSON，不要包含其他文字。
"""
}


# 用户配置模板
USER_PROFILE_TEMPLATE = """
【我的研究背景】
{user_profile}

【关注领域】
{research_fields}
"""


class PromptBuilder:
    """Prompt构建器"""

    @staticmethod
    def build_analysis_prompt(
        prompt_version: str,
        paper_data: Dict[str, Any],
        user_profile: str = "",
        research_fields: List[str] = None
    ) -> str:
        """
        构建AI分析Prompt

        Args:
            prompt_version: Prompt版本 (v1_basic, v2_detailed)
            paper_data: 论文数据字典
            user_profile: 用户研究背景
            research_fields: 用户关注的研究领域列表

        Returns:
            完整的Prompt字符串
        """
        if prompt_version not in PROMPT_TEMPLATES:
            raise ValueError(f"Unknown prompt version: {prompt_version}")

        template = PROMPT_TEMPLATES[prompt_version]

        # 准备研究领域字符串
        if research_fields:
            fields_str = "\n".join([f"- {field}" for field in research_fields])
        else:
            fields_str = "- 未指定"

        # 填充模板
        prompt = template.format(
            title=paper_data.get("title", ""),
            authors=paper_data.get("authors", "未知"),
            abstract=paper_data.get("abstract", "无摘要"),
            keywords=paper_data.get("keywords", "无关键词"),
            year=paper_data.get("year", "未知"),
            journal=paper_data.get("journal_name", "未知期刊"),
            user_profile=user_profile or "未提供",
            research_fields=fields_str
        )

        return prompt

    @staticmethod
    def get_available_versions() -> List[str]:
        """获取可用的Prompt版本列表"""
        return list(PROMPT_TEMPLATES.keys())

    @staticmethod
    def get_prompt_template(version: str) -> str:
        """获取指定版本的Prompt模板"""
        if version not in PROMPT_TEMPLATES:
            raise ValueError(f"Unknown prompt version: {version}")
        return PROMPT_TEMPLATES[version]


# 默认配置
DEFAULT_PROMPT_VERSION = "v1_basic"
DEFAULT_USER_PROFILE = "我是一个研究人员，致力于探索和验证新的研究想法。"
DEFAULT_RESEARCH_FIELDS = [
    "人工智能",
    "机器学习",
    "数据挖掘"
]
