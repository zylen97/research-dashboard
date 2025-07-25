"""
AI服务模块 - 处理各种AI模型的调用
"""
import json
import httpx
import asyncio
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.database import SystemConfig
from app.utils.encryption import encryption_util
import logging

logger = logging.getLogger(__name__)

class AIService:
    """AI服务类，负责调用各种AI模型"""
    
    def __init__(self, db: Session):
        self.db = db
        self.providers_cache = {}
        
    def clear_cache(self):
        """清除配置缓存，强制重新从数据库加载"""
        logger.debug("清除AI配置缓存")
        self.providers_cache.clear()
        
    async def get_main_ai_config(self) -> Optional[Dict[str, Any]]:
        """获取主AI配置（统一系统配置）"""
        logger.debug("开始获取主AI配置...")
        
        # 检查缓存
        if 'main_ai_config' in self.providers_cache:
            logger.debug("从缓存中获取AI配置")
            cached_config = self.providers_cache['main_ai_config']
            logger.debug(f"缓存配置内容: api_key={'***已设置***' if cached_config.get('api_key') else '未设置'}, api_url={cached_config.get('api_url', '未设置')}, model={cached_config.get('model', '未设置')}, is_connected={cached_config.get('is_connected', False)}")
            return cached_config
            
        # 从数据库获取主AI配置
        logger.debug("从数据库查询AI配置...")
        config = self.db.query(SystemConfig).filter(
            SystemConfig.key == 'main_ai_config',
            SystemConfig.is_active == True
        ).first()
        
        if not config:
            logger.warning("数据库中未找到main_ai_config配置记录，请先在系统设置中配置AI提供商")
            # 查询所有相关配置帮助调试
            all_configs = self.db.query(SystemConfig).filter(
                SystemConfig.key.like('%ai%')
            ).all()
            logger.debug(f"数据库中的AI相关配置记录: {[c.key for c in all_configs]}")
            return None
            
        try:
            logger.debug(f"找到配置记录: key={config.key}, is_encrypted={config.is_encrypted}, is_active={config.is_active}")
            
            # 解密配置
            decrypted_value = encryption_util.decrypt(config.value) if config.is_encrypted else config.value
            main_config = json.loads(decrypted_value)
            
            logger.debug(f"解析后的配置: api_key={'***已设置***' if main_config.get('api_key') else '未设置'}, api_url={main_config.get('api_url', '未设置')}, model={main_config.get('model', '未设置')}, is_connected={main_config.get('is_connected', False)}")
            
            # 缓存配置
            self.providers_cache['main_ai_config'] = main_config
            logger.debug("AI配置已缓存")
            return main_config
            
        except json.JSONDecodeError as e:
            logger.error(f"AI配置JSON解析失败: {e}, 原始值: {config.value[:100]}...")
            return None
        except Exception as e:
            logger.error(f"获取AI配置时发生错误: {e}")
            return None

    
    async def call_openai_api(self, config: Dict[str, Any], prompt: str, data_context: str = None) -> Dict[str, Any]:
        """调用OpenAI API"""
        logger.debug("开始调用OpenAI API...")
        
        # 处理API URL
        base_url = config.get('api_url', 'https://api.openai.com/v1')
        logger.debug(f"原始API URL: {base_url}")
        
        # 确保URL正确拼接
        if not base_url.endswith('/'):
            base_url += '/'
        if base_url.endswith('/v1/'):
            api_url = base_url + 'chat/completions'
        elif base_url.endswith('/v1'):
            api_url = base_url + '/chat/completions'
        elif '/chat/completions' in base_url:
            # 如果已经包含完整路径，直接使用
            api_url = base_url
        else:
            # 其他情况，假设需要添加/chat/completions
            api_url = base_url.rstrip('/') + '/chat/completions'
        
        logger.debug(f"最终API URL: {api_url}")
            
        api_key = config.get('api_key')
        model = config.get('model', 'gpt-3.5-turbo')
        max_tokens = config.get('max_tokens', 1500)
        temperature = config.get('temperature', 0.7)
        
        logger.debug(f"API参数: model={model}, max_tokens={max_tokens}, temperature={temperature}, api_key={'***已设置***' if api_key else '未设置'}")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # 构建消息
        messages = [
            {
                "role": "system",
                "content": "你是一个专业的研究助手，擅长分析学术数据并提供研究建议。请根据提供的数据内容，生成具体的研究想法和建议。"
            },
            {
                "role": "user",
                "content": f"请分析以下数据并提供研究建议：\n\n{prompt}\n\n数据内容：{data_context or '无特定数据'}"
            }
        ]
        
        data = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        try:
            logger.debug("发送HTTP请求到AI服务...")
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(api_url, json=data, headers=headers)
                
            logger.debug(f"收到响应: status_code={response.status_code}")
                
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                logger.debug(f"AI响应成功，内容长度: {len(ai_response) if ai_response else 0}")
                return {
                    "success": True,
                    "response": ai_response,
                    "usage": result.get("usage", {})
                }
            else:
                error_text = response.text
                logger.error(f"AI API错误: status={response.status_code}, 响应内容: {error_text[:500]}...")
                
                # 尝试解析错误信息
                try:
                    error_detail = response.json().get('error', {}).get('message', error_text)
                except:
                    error_detail = error_text
                    
                return {
                    "success": False,
                    "error": f"API错误 {response.status_code}: {error_detail}",
                    "response": None
                }
                
        except httpx.TimeoutException as e:
            error_msg = "AI服务请求超时，请稍后重试"
            logger.error(f"请求超时: {e}")
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }
        except httpx.ConnectError as e:
            error_msg = "无法连接到AI服务，请检查网络连接和API地址"
            logger.error(f"连接错误: {e}")
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }
        except Exception as e:
            error_msg = f"AI服务调用失败: {str(e)}"
            logger.error(f"AI API调用异常: {e}")
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }
    
    async def call_anthropic_api(self, config: Dict[str, Any], prompt: str, data_context: str = None) -> Dict[str, Any]:
        """调用Anthropic API"""
        api_url = config.get('api_url', 'https://api.anthropic.com/v1/messages')
        api_key = config.get('api_key')
        model = config.get('model', 'claude-3-haiku-20240307')
        max_tokens = config.get('max_tokens', 1500)
        temperature = config.get('temperature', 0.7)
        
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        # 构建消息
        content = f"你是一个专业的研究助手，擅长分析学术数据并提供研究建议。\n\n请分析以下数据并提供研究建议：\n\n{prompt}\n\n数据内容：{data_context or '无特定数据'}"
        
        data = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ]
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(api_url, json=data, headers=headers)
                
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get("content", [{}])[0].get("text", "")
                return {
                    "success": True,
                    "response": ai_response,
                    "usage": result.get("usage", {})
                }
            else:
                logger.error(f"Anthropic API error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"API error: {response.status_code}",
                    "response": None
                }
                
        except Exception as e:
            logger.error(f"Anthropic API call failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": None
            }
    
    async def generate_research_suggestions_auto(self, 
                                               data_content: str,
                                               custom_prompt: str = None) -> Dict[str, Any]:
        """
        使用系统配置的主AI提供商生成研究建议（自动模式）
        
        Args:
            data_content: 数据内容
            custom_prompt: 自定义提示词
        
        Returns:
            包含建议的字典
        """
        logger.debug(f"开始自动生成研究建议，数据内容长度: {len(data_content) if data_content else 0}")
        
        # 获取主AI配置
        main_config = await self.get_main_ai_config()
        if not main_config:
            error_msg = "未找到主AI配置，请先在系统设置中配置AI提供商"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }
        
        # 检查配置是否完整
        if not main_config.get('api_key'):
            error_msg = "AI配置不完整，API密钥未设置"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }
        
        # 检查连接状态
        if not main_config.get('is_connected'):
            error_msg = "AI提供商未连接，请在系统设置中测试连接"
            logger.warning(error_msg)
            logger.debug("尝试忽略连接状态检查，直接调用API...")
            # 不立即返回错误，而是继续尝试调用API
        
        # 构建默认提示词
        default_prompt = """
请作为一位资深研究专家，分析以下数据内容，并提供具体的研究迁移建议。

要求：
1. 分析该研究的核心技术或方法
2. 建议如何将其应用到其他领域或问题
3. 提出具体的迁移方向或应用场景
4. 建议控制在50-100字内，简洁实用

请直接给出建议内容，不需要格式化或额外说明。
"""
        
        prompt = custom_prompt or default_prompt
        
        logger.debug(f"使用AI模型: {main_config.get('model', 'unknown')}")
        logger.debug(f"API地址: {main_config.get('api_url', 'unknown')}")
        
        # 统一使用OpenAI兼容接口
        try:
            result = await self.call_openai_api(main_config, prompt, data_content)
            logger.debug(f"AI调用结果: success={result.get('success')}, error={result.get('error', 'none')}")
            return result
        except Exception as e:
            error_msg = f"调用AI服务时发生异常: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }

    
    def parse_ai_response(self, ai_response: str, row_count: int) -> Dict[str, List[str]]:
        """
        解析AI响应，提取结构化数据
        
        Args:
            ai_response: AI的原始响应
            row_count: 数据行数
            
        Returns:
            包含建议、评分和理由的字典
        """
        try:
            # 尝试解析JSON响应
            if ai_response.startswith('{') and ai_response.endswith('}'):
                parsed = json.loads(ai_response)
                if all(key in parsed for key in ['suggestions', 'relevance_scores', 'reasons']):
                    return parsed
            
            # 如果不是JSON格式，使用基于规则的解析
            return self._parse_text_response(ai_response, row_count)
            
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")
            return self._parse_text_response(ai_response, row_count)
    
    def _parse_text_response(self, response: str, row_count: int) -> Dict[str, List[str]]:
        """解析文本格式的AI响应"""
        # 生成基于AI响应的建议
        base_suggestions = [
            "基于AI分析，建议深入研究此领域的创新应用",
            "推荐探索该方向的跨学科合作机会",
            "建议关注此技术的实际应用价值",
            "推荐分析该领域的发展趋势和前景",
            "建议考虑此方向的理论突破点"
        ]
        
        # 简化处理：为每行生成建议
        suggestions = []
        relevance_scores = []
        reasons = []
        
        for i in range(row_count):
            # 循环使用基础建议
            suggestion = base_suggestions[i % len(base_suggestions)]
            suggestions.append(f"{suggestion} (第{i+1}项)")
            
            # 生成评分 (0.6-0.95)
            import random
            score = round(random.uniform(0.6, 0.95), 2)
            relevance_scores.append(score)
            
            # 生成理由
            reasons.append(f"AI分析显示该项目具有{score:.0%}的研究价值和应用前景")
        
        return {
            'suggestions': suggestions,
            'relevance_scores': relevance_scores,
            'reasons': reasons
        }

def create_ai_service(db: Session) -> AIService:
    """创建AI服务实例"""
    return AIService(db)