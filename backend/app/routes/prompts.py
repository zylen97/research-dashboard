"""
优化后的Prompts管理API路由
使用ORM和CRUDBase替代原始SQL
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from app.models.database import get_db, Prompt
from app.utils.crud_base import CRUDBase

router = APIRouter()

# 数据模型（与原版保持一致）
class PromptBase(BaseModel):
    name: str
    content: str

class PromptCreate(PromptBase):
    pass

class PromptUpdate(PromptBase):
    pass

class PromptResponse(PromptBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 创建CRUD实例
prompt_crud = CRUDBase[Prompt, PromptCreate, PromptUpdate](Prompt)

@router.get("/", response_model=List[PromptResponse])
async def get_prompts(
    db: Session = Depends(get_db)
):
    """获取所有prompts列表"""
    try:
        # 使用ORM查询，按创建时间倒序
        prompts = db.query(Prompt).order_by(Prompt.created_at.desc()).all()
        return prompts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取prompts失败: {str(e)}")

@router.post("/", response_model=PromptResponse)
async def create_prompt(
    prompt: PromptCreate,
    db: Session = Depends(get_db)
):
    """创建新prompt"""
    try:
        # 检查名称是否已存在
        existing = db.query(Prompt).filter(Prompt.name == prompt.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Prompt名称已存在")
        
        # 使用CRUD基类创建
        new_prompt = prompt_crud.create(db, obj_in=prompt)
        return new_prompt
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建prompt失败: {str(e)}")

@router.put("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: int,
    prompt: PromptUpdate,
    db: Session = Depends(get_db)
):
    """更新prompt"""
    try:
        # 检查prompt是否存在
        db_prompt = prompt_crud.get(db, id=prompt_id)
        if not db_prompt:
            raise HTTPException(status_code=404, detail="Prompt不存在")
        
        # 检查新名称是否与其他prompt冲突
        if prompt.name != db_prompt.name:
            name_conflict = db.query(Prompt).filter(
                Prompt.name == prompt.name,
                Prompt.id != prompt_id
            ).first()
            if name_conflict:
                raise HTTPException(status_code=400, detail="Prompt名称已存在")
        
        # 使用CRUD基类更新
        updated_prompt = prompt_crud.update(db, db_obj=db_prompt, obj_in=prompt)
        return updated_prompt
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新prompt失败: {str(e)}")

@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    db: Session = Depends(get_db)
):
    """删除prompt"""
    try:
        # 检查prompt是否存在
        db_prompt = prompt_crud.get(db, id=prompt_id)
        if not db_prompt:
            raise HTTPException(status_code=404, detail="Prompt不存在")
        
        # 记录要删除的prompt名称（用于返回消息）
        prompt_name = db_prompt.name
        
        # 使用CRUD基类删除
        prompt_crud.remove(db, id=prompt_id)
        
        return {
            "success": True,
            "message": f"成功删除prompt: {prompt_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除prompt失败: {str(e)}")

@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int,
    db: Session = Depends(get_db)
):
    """获取单个prompt详情"""
    try:
        prompt = prompt_crud.get(db, id=prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt不存在")
        return prompt
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取prompt失败: {str(e)}")