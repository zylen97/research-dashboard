from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..models import (
    get_db, Idea, IdeaSchema, IdeaCreate, IdeaUpdate,
    ResearchProject, Collaborator
)

router = APIRouter()

@router.get("/", response_model=List[IdeaSchema])
async def get_ideas(
    skip: int = 0, 
    limit: int = 100,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    source_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取idea列表"""
    query = db.query(Idea)
    
    if status_filter:
        query = query.filter(Idea.status == status_filter)
    if priority_filter:
        query = query.filter(Idea.priority == priority_filter)
    if source_filter:
        query = query.filter(Idea.source == source_filter)
    
    ideas = query.order_by(Idea.created_at.desc()).offset(skip).limit(limit).all()
    return ideas

@router.get("/{idea_id}", response_model=IdeaSchema)
async def get_idea(idea_id: int, db: Session = Depends(get_db)):
    """获取单个idea详情"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found"
        )
    return idea

@router.post("/", response_model=IdeaSchema)
async def create_idea(
    idea: IdeaCreate, 
    db: Session = Depends(get_db)
):
    """创建新idea"""
    db_idea = Idea(**idea.dict())
    db.add(db_idea)
    db.commit()
    db.refresh(db_idea)
    return db_idea

@router.put("/{idea_id}", response_model=IdeaSchema)
async def update_idea(
    idea_id: int,
    idea_update: IdeaUpdate,
    db: Session = Depends(get_db)
):
    """更新idea信息"""
    db_idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not db_idea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found"
        )
    
    update_data = idea_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_idea, field, value)
    
    db.commit()
    db.refresh(db_idea)
    return db_idea

@router.delete("/{idea_id}")
async def delete_idea(idea_id: int, db: Session = Depends(get_db)):
    """删除idea"""
    db_idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not db_idea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found"
        )
    
    db.delete(db_idea)
    db.commit()
    return {"message": "Idea deleted successfully"}

@router.put("/{idea_id}/priority")
async def update_idea_priority(
    idea_id: int,
    priority: str,
    db: Session = Depends(get_db)
):
    """更新idea优先级"""
    if priority not in ["low", "medium", "high"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priority must be one of: low, medium, high"
        )
    
    db_idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not db_idea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found"
        )
    
    db_idea.priority = priority
    db.commit()
    return {"message": "Priority updated successfully", "priority": priority}

@router.put("/{idea_id}/status")
async def update_idea_status(
    idea_id: int,
    status_value: str,
    db: Session = Depends(get_db)
):
    """更新idea状态"""
    valid_statuses = ["pool", "in_development", "converted_to_project"]
    if status_value not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )
    
    db_idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not db_idea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found"
        )
    
    db_idea.status = status_value
    db.commit()
    return {"message": "Status updated successfully", "status": status_value}

@router.post("/{idea_id}/convert-to-project")
async def convert_idea_to_project(
    idea_id: int,
    collaborator_ids: List[int] = [],
    db: Session = Depends(get_db)
):
    """将idea转换为研究项目"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found"
        )
    
    if idea.status == "converted_to_project":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idea has already been converted to a project"
        )
    
    # Verify collaborators exist
    if collaborator_ids:
        collaborators = db.query(Collaborator).filter(
            Collaborator.id.in_(collaborator_ids)
        ).all()
        if len(collaborators) != len(collaborator_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more collaborators not found"
            )
    else:
        collaborators = []
    
    # Create research project
    project_data = {
        'title': idea.title,
        'idea_description': idea.description,
        'status': 'active'
    }
    
    db_project = ResearchProject(**project_data)
    db.add(db_project)
    db.flush()  # Get the project ID
    
    # Add collaborators
    db_project.collaborators = collaborators
    
    # Update idea status
    idea.status = "converted_to_project"
    
    db.commit()
    db.refresh(db_project)
    
    return {
        "message": "Idea converted to research project successfully",
        "project_id": db_project.id,
        "project": db_project
    }

@router.get("/stats/summary")
async def get_ideas_summary(db: Session = Depends(get_db)):
    """获取idea统计摘要"""
    from sqlalchemy import func
    
    # Count by status
    status_counts = db.query(
        Idea.status,
        func.count(Idea.id).label('count')
    ).group_by(Idea.status).all()
    
    # Count by priority
    priority_counts = db.query(
        Idea.priority,
        func.count(Idea.id).label('count')
    ).group_by(Idea.priority).all()
    
    # Count by source
    source_counts = db.query(
        Idea.source,
        func.count(Idea.id).label('count')
    ).group_by(Idea.source).all()
    
    total_ideas = db.query(func.count(Idea.id)).scalar()
    
    return {
        "total_ideas": total_ideas,
        "status_breakdown": {status: count for status, count in status_counts},
        "priority_breakdown": {priority: count for priority, count in priority_counts},
        "source_breakdown": {source: count for source, count in source_counts}
    }

@router.get("/search")
async def search_ideas(
    q: str,
    db: Session = Depends(get_db)
):
    """搜索ideas"""
    ideas = db.query(Idea).filter(
        Idea.title.contains(q) | 
        Idea.description.contains(q) |
        Idea.tags.contains(q)
    ).all()
    
    return ideas