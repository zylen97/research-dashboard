"""
Prompts管理API路由
简化版prompts CRUD操作，不涉及用户关联
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.models.database import get_db
from app.utils.auth import get_current_user
from app.models.schemas import User

router = APIRouter()

# 数据模型
class PromptBase(BaseModel):
    name: str
    content: str

class PromptCreate(PromptBase):
    pass

class PromptUpdate(PromptBase):
    pass

class Prompt(PromptBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[Prompt])
async def get_prompts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取所有prompts列表"""
    try:
        result = db.execute(
            text("SELECT id, name, content, created_at, updated_at FROM prompts ORDER BY created_at DESC")
        ).fetchall()
        
        prompts = []
        for row in result:
            prompts.append({
                "id": row.id,
                "name": row.name,
                "content": row.content,
                "created_at": row.created_at,
                "updated_at": row.updated_at
            })
        
        return prompts
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取prompts失败: {str(e)}")

@router.post("/", response_model=Prompt)
async def create_prompt(
    prompt: PromptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新prompt"""
    try:
        # 检查名称是否已存在
        existing = db.execute(
            text("SELECT id FROM prompts WHERE name = :name"),
            {"name": prompt.name}
        ).fetchone()
        
        if existing:
            raise HTTPException(status_code=400, detail="Prompt名称已存在")
        
        # 插入新prompt
        result = db.execute(
            text("""
                INSERT INTO prompts (name, content, created_at, updated_at) 
                VALUES (:name, :content, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id, name, content, created_at, updated_at
            """),
            {"name": prompt.name, "content": prompt.content}
        )
        
        # SQLite不支持RETURNING，需要单独查询
        db.commit()
        
        # 获取插入的记录
        new_prompt = db.execute(
            text("SELECT id, name, content, created_at, updated_at FROM prompts WHERE name = :name ORDER BY id DESC LIMIT 1"),
            {"name": prompt.name}
        ).fetchone()
        
        if not new_prompt:
            raise HTTPException(status_code=500, detail="创建prompt失败")
        
        return {
            "id": new_prompt.id,
            "name": new_prompt.name,
            "content": new_prompt.content,
            "created_at": new_prompt.created_at,
            "updated_at": new_prompt.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建prompt失败: {str(e)}")

@router.put("/{prompt_id}", response_model=Prompt)
async def update_prompt(
    prompt_id: int,
    prompt: PromptUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新prompt"""
    try:
        # 检查prompt是否存在
        existing = db.execute(
            text("SELECT id FROM prompts WHERE id = :id"),
            {"id": prompt_id}
        ).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Prompt不存在")
        
        # 检查新名称是否与其他prompt冲突
        name_conflict = db.execute(
            text("SELECT id FROM prompts WHERE name = :name AND id != :id"),
            {"name": prompt.name, "id": prompt_id}
        ).fetchone()
        
        if name_conflict:
            raise HTTPException(status_code=400, detail="Prompt名称已存在")
        
        # 更新prompt
        db.execute(
            text("""
                UPDATE prompts 
                SET name = :name, content = :content, updated_at = CURRENT_TIMESTAMP 
                WHERE id = :id
            """),
            {"name": prompt.name, "content": prompt.content, "id": prompt_id}
        )
        
        db.commit()
        
        # 获取更新后的记录
        updated_prompt = db.execute(
            text("SELECT id, name, content, created_at, updated_at FROM prompts WHERE id = :id"),
            {"id": prompt_id}
        ).fetchone()
        
        return {
            "id": updated_prompt.id,
            "name": updated_prompt.name,
            "content": updated_prompt.content,
            "created_at": updated_prompt.created_at,
            "updated_at": updated_prompt.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新prompt失败: {str(e)}")

@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除prompt"""
    try:
        # 检查prompt是否存在
        existing = db.execute(
            text("SELECT id, name FROM prompts WHERE id = :id"),
            {"id": prompt_id}
        ).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Prompt不存在")
        
        # 删除prompt
        db.execute(
            text("DELETE FROM prompts WHERE id = :id"),
            {"id": prompt_id}
        )
        
        db.commit()
        
        return {"success": True, "message": f"Prompt '{existing.name}' 已删除"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除prompt失败: {str(e)}")

@router.get("/{prompt_id}", response_model=Prompt)
async def get_prompt(
    prompt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取单个prompt详情"""
    try:
        prompt = db.execute(
            text("SELECT id, name, content, created_at, updated_at FROM prompts WHERE id = :id"),
            {"id": prompt_id}
        ).fetchone()
        
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt不存在")
        
        return {
            "id": prompt.id,
            "name": prompt.name,
            "content": prompt.content,
            "created_at": prompt.created_at,
            "updated_at": prompt.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取prompt失败: {str(e)}")