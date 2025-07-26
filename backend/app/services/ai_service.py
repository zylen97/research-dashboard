"""
简化的AI服务模块
"""
import httpx
import asyncio
from typing import Dict, Any
from sqlalchemy.orm import Session
from ..core.simple_ai_config import ai_config
import logging

logger = logging.getLogger(__name__)


class AIService:
    """简化的AI服务类"""
    
    def __init__(self, db: Session):
        self.db = db
        
    async def get_ai_config(self) -> Dict[str, Any]:
        """获取AI配置"""
        return ai_config.get_config()
    
    async def call_ai_api(self, prompt: str, content: str = None) -> Dict[str, Any]:
        """调用AI API"""
        try:
            config = await self.get_ai_config()
            
            # 记录使用的模型
            model = config.get('model', 'claude-3-7-sonnet-20250219')
            logger.info(f"🚀 使用AI模型: {model}")
            
            # 构建API URL
            api_url = config['api_base']
            if not api_url.endswith('/'):
                api_url += '/'
            if not api_url.endswith('chat/completions'):
                api_url += 'chat/completions'
            
            # 准备请求
            headers = {
                "Authorization": f"Bearer {config['api_key']}",
                "Content-Type": "application/json"
            }
            
            # 构建消息
            messages = [
                {
                    "role": "system",
                    "content": "你是一个专业的研究助手，擅长分析学术数据并提供研究建议。"
                },
                {
                    "role": "user", 
                    "content": f"{prompt}\n\n{content or ''}"
                }
            ]
            
            data = {
                "model": model,
                "messages": messages,
                "max_tokens": 1500,
                "temperature": 0.7
            }
            
            # 发送请求
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(api_url, json=data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                logger.info("✅ AI调用成功")
                return {
                    "success": True,
                    "response": ai_response,
                    "model_used": model
                }
            else:
                error_msg = f"AI API错误: HTTP {response.status_code}"
                logger.error(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "response": None
                }
                
        except Exception as e:
            error_msg = f"AI服务调用异常: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "response": None
            }
    
    async def process_with_prompt(self, content: str, prompt: str) -> Dict[str, Any]:
        """使用指定的prompt处理内容"""
        logger.info(f"🚀 开始处理内容，内容长度: {len(content)}, prompt长度: {len(prompt)}")
        
        result = await self.call_ai_api(prompt, content)
        
        if result["success"]:
            logger.info("✅ 内容处理成功")
            return {
                "success": True,
                "response": result["response"],
                "error": None
            }
        else:
            logger.error(f"❌ 内容处理失败: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "处理失败"),
                "response": None
            }
    
    async def generate_chat_response(self, message: str) -> Dict[str, Any]:
        """生成聊天回复"""
        logger.info(f"🚀 生成聊天回复，消息长度: {len(message)}")
        
        chat_prompt = """你是一个专业的AI助手，能够回答用户的各种问题并提供帮助。
请根据用户的消息给予友好、准确、有用的回复。"""
        
        result = await self.call_ai_api(chat_prompt, message)
        
        if result["success"]:
            logger.info("✅ 聊天回复生成成功")
            return {
                "success": True,
                "response": result["response"],
                "error": None
            }
        else:
            logger.error(f"❌ 聊天回复生成失败: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "回复生成失败"),
                "response": None
            }


def create_ai_service(db: Session) -> AIService:
    """创建AI服务实例"""
    return AIService(db)