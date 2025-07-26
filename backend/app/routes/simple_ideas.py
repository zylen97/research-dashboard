"""
简化版Ideas管理路由
独立的数据表，不与其他表关联
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from ..models import get_db, ResearchProject
from ..services.audit import log_audit_event

router = APIRouter()

# 数据模型
class SimpleIdeaBase(BaseModel):
    research_question: str = Field(..., description="研究问题")
    research_method: str = Field(..., description="研究方法")
    source_journal: str = Field(..., description="来源期刊")
    source_literature: str = Field(..., description="来源文献")
    responsible_person: str = Field(..., description="负责人")
    maturity: str = Field(default="immature", description="成熟度：mature/immature")
    description: Optional[str] = Field(None, description="额外描述")

class SimpleIdeaCreate(SimpleIdeaBase):
    pass

class SimpleIdeaUpdate(BaseModel):
    research_question: Optional[str] = None
    research_method: Optional[str] = None
    source_journal: Optional[str] = None
    source_literature: Optional[str] = None
    responsible_person: Optional[str] = None
    maturity: Optional[str] = None
    description: Optional[str] = None

class SimpleIdea(SimpleIdeaBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[SimpleIdea])
async def get_ideas(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    maturity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取Ideas列表"""
    query = "SELECT * FROM ideas"
    params = {}
    
    if maturity:
        query += " WHERE maturity = :maturity"
        params["maturity"] = maturity
    
    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    params["limit"] = limit
    params["skip"] = skip
    
    result = db.execute(text(query), params)
    ideas = []
    
    for row in result:
        ideas.append({
            "id": row.id,
            "research_question": row.research_question,
            "research_method": row.research_method,
            "source_journal": row.source_journal,
            "source_literature": row.source_literature,
            "responsible_person": row.responsible_person,
            "maturity": row.maturity,
            "description": row.description,
            "created_at": row.created_at,
            "updated_at": row.updated_at
        })
    
    return ideas

@router.get("/{idea_id}", response_model=SimpleIdea)
async def get_idea(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """获取单个Idea详情"""
    result = db.execute(
        text("SELECT * FROM ideas WHERE id = :id"),
        {"id": idea_id}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    return {
        "id": result.id,
        "research_question": result.research_question,
        "research_method": result.research_method,
        "source_journal": result.source_journal,
        "source_literature": result.source_literature,
        "responsible_person": result.responsible_person,
        "maturity": result.maturity,
        "description": result.description,
        "created_at": result.created_at,
        "updated_at": result.updated_at
    }

@router.post("/", response_model=SimpleIdea)
async def create_idea(
    idea: SimpleIdeaCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """创建新的Idea"""
    # 验证maturity值
    if idea.maturity not in ['mature', 'immature']:
        raise HTTPException(status_code=400, detail="Maturity must be 'mature' or 'immature'")
    
    # 插入数据
    query = text("""
        INSERT INTO ideas 
        (research_question, research_method, source_journal, 
         source_literature, responsible_person, maturity, description)
        VALUES 
        (:research_question, :research_method, :source_journal,
         :source_literature, :responsible_person, :maturity, :description)
    """)
    
    result = db.execute(query, {
        "research_question": idea.research_question,
        "research_method": idea.research_method,
        "source_journal": idea.source_journal,
        "source_literature": idea.source_literature,
        "responsible_person": idea.responsible_person,
        "maturity": idea.maturity,
        "description": idea.description
    })
    
    db.commit()
    
    # 获取新创建的记录
    new_id = result.lastrowid
    return await get_idea(new_id, request, db)

@router.put("/{idea_id}", response_model=SimpleIdea)
async def update_idea(
    idea_id: int,
    idea_update: SimpleIdeaUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """更新Idea"""
    # 检查是否存在
    existing = db.execute(
        text("SELECT id FROM ideas WHERE id = :id"),
        {"id": idea_id}
    ).fetchone()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # 构建更新语句
    update_fields = []
    params = {"id": idea_id}
    
    for field, value in idea_update.dict(exclude_unset=True).items():
        if value is not None:
            if field == "maturity" and value not in ['mature', 'immature']:
                raise HTTPException(status_code=400, detail="Maturity must be 'mature' or 'immature'")
            update_fields.append(f"{field} = :{field}")
            params[field] = value
    
    if update_fields:
        query = text(f"""
            UPDATE ideas 
            SET {', '.join(update_fields)}
            WHERE id = :id
        """)
        db.execute(query, params)
        db.commit()
    
    return await get_idea(idea_id, request, db)

@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """删除Idea"""
    result = db.execute(
        text("DELETE FROM ideas WHERE id = :id"),
        {"id": idea_id}
    )
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    db.commit()
    return {"message": "Idea deleted successfully"}

@router.post("/{idea_id}/convert-to-project")
async def convert_idea_to_project(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """将Idea转化为研究项目"""
    # 获取idea详情
    idea_result = db.execute(
        text("SELECT * FROM ideas WHERE id = :id"),
        {"id": idea_id}
    ).fetchone()
    
    if not idea_result:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # 合并来源字段
    source_combined = f"期刊: {idea_result.source_journal}"
    if idea_result.source_literature:
        source_combined += f" | 文献: {idea_result.source_literature}"
    
    # 创建新的研究项目
    new_project = ResearchProject(
        title=idea_result.research_question,  # 研究问题作为项目名称
        idea_description=idea_result.description or idea_result.research_question,  # 如果没有描述，使用研究问题
        research_method=idea_result.research_method,
        source=source_combined,
        status="active",
        progress=0.0
    )
    
    db.add(new_project)
    db.flush()  # 获取新项目的ID
    
    # 记录审计日志
    log_audit_event(
        db=db,
        table_name="research_projects",
        record_id=new_project.id,
        action="CREATE",
        user_id=getattr(request.state, "user_id", None),
        new_values={
            "title": new_project.title,
            "idea_description": new_project.idea_description,
            "research_method": new_project.research_method,
            "source": new_project.source,
            "converted_from_idea_id": idea_id
        },
        request=request
    )
    
    # 删除原有的idea
    db.execute(
        text("DELETE FROM ideas WHERE id = :id"),
        {"id": idea_id}
    )
    
    # 记录idea删除的审计日志
    log_audit_event(
        db=db,
        table_name="ideas",
        record_id=idea_id,
        action="DELETE",
        user_id=getattr(request.state, "user_id", None),
        old_values={
            "reason": "Converted to research project",
            "project_id": new_project.id
        },
        request=request
    )
    
    db.commit()
    
    return {
        "message": "Idea successfully converted to research project",
        "project_id": new_project.id,
        "project_title": new_project.title
    }