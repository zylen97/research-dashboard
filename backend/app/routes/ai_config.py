"""
AI配置管理路由
提供AI配置的获取、更新和测试功能
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from ..models import get_db, SystemConfig
from ..services.ai_analysis_service import AIAnalysisService

router = APIRouter(prefix="/ai-config", tags=["AI Config"])


class AIConfigUpdate(BaseModel):
    """AI配置更新请求"""
    provider: Optional[str] = Field(None, description="API提供商: openai, chatanywhere")
    api_key: Optional[str] = Field(None, description="API密钥")
    model: Optional[str] = Field(None, description="模型名称")
    base_url: Optional[str] = Field(None, description="API基础URL")
    temperature: Optional[float] = Field(None, ge=0, le=2, description="温度参数")
    max_tokens: Optional[int] = Field(None, gt=0, description="最大token数")


class AIConfigResponse(BaseModel):
    """AI配置响应"""
    provider: str
    model: str
    base_url: Optional[str]
    temperature: float
    max_tokens: int
    # 不返回api_key以保护隐私
    has_api_key: bool


class AITestRequest(BaseModel):
    """AI测试请求"""
    provider: str = Field(..., description="API提供商")
    api_key: str = Field(..., description="API密钥")
    model: str = Field(..., description="模型名称")
    base_url: Optional[str] = Field(None, description="API基础URL")
    temperature: float = Field(0.7, ge=0, le=2, description="温度参数")
    max_tokens: int = Field(500, gt=0, description="最大token数")


class AITestResponse(BaseModel):
    """AI测试响应"""
    success: bool
    message: str
    response_time_ms: Optional[int] = None
    sample_response: Optional[str] = None
    error: Optional[str] = None


@router.get("", response_model=AIConfigResponse)
async def get_ai_config(db: Session = Depends(get_db)):
    """
    获取当前AI配置
    返回当前的AI配置，但不返回API密钥（只返回是否有密钥）
    """
    config = AIAnalysisService.get_config(db)

    # 从system_configs中获取配置
    provider_config = db.query(SystemConfig).filter(
        SystemConfig.key == "ai_provider"
    ).first()

    model_config = db.query(SystemConfig).filter(
        SystemConfig.key == "ai_model"
    ).first()

    api_key_config = db.query(SystemConfig).filter(
        SystemConfig.key == "ai_api_key"
    ).first()

    base_url_config = db.query(SystemConfig).filter(
        SystemConfig.key == "ai_base_url"
    ).first()

    temperature_config = db.query(SystemConfig).filter(
        SystemConfig.key == "ai_temperature"
    ).first()

    max_tokens_config = db.query(SystemConfig).filter(
        SystemConfig.key == "ai_max_tokens"
    ).first()

    return AIConfigResponse(
        provider=provider_config.value if provider_config else config.get("provider", "openai"),
        model=model_config.value if model_config else config.get("model", "gpt-3.5-turbo"),
        base_url=base_url_config.value if base_url_config else config.get("base_url"),
        temperature=float(temperature_config.value) if temperature_config else config.get("temperature", 0.7),
        max_tokens=int(max_tokens_config.value) if max_tokens_config else config.get("max_tokens", 2000),
        has_api_key=bool(api_key_config and api_key_config.value),
    )


@router.put("")
async def update_ai_config(config: AIConfigUpdate, db: Session = Depends(get_db)):
    """
    更新AI配置
    支持部分更新，只更新提供的字段
    """
    updates = {}

    if config.provider is not None:
        provider_cfg = db.query(SystemConfig).filter(
            SystemConfig.key == "ai_provider"
        ).first()
        if provider_cfg:
            provider_cfg.value = config.provider
        else:
            provider_cfg = SystemConfig(key="ai_provider", value=config.provider)
            db.add(provider_cfg)
        updates["provider"] = config.provider

    if config.api_key is not None:
        api_key_cfg = db.query(SystemConfig).filter(
            SystemConfig.key == "ai_api_key"
        ).first()
        if api_key_cfg:
            api_key_cfg.value = config.api_key
        else:
            api_key_cfg = SystemConfig(key="ai_api_key", value=config.api_key)
            db.add(api_key_cfg)
        updates["api_key"] = "***"  # 不返回实际密钥

    if config.model is not None:
        model_cfg = db.query(SystemConfig).filter(
            SystemConfig.key == "ai_model"
        ).first()
        if model_cfg:
            model_cfg.value = config.model
        else:
            model_cfg = SystemConfig(key="ai_model", value=config.model)
            db.add(model_cfg)
        updates["model"] = config.model

    if config.base_url is not None:
        base_url_cfg = db.query(SystemConfig).filter(
            SystemConfig.key == "ai_base_url"
        ).first()
        if base_url_cfg:
            base_url_cfg.value = config.base_url
        else:
            base_url_cfg = SystemConfig(key="ai_base_url", value=config.base_url)
            db.add(base_url_cfg)
        updates["base_url"] = config.base_url

    if config.temperature is not None:
        temp_cfg = db.query(SystemConfig).filter(
            SystemConfig.key == "ai_temperature"
        ).first()
        if temp_cfg:
            temp_cfg.value = str(config.temperature)
        else:
            temp_cfg = SystemConfig(key="ai_temperature", value=str(config.temperature))
            db.add(temp_cfg)
        updates["temperature"] = config.temperature

    if config.max_tokens is not None:
        tokens_cfg = db.query(SystemConfig).filter(
            SystemConfig.key == "ai_max_tokens"
        ).first()
        if tokens_cfg:
            tokens_cfg.value = str(config.max_tokens)
        else:
            tokens_cfg = SystemConfig(key="ai_max_tokens", value=str(config.max_tokens))
            db.add(tokens_cfg)
        updates["max_tokens"] = config.max_tokens

    db.commit()

    return {
        "success": True,
        "message": "AI配置更新成功",
        "updated_fields": list(updates.keys())
    }


@router.post("/test", response_model=AITestResponse)
async def test_ai_connection(request: AITestRequest, db: Session = Depends(get_db)):
    """
    测试AI连接
    使用提供的配置发送测试请求，验证配置是否正确
    """
    import time
    import aiohttp
    import json

    # 构建测试配置
    test_config = {
        "provider": request.provider,
        "api_key": request.api_key,
        "model": request.model,
        "base_url": request.base_url,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    }

    # 根据provider设置默认base_url
    if request.provider == "chatanywhere" and not request.base_url:
        test_config["base_url"] = "https://api.chatanywhere.tech/v1"
    elif request.provider == "openai" and not request.base_url:
        test_config["base_url"] = "https://api.openai.com/v1"

    start_time = time.time()

    try:
        # 构建测试请求
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {request.api_key}"
        }

        # 测试prompt（简单翻译测试）
        test_payload = {
            "model": request.model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'Test successful' in exactly those words."}
            ],
            "temperature": min(request.temperature, 0.3),  # 测试时用较低温度
            "max_tokens": 50
        }

        url = f"{test_config['base_url'].rstrip('/')}/chat/completions"

        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers=headers,
                json=test_payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_time = int((time.time() - start_time) * 1000)

                if response.status == 200:
                    data = await response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                    return AITestResponse(
                        success=True,
                        message="连接测试成功",
                        response_time_ms=response_time,
                        sample_response=content[:200]  # 限制长度
                    )
                elif response.status == 401:
                    error_text = await response.text()
                    return AITestResponse(
                        success=False,
                        message="API密钥无效",
                        response_time_ms=response_time,
                        error="Authentication failed: Invalid API key"
                    )
                elif response.status == 429:
                    return AITestResponse(
                        success=False,
                        message="请求过于频繁，请稍后再试",
                        response_time_ms=response_time,
                        error="Rate limit exceeded"
                    )
                else:
                    error_text = await response.text()
                    return AITestResponse(
                        success=False,
                        message=f"连接失败 (HTTP {response.status})",
                        response_time_ms=response_time,
                        error=error_text[:500]
                    )

    except aiohttp.ClientTimeout:
        return AITestResponse(
            success=False,
            message="连接超时",
            error="Request timeout after 30 seconds"
        )
    except aiohttp.ClientConnectorError as e:
        return AITestResponse(
            success=False,
            message="无法连接到API服务器",
            error=f"Connection error: {str(e)[:200]}"
        )
    except Exception as e:
        return AITestResponse(
            success=False,
            message="测试过程中发生错误",
            error=f"Unexpected error: {str(e)[:200]}"
        )
