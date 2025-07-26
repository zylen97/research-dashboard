"""
AI服务模块 - 恢复完整错误处理
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
        # 创建共享的HTTP客户端，避免每次创建新连接
        self._http_client = None
        
    async def _get_http_client(self):
        """获取或创建共享的HTTP客户端"""
        if self._http_client is None:
            timeout_config = httpx.Timeout(
                connect=30.0,    # 连接超时
                read=120.0,      # 读取超时
                write=30.0,      # 写入超时
                pool=10.0        # 连接池超时
            )
            
            limits = httpx.Limits(
                max_keepalive_connections=20,  # 增加保持连接数
                max_connections=50,            # 增加最大连接数
                keepalive_expiry=30.0          # 连接保持时间
            )
            
            self._http_client = httpx.AsyncClient(
                timeout=timeout_config,
                limits=limits
            )
        return self._http_client
    
    async def close(self):
        """关闭HTTP客户端"""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        
    async def get_ai_config(self) -> Dict[str, Any]:
        """获取AI配置"""
        return ai_config.get_config()
    
    async def call_ai_api(self, prompt: str, content: str = None) -> Dict[str, Any]:
        """调用AI API - 恢复完整错误处理和重试机制"""
        config = await self.get_ai_config()
        
        # 记录使用的模型
        model = config.get('model', 'claude-3-7-sonnet-20250219')
        logger.info(f"🚀 使用AI模型: {model}")
        
        # 构建API URL
        api_base = config.get('api_base', 'https://api.chatanywhere.tech/v1')
        logger.info(f"📡 原始API URL: {api_base}")
        
        # 确保URL正确拼接
        if not api_base.endswith('/'):
            api_base += '/'
        if api_base.endswith('/v1/'):
            api_url = api_base + 'chat/completions'
        elif api_base.endswith('/v1'):
            api_url = api_base + '/chat/completions'
        elif '/chat/completions' in api_base:
            # 如果已经包含完整路径，直接使用
            api_url = api_base
        else:
            # 其他情况，假设需要添加/chat/completions
            api_url = api_base.rstrip('/') + '/chat/completions'
        
        logger.info(f"📡 最终API URL: {api_url}")
        
        api_key = config.get('api_key')
        max_tokens = config.get('max_tokens', 1500)
        temperature = config.get('temperature', 0.7)
        
        logger.info(f"📋 API参数: model={model}, max_tokens={max_tokens}, temperature={temperature}")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
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
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        # 重试机制配置
        max_retries = 3
        base_delay = 1  # 基础延迟秒数
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    # 指数退避延迟
                    delay = base_delay * (2 ** (attempt - 1))
                    logger.info(f"🔄 第{attempt + 1}次重试，延迟{delay}秒...")
                    await asyncio.sleep(delay)
                
                logger.info(f"📡 发送HTTP请求到AI服务... (第{attempt + 1}/{max_retries}次尝试)")
                
                # 使用共享的HTTP客户端
                client = await self._get_http_client()
                response = await client.post(api_url, json=data, headers=headers)
                    
                logger.info(f"📡 收到响应: status_code={response.status_code} (第{attempt + 1}次尝试)")
                
                # 处理响应结果
                if response.status_code == 200:
                    result = response.json()
                    ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                    logger.info(f"✅ AI响应成功，内容长度: {len(ai_response) if ai_response else 0}")
                    return {
                        "success": True,
                        "response": ai_response,
                        "usage": result.get("usage", {}),
                        "model_used": model
                    }
                else:
                    error_text = response.text
                    logger.error(f"❌ AI API错误: status={response.status_code}, 响应内容: {error_text[:500]}...")
                    
                    # 尝试解析错误信息
                    try:
                        error_detail = response.json().get('error', {}).get('message', error_text)
                    except:
                        error_detail = error_text
                        
                    # 根据状态码提供更详细的错误信息
                    if response.status_code == 401:
                        error_msg = "API密钥验证失败，请检查API Key是否正确"
                    elif response.status_code == 403:
                        error_msg = "API访问被拒绝，请检查API Key权限"
                    elif response.status_code == 429:
                        error_msg = "API调用频率超限，请稍后重试"
                        # 对于429错误，继续重试
                        if attempt < max_retries - 1:
                            continue
                    elif response.status_code == 500:
                        error_msg = "AI服务内部错误，请稍后重试"
                        # 对于500错误，继续重试
                        if attempt < max_retries - 1:
                            continue
                    elif response.status_code == 502 or response.status_code == 503:
                        error_msg = "AI服务暂时不可用，请稍后重试"
                        # 对于502/503错误，继续重试
                        if attempt < max_retries - 1:
                            continue
                    else:
                        error_msg = f"API错误 {response.status_code}: {error_detail}"
                        
                    return {
                        "success": False,
                        "error": error_msg,
                        "response": None,
                        "status_code": response.status_code
                    }
                
                # 如果成功，跳出重试循环
                break
                
            except httpx.TimeoutException as e:
                error_msg = f"AI服务请求超时 (第{attempt + 1}/{max_retries}次)"
                logger.warning(f"⏰ {error_msg}: {e}")
                if attempt == max_retries - 1:  # 最后一次尝试
                    logger.error("❌ 所有重试尝试都超时失败")
                    return {
                        "success": False,
                        "error": f"AI服务请求超时，已重试{max_retries}次仍无法连接，请检查网络或稍后重试",
                        "response": None
                    }
                continue  # 继续重试
                
            except httpx.ConnectError as e:
                error_msg = f"无法连接到AI服务 (第{attempt + 1}/{max_retries}次)"
                logger.warning(f"🔌 {error_msg}: {e}")
                if attempt == max_retries - 1:  # 最后一次尝试
                    logger.error("❌ 所有重试尝试都连接失败")
                    return {
                        "success": False,
                        "error": f"无法连接到AI服务，已重试{max_retries}次仍无法连接，请检查API地址和网络设置",
                        "response": None
                    }
                continue  # 继续重试
                
            except httpx.HTTPStatusError as e:
                # HTTP错误不重试，直接返回
                logger.error(f"❌ HTTP状态错误: {e.response.status_code} - {e.response.text[:200]}")
                return {
                    "success": False,
                    "error": f"AI服务返回HTTP错误: {e.response.status_code}",
                    "response": None
                }
                
            except Exception as e:
                error_msg = f"AI服务调用异常 (第{attempt + 1}/{max_retries}次)"
                logger.warning(f"⚠️ {error_msg}: {e}")
                if attempt == max_retries - 1:  # 最后一次尝试
                    logger.error("❌ 所有重试尝试都失败")
                    return {
                        "success": False,
                        "error": f"AI服务调用失败: {str(e)} (已重试{max_retries}次)",
                        "response": None
                    }
                continue  # 继续重试
        
        # 这里不应该到达，但为了安全起见
        return {
            "success": False,
            "error": "未知错误：重试循环结束但没有返回结果",
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