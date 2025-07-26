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
from ..utils.response import success_response
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
    # 允许所有登录用户访问配置列表
    current_user = request.state.current_user
    
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
    # 允许所有登录用户访问
    current_user = request.state.current_user
    
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
    # 允许所有登录用户创建配置
    current_user = request.state.current_user
    
    # 检查key是否已存在
    existing = db.query(SystemConfig).filter(SystemConfig.key == config.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configuration with key '{config.key}' already exists"
        )
    
    db_config = SystemConfig(**config.model_dump())
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
    # 允许所有登录用户更新配置
    current_user = request.state.current_user
    
    db_config = db.query(SystemConfig).filter(SystemConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    update_data = config_update.model_dump(exclude_unset=True)
    
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
    # 允许所有登录用户删除配置
    current_user = request.state.current_user
    
    db_config = db.query(SystemConfig).filter(SystemConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    db.delete(db_config)
    db.commit()
    
    return success_response(message="Configuration deleted successfully")

@router.post("/ai/test", response_model=AITestResponse)
async def test_ai_connection(
    request: Request,
    test_request: AITestRequest
):
    """测试AI API连接"""
    # 不需要管理员权限，所有已登录用户都可以测试AI连接
    current_user = request.state.current_user
    
    try:
        # 统一使用OpenAI兼容接口
        base_url = test_request.api_url or "https://api.chatanywhere.tech/v1"
        # 确保URL以/v1结尾，并拼接完整的端点路径
        if not base_url.endswith('/'):
            base_url += '/'
        if base_url.endswith('/v1/'):
            api_url = base_url + 'chat/completions'
        elif base_url.endswith('/v1'):
            api_url = base_url + '/chat/completions'
        else:
            # 如果不是标准的/v1格式，假设用户提供了完整URL
            api_url = base_url
        
        headers = {
            "Authorization": f"Bearer {test_request.api_key}",
            "Content-Type": "application/json"
        }
        # 使用用户提供的模型，如果没有则默认使用gpt-3.5-turbo
        model = test_request.model or "gpt-3.5-turbo"
        data = {
            "model": model,
            "messages": [{"role": "user", "content": test_request.test_prompt}],
            "max_tokens": 50
        }
        
        # 发送测试请求
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=data, headers=headers)
            
        if response.status_code == 200:
            result = response.json()
            # 统一处理OpenAI兼容格式
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