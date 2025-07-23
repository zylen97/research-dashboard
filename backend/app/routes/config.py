"""
系统配置管理路由
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from ..models import (
    get_db, SystemConfig, SystemConfigSchema, 
    SystemConfigCreate, SystemConfigUpdate,
    AIProviderConfig, AITestRequest, AITestResponse
)
from ..utils.encryption import encryption_util
import httpx

router = APIRouter()

# 管理员检查装饰器
def require_admin(request: Request):
    """确保只有管理员可以访问配置"""
    current_user = request.state.current_user
    # 这里简单地检查是否是特定用户，实际应该有角色管理
    if current_user.username not in ['zl', 'admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access system configuration"
        )
    return current_user

@router.get("/", response_model=List[SystemConfigSchema])
async def get_configs(
    request: Request,
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    """获取系统配置列表"""
    current_user = require_admin(request)
    
    query = db.query(SystemConfig)
    if category:
        query = query.filter(SystemConfig.category == category)
    if is_active is not None:
        query = query.filter(SystemConfig.is_active == is_active)
    
    configs = query.all()
    
    # 解密并屏蔽敏感信息
    for config in configs:
        if config.is_encrypted:
            # 解密值但只返回屏蔽的版本
            decrypted_value = encryption_util.decrypt(config.value)
            if 'key' in config.key.lower() or 'secret' in config.key.lower():
                config.value = encryption_util.mask_api_key(decrypted_value)
    
    return configs

@router.get("/{config_id}", response_model=SystemConfigSchema)
async def get_config(
    request: Request,
    config_id: int,
    db: Session = Depends(get_db)
):
    """获取单个配置"""
    current_user = require_admin(request)
    
    config = db.query(SystemConfig).filter(SystemConfig.id == config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    # 解密并屏蔽敏感信息
    if config.is_encrypted:
        decrypted_value = encryption_util.decrypt(config.value)
        if 'key' in config.key.lower() or 'secret' in config.key.lower():
            config.value = encryption_util.mask_api_key(decrypted_value)
    
    return config

@router.post("/", response_model=SystemConfigSchema)
async def create_config(
    request: Request,
    config: SystemConfigCreate,
    db: Session = Depends(get_db)
):
    """创建新配置"""
    current_user = require_admin(request)
    
    # 检查key是否已存在
    existing = db.query(SystemConfig).filter(SystemConfig.key == config.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configuration with key '{config.key}' already exists"
        )
    
    db_config = SystemConfig(**config.dict())
    db_config.created_by_id = current_user.id
    db_config.updated_by_id = current_user.id
    
    # 如果是敏感信息，加密存储
    if config.is_encrypted:
        db_config.value = encryption_util.encrypt(config.value)
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    # 返回时屏蔽敏感信息
    if db_config.is_encrypted:
        db_config.value = encryption_util.mask_api_key(config.value)
    
    return db_config

@router.put("/{config_id}", response_model=SystemConfigSchema)
async def update_config(
    request: Request,
    config_id: int,
    config_update: SystemConfigUpdate,
    db: Session = Depends(get_db)
):
    """更新配置"""
    current_user = require_admin(request)
    
    db_config = db.query(SystemConfig).filter(SystemConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    update_data = config_update.dict(exclude_unset=True)
    
    # 如果更新值且是加密的，需要加密新值
    if 'value' in update_data and db_config.is_encrypted:
        update_data['value'] = encryption_util.encrypt(update_data['value'])
    
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db_config.updated_by_id = current_user.id
    
    db.commit()
    db.refresh(db_config)
    
    # 返回时屏蔽敏感信息
    if db_config.is_encrypted:
        decrypted_value = encryption_util.decrypt(db_config.value)
        db_config.value = encryption_util.mask_api_key(decrypted_value)
    
    return db_config

@router.delete("/{config_id}")
async def delete_config(
    request: Request,
    config_id: int,
    db: Session = Depends(get_db)
):
    """删除配置"""
    current_user = require_admin(request)
    
    db_config = db.query(SystemConfig).filter(SystemConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    db.delete(db_config)
    db.commit()
    
    return {"message": "Configuration deleted successfully"}

@router.get("/ai/providers", response_model=List[dict])
async def get_ai_providers(
    request: Request,
    db: Session = Depends(get_db)
):
    """获取所有AI提供商配置"""
    # 普通用户也可以查看AI providers（只读），无需管理员权限
    current_user = request.state.current_user
    
    configs = db.query(SystemConfig).filter(
        SystemConfig.category == "ai_api",
        SystemConfig.is_active == True
    ).all()
    
    providers = []
    for config in configs:
        if config.key.startswith("ai_provider_"):
            # 解密并解析JSON
            decrypted_value = encryption_util.decrypt(config.value) if config.is_encrypted else config.value
            try:
                provider_config = json.loads(decrypted_value)
                # 屏蔽API密钥
                if 'api_key' in provider_config:
                    provider_config['api_key'] = encryption_util.mask_api_key(provider_config['api_key'])
                providers.append(provider_config)
            except json.JSONDecodeError:
                continue
    
    return providers

@router.post("/ai/providers", response_model=SystemConfigSchema)
async def create_ai_provider(
    request: Request,
    provider: AIProviderConfig,
    db: Session = Depends(get_db)
):
    """创建AI提供商配置"""
    current_user = require_admin(request)
    
    # 生成唯一key
    config_key = f"ai_provider_{provider.provider}"
    
    # 检查是否已存在
    existing = db.query(SystemConfig).filter(SystemConfig.key == config_key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AI provider '{provider.provider}' already exists"
        )
    
    # 创建配置
    config_value = json.dumps(provider.dict())
    db_config = SystemConfig(
        key=config_key,
        value=encryption_util.encrypt(config_value),
        category="ai_api",
        description=f"AI Provider configuration for {provider.provider}",
        is_encrypted=True,
        created_by_id=current_user.id,
        updated_by_id=current_user.id
    )
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    # 返回时屏蔽敏感信息
    db_config.value = encryption_util.mask_api_key(provider.api_key)
    
    return db_config

@router.post("/ai/test", response_model=AITestResponse)
async def test_ai_connection(
    request: Request,
    test_request: AITestRequest
):
    """测试AI API连接"""
    current_user = require_admin(request)
    
    try:
        # 根据不同的provider测试连接
        if test_request.provider == "openai":
            api_url = test_request.api_url or "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {test_request.api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": test_request.test_prompt}],
                "max_tokens": 50
            }
        elif test_request.provider == "anthropic":
            api_url = test_request.api_url or "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": test_request.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            data = {
                "model": "claude-3-haiku-20240307",
                "messages": [{"role": "user", "content": test_request.test_prompt}],
                "max_tokens": 50
            }
        else:
            # 通用OpenAI兼容接口
            api_url = test_request.api_url or "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {test_request.api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": test_request.test_prompt}],
                "max_tokens": 50
            }
        
        # 发送测试请求
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=data, headers=headers)
            
        if response.status_code == 200:
            result = response.json()
            if test_request.provider == "anthropic":
                ai_response = result.get("content", [{}])[0].get("text", "")
            else:
                ai_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            return AITestResponse(
                success=True,
                message="API connection successful",
                response=ai_response
            )
        else:
            return AITestResponse(
                success=False,
                message=f"API test failed: {response.status_code} - {response.text}",
                response=None
            )
            
    except Exception as e:
        return AITestResponse(
            success=False,
            message=f"Connection test failed: {str(e)}",
            response=None
        )