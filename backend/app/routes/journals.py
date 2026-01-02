"""
期刊库管理路由
提供期刊CRUD、统计查询、引用追踪、批量导入等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ..models import (
    get_db, Journal, Idea, ResearchProject, Tag, Paper, journal_tags,
    JournalCreate, JournalUpdate, JournalSchema
)
from ..models.schemas import BatchDeleteRequest
from ..services.audit import AuditService
from ..services.excel_import_service import ExcelImportService
from ..services.ai_analysis_service import AIAnalysisService
from ..utils.response import success_response, paginated_response
from ..utils.crud_base import CRUDBase
from ..utils.string_helpers import to_title_case

logger = logging.getLogger(__name__)

router = APIRouter()

# 创建CRUD实例
journal_crud = CRUDBase[Journal, JournalCreate, JournalUpdate](Journal)


# ===== 期刊统计辅助函数 =====

def calculate_journal_stats(db: Session, journal_name: str) -> Dict[str, int]:
    """
    计算期刊的引用统计（单个期刊，用于详情页）

    Args:
        db: 数据库会话
        journal_name: 期刊名称

    Returns:
        统计字典包含: reference_count, target_count, total_count
    """
    # 统计作为参考期刊的次数（大小写不敏感）
    reference_count = (
        db.query(Idea).filter(func.lower(Idea.reference_journal) == func.lower(journal_name)).count() +
        db.query(ResearchProject).filter(func.lower(ResearchProject.reference_journal) == func.lower(journal_name)).count()
    )

    # 统计作为投稿期刊的次数（大小写不敏感）
    target_count = (
        db.query(Idea).filter(func.lower(Idea.target_journal) == func.lower(journal_name)).count() +
        db.query(ResearchProject).filter(func.lower(ResearchProject.target_journal) == func.lower(journal_name)).count()
    )

    return {
        "reference_count": reference_count,
        "target_count": target_count,
        "total_count": reference_count + target_count
    }


def batch_calculate_journal_stats(db: Session, journal_names: List[str]) -> Dict[str, Dict[str, int]]:
    """
    批量计算多个期刊的引用统计（避免N+1查询）

    新计数设计（v4.1）：
    - 参考：Idea + ResearchProject 中 reference_journal 的合计
    - idea中：Idea 中 target_journal 的合计
    - 撰写中：ResearchProject 状态为"writing"且 target_journal 的合计
    - 投稿中：ResearchProject 状态为"submitting"且 target_journal 的合计
    - 已发表：ResearchProject 状态为"published"且 target_journal 的合计
    - 论文：Papers 中该期刊的论文总数

    Args:
        db: 数据库会话
        journal_names: 期刊名称列表

    Returns:
        字典，key为期刊名称，value为统计字典
    """
    if not journal_names:
        return {}

    # ========== 参考期刊统计 ==========
    # Idea中的参考期刊
    idea_ref_counts = (
        db.query(Idea.reference_journal, func.count(Idea.id))
        .filter(Idea.reference_journal.in_(journal_names))
        .group_by(Idea.reference_journal)
        .all()
    )

    # ResearchProject中的参考期刊
    project_ref_counts = (
        db.query(ResearchProject.reference_journal, func.count(ResearchProject.id))
        .filter(ResearchProject.reference_journal.in_(journal_names))
        .group_by(ResearchProject.reference_journal)
        .all()
    )

    # ========== 目标期刊统计（按状态细分） ==========
    # Idea中的目标期刊（idea中）
    idea_target_counts = (
        db.query(Idea.target_journal, func.count(Idea.id))
        .filter(Idea.target_journal.in_(journal_names))
        .group_by(Idea.target_journal)
        .all()
    )

    # ResearchProject中的目标期刊 - 撰写中
    writing_target_counts = (
        db.query(ResearchProject.target_journal, func.count(ResearchProject.id))
        .filter(
            ResearchProject.target_journal.in_(journal_names),
            ResearchProject.status == 'writing'
        )
        .group_by(ResearchProject.target_journal)
        .all()
    )

    # ResearchProject中的目标期刊 - 投稿中
    submitting_target_counts = (
        db.query(ResearchProject.target_journal, func.count(ResearchProject.id))
        .filter(
            ResearchProject.target_journal.in_(journal_names),
            ResearchProject.status == 'submitting'
        )
        .group_by(ResearchProject.target_journal)
        .all()
    )

    # ResearchProject中的目标期刊 - 已发表
    published_target_counts = (
        db.query(ResearchProject.target_journal, func.count(ResearchProject.id))
        .filter(
            ResearchProject.target_journal.in_(journal_names),
            ResearchProject.status == 'published'
        )
        .group_by(ResearchProject.target_journal)
        .all()
    )

    # ========== 论文统计 ==========
    # 获取期刊ID到名称的映射
    journal_id_to_name = {
        j.id: j.name
        for j in db.query(Journal).filter(Journal.name.in_(journal_names)).all()
    }

    paper_counts = (
        db.query(Paper.journal_id, func.count(Paper.id))
        .filter(Paper.journal_id.in_(list(journal_id_to_name.keys())))
        .group_by(Paper.journal_id)
        .all()
    )

    # ========== 转换为字典方便查找 ==========
    # 参考计数
    ref_counts = {}
    for name, count in idea_ref_counts:
        ref_counts[name] = ref_counts.get(name, 0) + count
    for name, count in project_ref_counts:
        ref_counts[name] = ref_counts.get(name, 0) + count

    # idea中计数
    idea_target_dict = {name: count for name, count in idea_target_counts}

    # 各状态项目计数
    writing_dict = {name: count for name, count in writing_target_counts}
    submitting_dict = {name: count for name, count in submitting_target_counts}
    published_dict = {name: count for name, count in published_target_counts}

    # 论文计数（按journal_id转换为journal_name）
    paper_dict = {}
    for journal_id, count in paper_counts:
        name = journal_id_to_name.get(journal_id)
        if name:
            paper_dict[name] = count

    # ========== 组装结果 ==========
    result = {}
    for name in journal_names:
        result[name] = {
            "reference_count": ref_counts.get(name, 0),
            "idea_target_count": idea_target_dict.get(name, 0),
            "writing_count": writing_dict.get(name, 0),
            "submitting_count": submitting_dict.get(name, 0),
            "published_count": published_dict.get(name, 0),
            "paper_count": paper_dict.get(name, 0),
        }

    return result


def get_journal_references(db: Session, journal_name: str, ref_type: Optional[str] = None) -> Dict[str, Any]:
    """
    获取引用该期刊的所有Ideas和Projects

    Args:
        db: 数据库会话
        journal_name: 期刊名称
        ref_type: 引用类型筛选 ('reference', 'target', None表示全部)

    Returns:
        包含ideas和projects列表的字典
    """
    result = {
        "reference_ideas": [],
        "reference_projects": [],
        "target_ideas": [],
        "target_projects": []
    }

    # 查询作为参考期刊的Ideas
    if ref_type in [None, 'reference']:
        reference_ideas = db.query(Idea).filter(
            Idea.reference_journal == journal_name
        ).all()
        result["reference_ideas"] = [
            {
                "id": idea.id,
                "project_name": idea.project_name,
                "responsible_person": idea.responsible_person.name if idea.responsible_person else None,
                "maturity": idea.maturity,
                "created_at": idea.created_at.isoformat() if idea.created_at else None
            }
            for idea in reference_ideas
        ]

        # 查询作为参考期刊的Projects
        reference_projects = db.query(ResearchProject).filter(
            ResearchProject.reference_journal == journal_name
        ).all()
        result["reference_projects"] = [
            {
                "id": project.id,
                "title": project.title,
                "status": project.status,
                "created_at": project.created_at.isoformat() if project.created_at else None
            }
            for project in reference_projects
        ]

    # 查询作为投稿期刊的Ideas
    if ref_type in [None, 'target']:
        target_ideas = db.query(Idea).filter(
            Idea.target_journal == journal_name
        ).all()
        result["target_ideas"] = [
            {
                "id": idea.id,
                "project_name": idea.project_name,
                "responsible_person": idea.responsible_person.name if idea.responsible_person else None,
                "maturity": idea.maturity,
                "created_at": idea.created_at.isoformat() if idea.created_at else None
            }
            for idea in target_ideas
        ]

        # 查询作为投稿期刊的Projects
        target_projects = db.query(ResearchProject).filter(
            ResearchProject.target_journal == journal_name
        ).all()
        result["target_projects"] = [
            {
                "id": project.id,
                "title": project.title,
                "status": project.status,
                "created_at": project.created_at.isoformat() if project.created_at else None
            }
            for project in target_projects
        ]

    return result


# ===== 基础CRUD路由 =====

@router.get("/", response_model=List[JournalSchema])
async def get_journals(
    request: Request,
    skip: int = 0,
    limit: int = 1000,
    tag_ids: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取期刊列表

    支持筛选参数：
    - tag_ids: 标签ID列表，逗号分隔（如 "1,2,3"）
    - search: 搜索关键词（匹配期刊名称）
    """
    try:
        # 使用joinedload预加载tags关系，确保序列化时包含标签数据
        query = db.query(Journal).options(joinedload(Journal.tags))

        # 标签筛选（支持多个标签）
        if tag_ids:
            tag_id_list = [int(tid.strip()) for tid in tag_ids.split(',') if tid.strip()]
            if tag_id_list:
                # JOIN journal_tags表来筛选包含指定标签的期刊
                query = query.join(journal_tags, Journal.id == journal_tags.c.journal_id)\
                    .filter(journal_tags.c.tag_id.in_(tag_id_list))\
                    .distinct()

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(Journal.name.like(search_pattern))

        # 按名称排序
        query = query.order_by(Journal.name)

        journals = query.offset(skip).limit(limit).all()

        # 批量计算统计信息（避免N+1查询）
        journal_names = [j.name for j in journals]
        all_stats = batch_calculate_journal_stats(db, journal_names)

        for journal in journals:
            stats = all_stats.get(journal.name, {
                "reference_count": 0,
                "idea_target_count": 0,
                "writing_count": 0,
                "submitting_count": 0,
                "published_count": 0,
                "paper_count": 0,
            })
            journal.reference_count = stats["reference_count"]
            journal.idea_target_count = stats["idea_target_count"]
            journal.writing_count = stats["writing_count"]
            journal.submitting_count = stats["submitting_count"]
            journal.published_count = stats["published_count"]
            journal.paper_count = stats["paper_count"]

        return journals

    except Exception as e:
        logger.error(f"获取期刊列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取期刊列表失败: {str(e)}")


@router.post("/", response_model=JournalSchema, status_code=status.HTTP_201_CREATED)
async def create_journal(
    journal: JournalCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """创建新期刊"""
    try:
        # 格式化期刊名称为Title Case
        formatted_name = to_title_case(journal.name.strip())

        # 检查期刊名称是否已存在
        existing = db.query(Journal).filter(Journal.name == formatted_name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"期刊 '{formatted_name}' 已存在"
            )

        # 验证tag_ids（完全可选）
        tag_ids = journal.tag_ids if hasattr(journal, 'tag_ids') else []

        if tag_ids:
            # 只有在提供了标签时才验证其有效性
            existing_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
            if len(existing_tags) != len(tag_ids):
                existing_tag_ids = {tag.id for tag in existing_tags}
                invalid_ids = set(tag_ids) - existing_tag_ids
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"标签ID不存在: {invalid_ids}"
                )
        else:
            existing_tags = []

        # 创建期刊（不包含tag_ids字段，使用格式化后的名称）
        journal_data = journal.model_dump(exclude={'tag_ids'})
        journal_data['name'] = formatted_name  # 使用格式化后的名称
        new_journal = Journal(**journal_data)
        db.add(new_journal)
        db.flush()  # 获取新期刊的ID

        # 创建期刊-标签关联
        if tag_ids:
            for tag_id in tag_ids:
                db.execute(
                    journal_tags.insert().values(journal_id=new_journal.id, tag_id=tag_id)
                )

        db.commit()
        db.refresh(new_journal)

        # 记录审计日志
        try:
            AuditService.log_create(
                db,
                table_name="journals",
                record_id=new_journal.id,
                new_values=journal.model_dump()
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

        # 添加统计信息
        stats = calculate_journal_stats(db, new_journal.name)
        new_journal.reference_count = stats["reference_count"]
        new_journal.target_count = stats["target_count"]

        return new_journal

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建期刊失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建期刊失败: {str(e)}")


@router.get("/{journal_id}")
async def get_journal(
    journal_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """获取单个期刊详情（含统计信息和论文统计）"""
    try:
        # 使用joinedload预加载tags关系
        journal = db.query(Journal).options(joinedload(Journal.tags)).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 添加引用统计信息
        stats = calculate_journal_stats(db, journal.name)
        journal.reference_count = stats["reference_count"]
        journal.target_count = stats["target_count"]
        journal.total_count = stats["total_count"]

        # 添加论文统计信息
        paper_stats = {
            "total_papers": db.query(Paper).filter(Paper.journal_id == journal_id).count(),
            "pending_papers": db.query(Paper).filter(
                Paper.journal_id == journal_id,
                Paper.status == "pending"
            ).count(),
            "analyzed_papers": db.query(Paper).filter(
                Paper.journal_id == journal_id,
                Paper.status == "analyzed"
            ).count(),
            "converted_papers": db.query(Paper).filter(
                Paper.journal_id == journal_id,
                Paper.status == "converted"
            ).count(),
        }

        return {
            **JournalSchema.model_validate(journal).model_dump(),
            "paper_stats": paper_stats
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取期刊详情失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取期刊详情失败: {str(e)}")


@router.put("/{journal_id}", response_model=JournalSchema)
async def update_journal(
    journal_id: int,
    journal_update: JournalUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """更新期刊信息"""
    try:
        # 检查期刊是否存在（预加载tags）
        db_journal = db.query(Journal).options(joinedload(Journal.tags)).filter(Journal.id == journal_id).first()
        if not db_journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 如果要更新名称，格式化并检查新名称是否已被使用
        if journal_update.name and journal_update.name != db_journal.name:
            formatted_name = to_title_case(journal_update.name.strip())
            existing = db.query(Journal).filter(Journal.name == formatted_name).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"期刊名称 '{formatted_name}' 已被使用"
                )

        # 处理tag_ids更新（完全替换模式，标签完全可选）
        tag_ids = journal_update.tag_ids if hasattr(journal_update, 'tag_ids') and journal_update.tag_ids is not None else None
        if tag_ids is not None:
            # 验证所有标签是否存在
            if tag_ids:  # 如果提供了非空列表
                existing_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
                if len(existing_tags) != len(tag_ids):
                    existing_tag_ids = {tag.id for tag in existing_tags}
                    invalid_ids = set(tag_ids) - existing_tag_ids
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"标签ID不存在: {invalid_ids}"
                    )

            # 删除旧的标签关联
            db.execute(
                journal_tags.delete().where(journal_tags.c.journal_id == journal_id)
            )

            # 创建新的标签关联
            for tag_id in tag_ids:
                db.execute(
                    journal_tags.insert().values(journal_id=journal_id, tag_id=tag_id)
                )

        # 保存旧值用于审计
        old_values = {
            "name": db_journal.name,
            "notes": db_journal.notes
        }

        # 更新期刊基本信息（排除tag_ids）
        update_data = journal_update.model_dump(exclude_unset=True, exclude={'tag_ids'})
        for field, value in update_data.items():
            # 如果是name字段，使用格式化后的名称
            if field == 'name':
                setattr(db_journal, field, to_title_case(str(value).strip()))
            else:
                setattr(db_journal, field, value)

        db.commit()

        # 重新加载期刊对象（包含tags）
        db.refresh(db_journal)
        # 需要重新预加载tags，因为refresh会清除关系
        db_journal = db.query(Journal).options(joinedload(Journal.tags)).filter(Journal.id == journal_id).first()

        # 记录审计日志
        try:
            AuditService.log_update(
                db,
                table_name="journals",
                record_id=journal_id,
                old_values=old_values,
                new_values=journal_update.model_dump(exclude_unset=True)
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

        # 添加统计信息
        stats = calculate_journal_stats(db, db_journal.name)
        db_journal.reference_count = stats["reference_count"]
        db_journal.target_count = stats["target_count"]

        return db_journal

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新期刊失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新期刊失败: {str(e)}")


@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    删除期刊

    如果期刊被引用，则不允许删除，返回409错误和引用详情
    删除期刊时会级联删除所有关联的论文
    """
    try:
        # 检查期刊是否存在
        journal = journal_crud.get(db, id=journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 检查是否被Idea/Project引用（字符串引用）
        stats = calculate_journal_stats(db, journal.name)
        if stats["total_count"] > 0:
            # 获取引用详情
            references = get_journal_references(db, journal.name)

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "无法删除该期刊",
                    "reason": "该期刊正在被引用",
                    "stats": stats,
                    "references": {
                        "reference_ideas_count": len(references["reference_ideas"]),
                        "reference_projects_count": len(references["reference_projects"]),
                        "target_ideas_count": len(references["target_ideas"]),
                        "target_projects_count": len(references["target_projects"])
                    },
                    "suggestion": "请先将引用该期刊的Ideas和Projects更改为其他期刊，然后再删除"
                }
            )

        # 查询并删除所有关联的论文
        papers = db.query(Paper).filter(Paper.journal_id == journal_id).all()
        paper_count = len(papers)

        # 为每篇论文记录审计日志并删除
        for paper in papers:
            old_values = AuditService.serialize_model_instance(paper)
            try:
                AuditService.log_delete(
                    db,
                    table_name="papers",
                    record_id=paper.id,
                    old_values=old_values,
                    extra_info=f"Cascaded from journal deletion: {journal.name}"
                )
            except Exception as audit_error:
                logger.warning(f"论文审计日志记录失败 (ID: {paper.id}): {audit_error}")
            db.delete(paper)

        # 记录期刊审计日志（在删除前）
        old_values = {
            "name": journal.name,
            "notes": journal.notes,
            "tags": [tag.name for tag in journal.tags] if journal.tags else []
        }

        try:
            AuditService.log_delete(
                db,
                table_name="journals",
                record_id=journal_id,
                old_values=old_values,
                extra_info=f"Cascaded {paper_count} papers"
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

        # 删除期刊
        journal_crud.remove(db, id=journal_id)

        return {
            "message": "期刊及其关联论文删除成功",
            "journal_name": old_values["name"],
            "deleted_papers_count": paper_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除期刊失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除期刊失败: {str(e)}")


# ===== 统计和引用追踪路由 =====

@router.get("/{journal_id}/stats")
async def get_journal_stats(
    journal_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """获取期刊详细统计信息"""
    try:
        # 检查期刊是否存在
        journal = journal_crud.get(db, id=journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 计算统计
        stats = calculate_journal_stats(db, journal.name)

        # 获取引用详情
        references = get_journal_references(db, journal.name)

        return {
            "journal": {
                "id": journal.id,
                "name": journal.name,
                "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in journal.tags]
            },
            "stats": stats,
            "breakdown": {
                "reference_ideas_count": len(references["reference_ideas"]),
                "reference_projects_count": len(references["reference_projects"]),
                "target_ideas_count": len(references["target_ideas"]),
                "target_projects_count": len(references["target_projects"])
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取期刊统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取期刊统计失败: {str(e)}")


@router.get("/{journal_id}/references")
async def get_journal_reference_details(
    journal_id: int,
    request: Request,
    ref_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取引用该期刊的所有Ideas和Projects的详细列表

    参数:
    - ref_type: 'reference'(参考期刊) 或 'target'(投稿期刊)，None表示全部
    """
    try:
        # 检查期刊是否存在
        journal = journal_crud.get(db, id=journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 验证ref_type参数
        if ref_type and ref_type not in ['reference', 'target']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ref_type must be 'reference', 'target', or None"
            )

        # 获取引用详情
        references = get_journal_references(db, journal.name, ref_type)

        return {
            "journal_name": journal.name,
            "ref_type_filter": ref_type or "all",
            "references": references
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取期刊引用详情失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取期刊引用详情失败: {str(e)}")


# ===== 批量操作路由 =====

@router.post("/batch-import")
async def batch_import_journals(
    journals: List[JournalCreate],
    request: Request,
    db: Session = Depends(get_db)
):
    """
    批量导入期刊

    处理逻辑：
    - 如果期刊名称已存在，跳过该条记录
    - 返回成功导入数量和跳过的期刊列表
    """
    try:
        imported_count = 0
        skipped_journals = []
        errors = []

        for journal_data in journals:
            try:
                # 格式化期刊名称为 Title Case（防止大小写重复）
                formatted_name = to_title_case(journal_data.name.strip())

                # 使用格式化后的名称检查期刊是否已存在
                existing = db.query(Journal).filter(Journal.name == formatted_name).first()
                if existing:
                    skipped_journals.append({
                        "name": journal_data.name,  # 保留原始名称用于日志
                        "reason": "期刊名称已存在"
                    })
                    continue

                # 创建期刊，使用格式化后的名称
                journal_dict = journal_data.model_dump(exclude={'name'})
                new_journal = Journal(name=formatted_name, **journal_dict)
                db.add(new_journal)
                imported_count += 1

            except Exception as e:
                errors.append({
                    "name": journal_data.name,
                    "error": str(e)
                })

        # 提交事务
        db.commit()

        return {
            "message": f"成功导入 {imported_count} 个期刊",
            "imported_count": imported_count,
            "skipped_count": len(skipped_journals),
            "error_count": len(errors),
            "skipped_journals": skipped_journals,
            "errors": errors
        }

    except Exception as e:
        db.rollback()
        logger.error(f"批量导入期刊失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量导入期刊失败: {str(e)}")


# ===== 论文管理路由（整合到期刊） =====

@router.get("/{journal_id}/papers")
async def get_journal_papers(
    journal_id: int,
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    year: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取指定期刊下的论文列表，支持筛选、搜索和排序"""
    # 验证期刊存在
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="期刊不存在")

    # 构建查询
    query = db.query(Paper).filter(Paper.journal_id == journal_id)

    # 状态筛选
    if status:
        query = query.filter(Paper.status == status)

    # 年份筛选
    if year:
        query = query.filter(Paper.year == year)

    # 搜索（标题、作者）
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Paper.title.like(search_pattern),
                Paper.authors.like(search_pattern)
            )
        )

    # 获取总数
    total = query.count()

    # 排序映射
    sort_mapping = {
        'created_at': Paper.created_at,
        'year': Paper.year,
        'volume': Paper.volume,
        'issue': Paper.issue,
    }

    # 应用排序
    if sort_by and sort_by in sort_mapping:
        order_column = sort_mapping[sort_by]
        if sort_order == 'desc':
            query = query.order_by(order_column.desc())
        else:
            query = query.order_by(order_column.asc())
    else:
        # 默认按创建时间倒序
        query = query.order_by(Paper.created_at.desc())

    papers = query.offset(skip).limit(limit).all()

    return paginated_response(
        items=papers,
        total=total,
        page=(skip // limit) + 1 if limit > 0 else 1,
        page_size=limit
    )


@router.post("/{journal_id}/papers/import")
async def import_papers_to_journal(
    journal_id: int,
    file: UploadFile,
    db: Session = Depends(get_db)
):
    """
    向指定期刊导入Excel论文

    处理逻辑：
    1. 验证期刊存在
    2. 读取Excel文件
    3. 根据期刊名称匹配，自动创建不存在的期刊
    4. 论文关联到对应期刊
    """
    # 验证期刊存在
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="期刊不存在")

    # 验证文件格式
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支持Excel文件 (.xlsx, .xls)")

    try:
        contents = await file.read()
        imported_count, errors, batch_id = ExcelImportService.import_papers_from_excel(
            file_content=contents,
            db=db
        )

        return success_response(
            data={
                "imported_count": imported_count,
                "errors": errors,
                "batch_id": batch_id,
                "journal_id": journal_id,
                "journal_name": journal.name
            },
            message=f"成功导入 {imported_count} 篇论文"
        )

    except Exception as e:
        logger.error(f"期刊论文导入失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/{journal_id}/papers/analyze")
async def analyze_journal_papers(
    journal_id: int,
    ai_config: Optional[Dict[str, Any]] = None,
    status_filter: Optional[str] = "pending",
    max_concurrent: int = 3,
    db: Session = Depends(get_db)
):
    """
    对期刊下的论文进行批量AI分析

    参数：
    - ai_config: 可选的AI配置（覆盖默认配置）
    - status_filter: 只分析指定状态的论文，默认为"pending"
    - max_concurrent: 最大并发数
    """
    # 验证期刊存在
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="期刊不存在")

    # 获取待分析的论文
    query = db.query(Paper).filter(Paper.journal_id == journal_id)
    if status_filter:
        query = query.filter(Paper.status == status_filter)

    papers = query.all()
    paper_ids = [p.id for p in papers]

    if not paper_ids:
        raise HTTPException(
            status_code=400,
            detail=f"期刊 '{journal.name}' 下没有状态为 '{status_filter}' 的论文"
        )

    try:
        # 使用AI分析服务进行批量分析
        results = await AIAnalysisService.batch_analyze_papers(
            paper_ids=paper_ids,
            db=db,
            max_concurrent=max_concurrent,
            config=ai_config  # 传入自定义配置
        )

        return success_response(
            data={
                "journal_id": journal_id,
                "journal_name": journal.name,
                "analyzed_count": results.get("success", 0),
                "failed_count": results.get("total", 0) - results.get("success", 0),
                "details": results
            },
            message=f"分析完成：{results.get('success', 0)}/{results.get('total', 0)} 篇成功"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"批量分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/{journal_id}/papers/batch-delete")
async def batch_delete_journal_papers(
    journal_id: int,
    request_data: BatchDeleteRequest,
    db: Session = Depends(get_db)
):
    """
    批量删除指定期刊的论文

    参数：
    - ids: 要删除的论文ID列表

    返回：
    - deleted_count: 成功删除的数量
    - errors: 错误信息列表
    """
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 验证论文属于该期刊
        papers_to_delete = db.query(Paper).filter(
            Paper.id.in_(request_data.ids),
            Paper.journal_id == journal_id
        ).all()

        if len(papers_to_delete) != len(request_data.ids):
            found_ids = {p.id for p in papers_to_delete}
            missing_ids = set(request_data.ids) - found_ids
            raise HTTPException(
                status_code=400,
                detail=f"以下论文不存在或不属于该期刊: {missing_ids}"
            )

        # 检查是否有论文被 Ideas 引用
        from ..models.database import Idea
        referenced_papers = db.query(Idea).filter(
            Idea.reference_paper.in_(request_data.ids)
        ).all()

        if referenced_papers:
            ref_titles = [idea.reference_paper for idea in referenced_papers]
            raise HTTPException(
                status_code=400,
                detail=f"无法删除：以下论文已被 Idea 引用: {ref_titles}"
            )

        # 记录审计日志
        for paper in papers_to_delete:
            try:
                AuditService.log_delete(
                    db,
                    table_name="papers",
                    record_id=paper.id,
                    old_values={
                        "title": paper.title,
                        "journal_id": paper.journal_id,
                        "status": paper.status
                    }
                )
            except Exception as audit_error:
                logger.warning(f"审计日志记录失败: {audit_error}")

        # 执行删除
        deleted_count = db.query(Paper).filter(
            Paper.id.in_(request_data.ids),
            Paper.journal_id == journal_id
        ).delete(synchronize_session=False)

        db.commit()

        return success_response(
            data={
                "deleted_count": deleted_count,
                "errors": []
            },
            message=f"成功删除 {deleted_count} 篇论文"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"批量删除失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量删除失败: {str(e)}")


# ===== 期卷号统计路由（v3.6）=====

@router.get("/{journal_id}/volume-stats")
async def get_journal_volume_stats(
    journal_id: int,
    db: Session = Depends(get_db)
):
    """
    获取期刊期卷号详细统计（v3.6）

    返回：
    - total_papers: 总论文数
    - volumes: 每个卷号的论文数统计
    - issues: 每个期号的论文数统计
    - latest_volume: 最新卷号
    - latest_issue: 最新期号
    - total_volumes: 总卷数
    - total_issues: 总期数
    - coverage_by_year: 按年份分组的卷期覆盖数据（v3.7新增）
    """
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 获取该期刊的所有论文
        papers = db.query(Paper).filter(Paper.journal_id == journal_id).all()

        # 统计卷号和期号
        volumes = {}  # {volume: {count, year, issues: {issue: count}}}
        issues = {}  # {issue: count}
        latest_volume = None
        latest_issue = None

        for paper in papers:
            # 获取论文年份（用于分组）
            paper_year = paper.year if paper.year else 2024

            # 统计卷号
            if paper.volume:
                if paper.volume not in volumes:
                    volumes[paper.volume] = {"count": 0, "issues": {}, "year": paper_year}
                volumes[paper.volume]["count"] += 1

                # 使用论文的实际年份（多卷号可能对应不同年份，取最新）
                if paper_year > volumes[paper.volume]["year"]:
                    volumes[paper.volume]["year"] = paper_year

                try:
                    vol_num = int(paper.volume)
                    if latest_volume is None or vol_num > int(latest_volume or 0):
                        latest_volume = paper.volume
                except ValueError:
                    # 卷号不是纯数字，使用字符串比较
                    if latest_volume is None or paper.volume > (latest_volume or ""):
                        latest_volume = paper.volume

            # 统计期号（按卷期关联）
            if paper.volume and paper.issue:
                if paper.volume in volumes:
                    if paper.issue not in volumes[paper.volume]["issues"]:
                        volumes[paper.volume]["issues"][paper.issue] = 0
                    volumes[paper.volume]["issues"][paper.issue] += 1

            # 统计独立期号
            if paper.issue:
                try:
                    issue_num = int(paper.issue)
                    issues[paper.issue] = issues.get(paper.issue, 0) + 1
                    if latest_issue is None or issue_num > int(latest_issue or 0):
                        latest_issue = paper.issue
                except ValueError:
                    issues[paper.issue] = issues.get(paper.issue, 0) + 1
                    if latest_issue is None or paper.issue > (latest_issue or ""):
                        latest_issue = paper.issue

        # 构建按年份分组的卷期覆盖数据
        coverage_by_year = {}
        for vol_str, vol_data in volumes.items():
            year = vol_data.get("year", 2024)

            if year not in coverage_by_year:
                coverage_by_year[year] = []

            # 添加该卷的所有期号
            for issue, count in vol_data.get("issues", {}).items():
                coverage_by_year[year].append({
                    "volume": vol_str,
                    "issue": issue,
                    "count": count
                })

        # 按年份排序（降序）
        sorted_coverage = dict(sorted(coverage_by_year.items(), reverse=True))

        # 计算总卷数和总期数（去重）
        total_volumes = len(volumes)
        total_issues = len(issues)

        # 格式化volumes为前端需要的格式
        formatted_volumes = []
        for vol, data in volumes.items():
            issue_list = [{"issue": i, "count": c} for i, c in data.get("issues", {}).items()]
            formatted_volumes.append({
                "volume": vol,
                "count": data["count"],
                "year": data.get("year", 2024),
                "issues": issue_list
            })

        # 格式化issues
        formatted_issues = [{"issue": i, "count": c} for i, c in issues.items()]

        return success_response(data={
            "journal_id": journal_id,
            "journal_name": journal.name,
            "total_papers": len(papers),
            "volumes": formatted_volumes,
            "issues": formatted_issues,
            "latest_volume": latest_volume,
            "latest_issue": latest_issue,
            "total_volumes": total_volumes,
            "total_issues": total_issues,
            "coverage_by_year": sorted_coverage,
            # 数据库字段（v3.6）- 保留用于对比
            "db_latest_volume": journal.latest_volume,
            "db_latest_issue": journal.latest_issue,
            "db_paper_count": journal.paper_count
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取期刊期卷号统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取期卷号统计失败: {str(e)}")
