"""
简化的API Settings 管理路由
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
import httpx

from ..models import get_db
from ..core.simple_ai_config import ai_config

router = APIRouter()

# 数据模型
class APISettings(BaseModel):
    api_key: str = Field(..., description="API密钥")
    api_base: str = Field(
        default="https://api.chatanywhere.tech/v1",
        description="API基础URL"
    )
    model: str = Field(
        default="claude-3-7-sonnet-20250219",
        description="默认模型"
    )

class APITestRequest(BaseModel):
    api_key: str
    api_base: str
    model: str

class APITestResponse(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    success: bool
    response: str
    message: Optional[str] = None

@router.get("/", response_model=APISettings)
async def get_settings(request: Request, db: Session = Depends(get_db)):
    """获取当前API设置"""
    config = ai_config.get_config()
    return APISettings(
        api_key=config["api_key"],
        api_base=config["api_base"],
        model=config["model"]
    )

@router.put("/api", response_model=APISettings)
async def update_api_settings(
    settings: APISettings,
    request: Request,
    db: Session = Depends(get_db)
):
    """更新API设置"""
    print(f"更新AI配置: api_key={'***已设置***' if settings.api_key else '未设置'}, api_base={settings.api_base}, model={settings.model}")
    
    # 更新配置
    ai_config.update_config(
        api_key=settings.api_key,
        api_base=settings.api_base,
        model=settings.model
    )
    
    print("AI配置更新完成")
    return settings

@router.post("/test", response_model=APITestResponse)
async def test_api_connection(test_request: APITestRequest, db: Session = Depends(get_db)):
    """测试API连接"""
    try:
        print(f"开始测试API连接: api_base={test_request.api_base}, model={test_request.model}")
        
        # 构建完整的API URL
        api_url = test_request.api_base
        if not api_url.endswith('/'):
            api_url += '/'
        if not api_url.endswith('chat/completions'):
            api_url += 'chat/completions'
        
        print(f"最终API URL: {api_url}")
        
        # 准备测试请求
        headers = {
            "Authorization": f"Bearer {test_request.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": test_request.model,
            "messages": [{"role": "user", "content": "Hello, please respond with 'API connection successful'"}],
            "max_tokens": 50
        }
        
        # 发送请求
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=data, headers=headers)
        
        print(f"API响应状态: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            print("API连接测试成功")
            
            return APITestResponse(
                success=True,
                message="API连接测试成功",
                details={
                    "status_code": response.status_code,
                    "model": test_request.model,
                    "response": ai_response
                }
            )
        else:
            print(f"API测试失败: {response.status_code}, 响应: {response.text[:200]}")
            return APITestResponse(
                success=False,
                message=f"API测试失败: HTTP {response.status_code}",
                details={
                    "status_code": response.status_code,
                    "error": response.text
                }
            )
            
    except Exception as e:
        print(f"连接测试异常: {e}")
        return APITestResponse(
            success=False,
            message=f"连接测试失败: {str(e)}",
            details={"error": str(e)}
        )

@router.get("/models")
async def get_available_models():
    """获取可用模型列表"""
    return {"models": ai_config.get_models()}

@router.post("/chat", response_model=ChatResponse)
async def send_chat_message(
    chat_request: ChatRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """发送聊天消息并获取AI回复"""
    try:
        message_content = chat_request.message.strip()
        
        if not message_content:
            return ChatResponse(
                success=False,
                response="",
                message="消息内容不能为空"
            )
        
        print(f"发送聊天消息: {message_content[:50]}...")
        
        # 获取配置
        config = ai_config.get_config()
        
        # 构建API URL
        api_url = config["api_base"]
        if not api_url.endswith('/'):
            api_url += '/'
        if not api_url.endswith('chat/completions'):
            api_url += 'chat/completions'
        
        # 准备请求
        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": config["model"],
            "messages": [
                {"role": "system", "content": "你是一个专业的AI助手，能够回答用户的各种问题并提供帮助。"},
                {"role": "user", "content": message_content}
            ],
            "max_tokens": 500,
            "temperature": 0.7
        }
        
        # 发送请求
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            return ChatResponse(
                success=True,
                response=ai_response,
                message="聊天回复生成成功"
            )
        else:
            return ChatResponse(
                success=False,
                response="",
                message=f"AI回复生成失败: HTTP {response.status_code}"
            )
            
    except Exception as e:
        print(f"聊天请求处理异常: {e}")
        return ChatResponse(
            success=False,
            response="",
            message=f"聊天服务异常: {str(e)}"
        )