"""
API Settings 管理路由 - 简化版
参考 ultra-writing 项目实现
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
import httpx
import json

from ..models import get_db

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
        "id": "claude-opus-4-20250514",
        "name": "Claude Opus 4",
        "description": "Claude Opus 4最新版本"
    },
    {
        "id": "deepseek-v3",
        "name": "DeepSeek V3",
        "description": "DeepSeek第三代模型"
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "description": "OpenAI最新多模态模型"
    }
]

@router.get("/", response_model=APISettings)
async def get_settings(
    request: Request,
    db: Session = Depends(get_db)
):
    """获取当前用户的API设置"""
    user_id = request.state.current_user.id
    
    # 查询用户设置
    result = db.execute(
        text("SELECT api_key, api_base, model FROM user_api_settings WHERE user_id = :user_id"),
        {"user_id": user_id}
    ).fetchone()
    
    if result:
        return APISettings(
            api_key=result.api_key,
            api_base=result.api_base,
            model=result.model
        )
    else:
        # 返回默认设置
        return APISettings(
            api_key="",
            api_base="https://api.chatanywhere.tech/v1",
            model="claude-3-7-sonnet-20250219"
        )

@router.put("/api", response_model=APISettings)
async def update_api_settings(
    settings: APISettings,
    request: Request,
    db: Session = Depends(get_db)
):
    """更新API设置"""
    user_id = request.state.current_user.id
    
    # 更新或插入设置
    db.execute(
        text("""
            INSERT INTO user_api_settings (user_id, api_key, api_base, model, updated_at)
            VALUES (:user_id, :api_key, :api_base, :model, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                api_key = :api_key,
                api_base = :api_base,
                model = :model,
                updated_at = CURRENT_TIMESTAMP
        """),
        {
            "user_id": user_id,
            "api_key": settings.api_key,
            "api_base": settings.api_base,
            "model": settings.model
        }
    )
    db.commit()
    
    return settings

@router.post("/test", response_model=APITestResponse)
async def test_api_connection(
    test_request: APITestRequest
):
    """测试API连接"""
    try:
        # 构建完整的API URL
        api_url = test_request.api_base
        if not api_url.endswith('/'):
            api_url += '/'
        if not api_url.endswith('/v1/'):
            api_url += 'chat/completions'
        else:
            api_url += 'chat/completions'
        
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
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
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
            return APITestResponse(
                success=False,
                message=f"API测试失败: HTTP {response.status_code}",
                details={
                    "status_code": response.status_code,
                    "error": response.text
                }
            )
            
    except Exception as e:
        return APITestResponse(
            success=False,
            message=f"连接测试失败: {str(e)}",
            details={"error": str(e)}
        )

@router.get("/models")
async def get_available_models():
    """获取可用模型列表"""
    return {"models": AVAILABLE_MODELS}