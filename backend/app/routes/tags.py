"""
期刊标签管理路由
提供标签的CRUD操作和关联期刊查询
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.models.database import Tag as TagModel, Journal as JournalModel, journal_tags, get_db
from app.models.schemas import TagCreate, TagUpdate, Tag as TagSchema, Journal as JournalSchema

router = APIRouter()


@router.get("/", response_model=List[TagSchema], summary="获取标签列表")
async def get_tags(
    search: Optional[str] = Query(None, description="搜索关键词（标签名称）"),
    db: Session = Depends(get_db)
):
    """
    获取所有标签列表

    - **search**: 可选，按标签名称搜索
    - 返回：标签列表，包含每个标签关联的期刊数量
    """
    query = db.query(TagModel)

    # 搜索过滤
    if search:
        query = query.filter(TagModel.name.contains(search))

    # 按创建时间倒序排列
    tags = query.order_by(TagModel.created_at.desc()).all()

    # 为每个标签计算关联的期刊数量（动态添加属性）
    for tag in tags:
        tag.journal_count = db.query(func.count(journal_tags.c.journal_id))\
            .filter(journal_tags.c.tag_id == tag.id)\
            .scalar() or 0

    return tags


@router.post("/", response_model=TagSchema, status_code=status.HTTP_201_CREATED, summary="创建标签")
async def create_tag(
    tag_data: TagCreate,
    db: Session = Depends(get_db)
):
    """
    创建新标签

    - **name**: 标签名称（必填，唯一）
    - **description**: 标签描述（可选）
    - **color**: 前端显示颜色（可选，默认blue）
    """
    # 检查标签名称是否已存在
    existing_tag = db.query(TagModel).filter(TagModel.name == tag_data.name.strip()).first()
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"标签名称 '{tag_data.name}' 已存在"
        )

    # 创建新标签
    new_tag = TagModel(
        name=tag_data.name.strip(),
        description=tag_data.description,
        color=tag_data.color
    )

    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)

    # 添加journal_count属性
    new_tag.journal_count = 0  # 新创建的标签没有关联期刊

    return new_tag


@router.put("/{tag_id}", response_model=TagSchema, summary="更新标签")
async def update_tag(
    tag_id: int,
    tag_data: TagUpdate,
    db: Session = Depends(get_db)
):
    """
    更新标签信息

    - **tag_id**: 标签ID
    - **name**: 新的标签名称（可选）
    - **description**: 新的描述（可选）
    - **color**: 新的颜色（可选）
    """
    # 查找标签
    tag = db.query(TagModel).filter(TagModel.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"标签ID {tag_id} 不存在"
        )

    # 如果要更新名称，检查新名称是否与其他标签重复
    if tag_data.name is not None:
        new_name = tag_data.name.strip()
        if new_name != tag.name:
            existing_tag = db.query(TagModel).filter(TagModel.name == new_name).first()
            if existing_tag:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"标签名称 '{new_name}' 已存在"
                )
            tag.name = new_name

    # 更新其他字段
    if tag_data.description is not None:
        tag.description = tag_data.description

    if tag_data.color is not None:
        tag.color = tag_data.color

    db.commit()
    db.refresh(tag)

    # 添加journal_count属性
    tag.journal_count = db.query(func.count(journal_tags.c.journal_id))\
        .filter(journal_tags.c.tag_id == tag.id)\
        .scalar() or 0

    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_200_OK, summary="删除标签")
async def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db)
):
    """
    删除标签

    - **tag_id**: 标签ID
    - 注意：会检查是否有期刊正在使用此标签
    """
    # 查找标签
    tag = db.query(TagModel).filter(TagModel.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"标签ID {tag_id} 不存在"
        )

    # 检查是否有期刊正在使用此标签
    journal_count = db.query(func.count(journal_tags.c.journal_id))\
        .filter(journal_tags.c.tag_id == tag_id)\
        .scalar() or 0

    if journal_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无法删除标签 '{tag.name}'，有 {journal_count} 个期刊正在使用此标签。请先解除关联。"
        )

    # 删除标签
    db.delete(tag)
    db.commit()

    return {"message": f"标签 '{tag.name}' 删除成功", "tag_id": tag_id}


@router.get("/{tag_id}/journals", response_model=List[JournalSchema], summary="获取标签的关联期刊")
async def get_tag_journals(
    tag_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定标签关联的所有期刊

    - **tag_id**: 标签ID
    - 返回：期刊列表（包含完整的期刊信息）
    """
    # 查找标签
    tag = db.query(TagModel).filter(TagModel.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"标签ID {tag_id} 不存在"
        )

    # 查询关联的期刊（通过journal_tags表）
    journals = db.query(JournalModel)\
        .join(journal_tags, JournalModel.id == journal_tags.c.journal_id)\
        .filter(journal_tags.c.tag_id == tag_id)\
        .order_by(JournalModel.name)\
        .all()

    # 为每个期刊添加tags列表和统计信息
    result = []
    for journal in journals:
        journal_dict = {
            "id": journal.id,
            "name": journal.name,
            "notes": journal.notes,
            "created_at": journal.created_at,
            "updated_at": journal.updated_at,
            "tags": [{"id": t.id, "name": t.name, "description": t.description,
                     "color": t.color, "created_at": t.created_at,
                     "updated_at": t.updated_at, "journal_count": 0}
                    for t in journal.tags],
            "reference_count": 0,  # 这里简化处理，实际需要从ideas表统计
            "target_count": 0
        }
        result.append(journal_dict)

    return result


@router.get("/{tag_id}", response_model=TagSchema, summary="获取单个标签详情")
async def get_tag(
    tag_id: int,
    db: Session = Depends(get_db)
):
    """
    获取单个标签的详细信息

    - **tag_id**: 标签ID
    - 返回：标签信息，包含关联的期刊数量
    """
    tag = db.query(TagModel).filter(TagModel.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"标签ID {tag_id} 不存在"
        )

    # 添加journal_count属性
    tag.journal_count = db.query(func.count(journal_tags.c.journal_id))\
        .filter(journal_tags.c.tag_id == tag.id)\
        .scalar() or 0

    return tag
