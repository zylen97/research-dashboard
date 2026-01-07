"""
提示词管理路由（v4.8）
提供提示词的CRUD操作、复制、统计等功能
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
import json
import re

from app.models.database import Prompt as PromptModel, Tag, get_db
from app.models.schemas import (
    PromptCreate,
    PromptUpdate,
    Prompt as PromptSchema,
    PromptCopyRequest,
    PromptCopyResponse,
    PromptStats
)

router = APIRouter()


def extract_variables_from_content(content: str) -> List[str]:
    """从提示词内容中提取变量 {xxx}"""
    matches = re.findall(r'\{([a-zA-Z_][a-zA-Z0-9_]*)\}', content)
    return list(set(matches))


@router.get("/", response_model=List[PromptSchema], summary="获取提示词列表")
async def get_prompts(
    category: Optional[str] = Query(None, description="按分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（标题或内容）"),
    ordering: Optional[str] = Query(None, description="排序字段（如：-usage_count）"),
    limit: Optional[int] = Query(None, description="限制返回数量"),
    is_active: Optional[bool] = Query(True, description="只显示启用的提示词"),
    db: Session = Depends(get_db)
):
    """
    获取提示词列表

    - **category**: 可选，按分类筛选（reading/writing/polishing/reviewer/horizontal）
    - **search**: 可选，搜索关键词（标题或内容）
    - **ordering**: 可选，排序字段（如：-usage_count 表示倒序）
    - **limit**: 可选，限制返回数量
    - **is_active**: 可选，只显示启用的提示词（默认true）
    - 返回：提示词列表
    """
    query = db.query(PromptModel)

    # 分类过滤
    if category:
        query = query.filter(PromptModel.category == category)

    # 搜索过滤
    if search:
        query = query.filter(
            (PromptModel.title.contains(search)) |
            (PromptModel.content.contains(search)) |
            (PromptModel.description.contains(search))
        )

    # 启用状态过滤
    if is_active is not None:
        query = query.filter(PromptModel.is_active == is_active)

    # 排序
    if ordering:
        if ordering.startswith('-'):
            # 倒序
            field = ordering[1:]
            if hasattr(PromptModel, field):
                query = query.order_by(desc(getattr(PromptModel, field)))
        else:
            # 正序
            if hasattr(PromptModel, ordering):
                query = query.order_by(getattr(PromptModel, ordering))
    else:
        # 默认按使用次数倒序排列
        query = query.order_by(desc(PromptModel.usage_count))

    # 限制数量
    if limit:
        query = query.limit(limit)

    prompts = query.all()

    # 解析变量列表
    for prompt in prompts:
        if prompt.variables:
            try:
                prompt.variables = json.loads(prompt.variables)
            except:
                prompt.variables = []
        else:
            prompt.variables = []

    return prompts


@router.get("/stats/usage", response_model=PromptStats, summary="获取使用统计")
async def get_usage_stats(
    db: Session = Depends(get_db)
):
    """
    获取提示词使用统计

    - 返回：总数、按分类统计、最常用的提示词
    """
    # 总数
    total_count = db.query(func.count(PromptModel.id)).scalar() or 0

    # 按分类统计
    category_stats = db.query(
        PromptModel.category,
        func.count(PromptModel.id).label('count')
    ).group_by(PromptModel.category).all()

    by_category = {cat: count for cat, count in category_stats}

    # 最常用的提示词（前10）
    top_prompts_query = db.query(PromptModel)\
        .filter(PromptModel.usage_count > 0)\
        .order_by(desc(PromptModel.usage_count))\
        .limit(10)\
        .all()

    top_prompts = [
        {
            "id": p.id,
            "title": p.title,
            "category": p.category,
            "usage_count": p.usage_count
        }
        for p in top_prompts_query
    ]

    return PromptStats(
        total_count=total_count,
        by_category=by_category,
        top_prompts=top_prompts
    )


@router.get("/categories", response_model=Dict[str, Any], summary="获取分类统计")
async def get_categories(
    db: Session = Depends(get_db)
):
    """
    获取所有分类及统计信息

    - 返回：分类列表、各分类的数量
    """
    categories = [
        {"value": "reading", "label": "文章精读和迁移"},
        {"value": "writing", "label": "论文写作"},
        {"value": "polishing", "label": "论文润色"},
        {"value": "reviewer", "label": "审稿人"},
        {"value": "horizontal", "label": "横向课题"}
    ]

    # 统计各分类数量
    category_counts = {}
    for cat in categories:
        count = db.query(func.count(PromptModel.id))\
            .filter(PromptModel.category == cat["value"])\
            .scalar() or 0
        category_counts[cat["value"]] = count

    return {
        "categories": categories,
        "counts": category_counts
    }


@router.get("/{prompt_id}", response_model=PromptSchema, summary="获取单个提示词详情")
async def get_prompt(
    prompt_id: int,
    db: Session = Depends(get_db)
):
    """
    获取单个提示词的详细信息

    - **prompt_id**: 提示词ID
    - 返回：提示词信息
    """
    prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"提示词ID {prompt_id} 不存在"
        )

    # 解析变量列表
    if prompt.variables:
        try:
            prompt.variables = json.loads(prompt.variables)
        except:
            prompt.variables = []
    else:
        prompt.variables = []

    return prompt


@router.post("/", response_model=PromptSchema, status_code=status.HTTP_201_CREATED, summary="创建提示词")
async def create_prompt(
    prompt_data: PromptCreate,
    db: Session = Depends(get_db)
):
    """
    创建新提示词

    - **title**: 提示词标题（必填）
    - **content**: 提示词内容（必填）
    - **category**: 分类（必填）
    - **description**: 详细说明（可选）
    - **tag_ids**: 关联的标签ID列表（可选）
    """
    # 自动提取变量
    variables = extract_variables_from_content(prompt_data.content)

    # 创建新提示词
    new_prompt = PromptModel(
        title=prompt_data.title.strip(),
        content=prompt_data.content,
        category=prompt_data.category.value,
        description=prompt_data.description,
        variables=json.dumps(variables),
        usage_count=0,
        is_favorite=False,
        is_active=True
    )

    db.add(new_prompt)
    db.commit()
    db.refresh(new_prompt)

    # 处理标签关联
    if prompt_data.tag_ids:
        for tag_id in prompt_data.tag_ids:
            tag = db.query(Tag).filter(Tag.id == tag_id).first()
            if tag:
                new_prompt.tags.append(tag)

        db.commit()
        db.refresh(new_prompt)

    # 解析变量列表
    new_prompt.variables = variables

    return new_prompt


@router.put("/{prompt_id}", response_model=PromptSchema, summary="更新提示词")
async def update_prompt(
    prompt_id: int,
    prompt_data: PromptUpdate,
    db: Session = Depends(get_db)
):
    """
    更新提示词信息

    - **prompt_id**: 提示词ID
    - 其他字段都是可选的
    """
    # 查找提示词
    prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"提示词ID {prompt_id} 不存在"
        )

    # 更新字段
    if prompt_data.title is not None:
        prompt.title = prompt_data.title.strip()

    if prompt_data.content is not None:
        prompt.content = prompt_data.content
        # 重新提取变量
        variables = extract_variables_from_content(prompt_data.content)
        prompt.variables = json.dumps(variables)

    if prompt_data.category is not None:
        prompt.category = prompt_data.category.value

    if prompt_data.description is not None:
        prompt.description = prompt_data.description

    if prompt_data.is_favorite is not None:
        prompt.is_favorite = prompt_data.is_favorite

    if prompt_data.is_active is not None:
        prompt.is_active = prompt_data.is_active

    # 处理标签关联（完全替换）
    if prompt_data.tag_ids is not None:
        # 清除现有标签关联
        prompt.tags.clear()
        # 添加新标签
        for tag_id in prompt_data.tag_ids:
            tag = db.query(Tag).filter(Tag.id == tag_id).first()
            if tag:
                prompt.tags.append(tag)

    db.commit()
    db.refresh(prompt)

    # 解析变量列表
    if prompt.variables:
        try:
            prompt.variables = json.loads(prompt.variables)
        except:
            prompt.variables = []
    else:
        prompt.variables = []

    return prompt


@router.delete("/{prompt_id}", status_code=status.HTTP_200_OK, summary="删除提示词")
async def delete_prompt(
    prompt_id: int,
    db: Session = Depends(get_db)
):
    """
    删除提示词

    - **prompt_id**: 提示词ID
    """
    # 查找提示词
    prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"提示词ID {prompt_id} 不存在"
        )

    # 删除提示词
    db.delete(prompt)
    db.commit()

    return {"message": f"提示词 '{prompt.title}' 删除成功", "prompt_id": prompt_id}


@router.post("/{prompt_id}/copy", response_model=PromptCopyResponse, summary="复制提示词（支持变量替换）")
async def copy_prompt(
    prompt_id: int,
    request: PromptCopyRequest,
    db: Session = Depends(get_db)
):
    """
    复制提示词内容，支持变量替换

    - **prompt_id**: 提示词ID
    - **variables**: 变量值映射（可选）

    流程：
    1. 获取提示词内容
    2. 如果提供了变量值，替换 {xxx} 为实际值
    3. 记录使用次数（usage_count += 1）
    4. 返回替换后的完整文本
    """
    # 查找提示词
    prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"提示词ID {prompt_id} 不存在"
        )

    # 获取内容
    content = prompt.content
    variables_used = []

    # 变量替换
    if request.variables:
        for key, value in request.variables.items():
            if f"{{{key}}}" in content:
                content = content.replace(f"{{{key}}}", value)
                variables_used.append(key)

    # 记录使用
    prompt.usage_count += 1
    db.commit()

    return PromptCopyResponse(
        content=content,
        title=prompt.title,
        variables_used=variables_used
    )

