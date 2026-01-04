"""
研究方法管理路由（v4.7）
提供研究方法的CRUD操作
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.models.database import ResearchMethod as ResearchMethodModel, ResearchProject, get_db
from app.models.schemas import ResearchMethodCreate, ResearchMethodUpdate, ResearchMethod as ResearchMethodSchema

router = APIRouter()


@router.get("/", response_model=List[ResearchMethodSchema], summary="获取研究方法列表")
async def get_research_methods(
    search: Optional[str] = Query(None, description="搜索关键词（研究方法名称）"),
    db: Session = Depends(get_db)
):
    """
    获取所有研究方法列表

    - **search**: 可选，按研究方法名称搜索
    - 返回：研究方法列表，按使用次数倒序排列
    """
    query = db.query(ResearchMethodModel)

    # 搜索过滤
    if search:
        query = query.filter(ResearchMethodModel.name.contains(search))

    # 按使用次数倒序排列（最常用的在前）
    methods = query.order_by(ResearchMethodModel.usage_count.desc()).all()

    return methods


@router.post("/", response_model=ResearchMethodSchema, status_code=status.HTTP_201_CREATED, summary="创建研究方法")
async def create_research_method(
    method_data: ResearchMethodCreate,
    db: Session = Depends(get_db)
):
    """
    创建新研究方法

    - **name**: 研究方法名称（必填，唯一）
    - 如果已存在同名方法，则返回现有方法
    """
    # 检查研究方法名称是否已存在（去除前后空格）
    name = method_data.name.strip()
    existing_method = db.query(ResearchMethodModel).filter(ResearchMethodModel.name == name).first()
    if existing_method:
        # 如果已存在，直接返回现有方法
        return existing_method

    # 创建新研究方法
    new_method = ResearchMethodModel(
        name=name,
        usage_count=0
    )

    db.add(new_method)
    db.commit()
    db.refresh(new_method)

    return new_method


@router.put("/{method_id}", response_model=ResearchMethodSchema, summary="更新研究方法")
async def update_research_method(
    method_id: int,
    method_data: ResearchMethodUpdate,
    db: Session = Depends(get_db)
):
    """
    更新研究方法信息

    - **method_id**: 研究方法ID
    - **name**: 新的研究方法名称（可选）
    """
    # 查找研究方法
    method = db.query(ResearchMethodModel).filter(ResearchMethodModel.id == method_id).first()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"研究方法ID {method_id} 不存在"
        )

    # 如果要更新名称，检查新名称是否与其他研究方法重复
    if method_data.name is not None:
        new_name = method_data.name.strip()
        if new_name != method.name:
            existing_method = db.query(ResearchMethodModel).filter(ResearchMethodModel.name == new_name).first()
            if existing_method:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"研究方法名称 '{new_name}' 已存在"
                )
            method.name = new_name

    db.commit()
    db.refresh(method)

    return method


@router.delete("/{method_id}", status_code=status.HTTP_200_OK, summary="删除研究方法")
async def delete_research_method(
    method_id: int,
    db: Session = Depends(get_db)
):
    """
    删除研究方法

    - **method_id**: 研究方法ID
    - 注意：会检查是否有研究项目正在使用此方法
    """
    # 查找研究方法
    method = db.query(ResearchMethodModel).filter(ResearchMethodModel.id == method_id).first()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"研究方法ID {method_id} 不存在"
        )

    # 检查是否有研究项目正在使用此方法
    project_count = db.query(func.count(ResearchProject.id))\
        .filter(ResearchProject.research_method == method.name)\
        .scalar() or 0

    if project_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无法删除研究方法 '{method.name}'，有 {project_count} 个研究项目正在使用此方法。"
        )

    # 删除研究方法
    db.delete(method)
    db.commit()

    return {"message": f"研究方法 '{method.name}' 删除成功", "method_id": method_id}


@router.get("/{method_id}", response_model=ResearchMethodSchema, summary="获取单个研究方法详情")
async def get_research_method(
    method_id: int,
    db: Session = Depends(get_db)
):
    """
    获取单个研究方法的详细信息

    - **method_id**: 研究方法ID
    - 返回：研究方法信息
    """
    method = db.query(ResearchMethodModel).filter(ResearchMethodModel.id == method_id).first()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"研究方法ID {method_id} 不存在"
        )

    return method


@router.post("/get-or-create", response_model=ResearchMethodSchema, summary="获取或创建研究方法")
async def get_or_create_research_method(
    method_data: ResearchMethodCreate,
    db: Session = Depends(get_db)
):
    """
    获取或创建研究方法（用于下拉选择自动创建）

    - **name**: 研究方法名称
    - 如果存在则返回现有方法，不存在则创建新方法
    """
    name = method_data.name.strip()
    method = db.query(ResearchMethodModel).filter(ResearchMethodModel.name == name).first()

    if method:
        return method

    # 创建新研究方法
    new_method = ResearchMethodModel(
        name=name,
        usage_count=0
    )

    db.add(new_method)
    db.commit()
    db.refresh(new_method)

    return new_method
