"""
期刊库管理路由
提供期刊CRUD、统计查询、引用追踪、批量导入等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ..models import (
    get_db, Journal, Idea, ResearchProject, Tag, journal_tags,
    JournalCreate, JournalUpdate, JournalSchema
)
from ..services.audit import AuditService
from ..utils.crud_base import CRUDBase
from ..utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter()

# 创建CRUD实例
journal_crud = CRUDBase[Journal, JournalCreate, JournalUpdate](Journal)


# ===== 期刊统计辅助函数 =====

def calculate_journal_stats(db: Session, journal_name: str) -> Dict[str, int]:
    """
    计算期刊的引用统计

    Args:
        db: 数据库会话
        journal_name: 期刊名称

    Returns:
        统计字典包含: reference_count, target_count, total_count
    """
    # 统计作为参考期刊的次数
    reference_count = (
        db.query(Idea).filter(Idea.reference_journal == journal_name).count() +
        db.query(ResearchProject).filter(ResearchProject.reference_journal == journal_name).count()
    )

    # 统计作为拟投稿期刊的次数
    target_count = (
        db.query(Idea).filter(Idea.target_journal == journal_name).count() +
        db.query(ResearchProject).filter(ResearchProject.target_journal == journal_name).count()
    )

    return {
        "reference_count": reference_count,
        "target_count": target_count,
        "total_count": reference_count + target_count
    }


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

    # 查询作为拟投稿期刊的Ideas
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

        # 查询作为拟投稿期刊的Projects
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
    language: Optional[str] = None,
    tag_ids: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取期刊列表

    支持筛选参数：
    - language: 期刊语言 (zh/en)
    - tag_ids: 标签ID列表，逗号分隔（如 "1,2,3"）
    - search: 搜索关键词（匹配期刊名称）
    """
    try:
        query = db.query(Journal)

        # 应用筛选条件
        if language:
            query = query.filter(Journal.language == language)

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

        # 为每个期刊添加统计信息和标签列表
        for journal in journals:
            stats = calculate_journal_stats(db, journal.name)
            journal.reference_count = stats["reference_count"]
            journal.target_count = stats["target_count"]

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
        # 检查期刊名称是否已存在
        existing = db.query(Journal).filter(Journal.name == journal.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"期刊 '{journal.name}' 已存在"
            )

        # 验证language字段
        if journal.language not in ['zh', 'en']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="language must be 'zh' or 'en'"
            )

        # 验证tag_ids（如果提供）
        tag_ids = journal.tag_ids if hasattr(journal, 'tag_ids') else []
        if tag_ids:
            # 检查所有标签是否存在
            existing_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
            if len(existing_tags) != len(tag_ids):
                existing_tag_ids = {tag.id for tag in existing_tags}
                invalid_ids = set(tag_ids) - existing_tag_ids
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"标签ID不存在: {invalid_ids}"
                )

        # 创建期刊（不包含tag_ids字段）
        journal_data = journal.model_dump(exclude={'tag_ids'})
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
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="journals",
                action="CREATE",
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


@router.get("/{journal_id}", response_model=JournalSchema)
async def get_journal(
    journal_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """获取单个期刊详情（含统计信息）"""
    try:
        journal = journal_crud.get(db, id=journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 添加统计信息
        stats = calculate_journal_stats(db, journal.name)
        journal.reference_count = stats["reference_count"]
        journal.target_count = stats["target_count"]
        journal.total_count = stats["total_count"]

        return journal

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
        # 检查期刊是否存在
        db_journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not db_journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 如果要更新名称，检查新名称是否已被使用
        if journal_update.name and journal_update.name != db_journal.name:
            existing = db.query(Journal).filter(Journal.name == journal_update.name).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"期刊名称 '{journal_update.name}' 已被使用"
                )

        # 验证language字段
        if journal_update.language and journal_update.language not in ['zh', 'en']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="language must be 'zh' or 'en'"
            )

        # 处理tag_ids更新（完全替换模式）
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
            "language": db_journal.language,
            "notes": db_journal.notes
        }

        # 更新期刊基本信息（排除tag_ids）
        update_data = journal_update.model_dump(exclude_unset=True, exclude={'tag_ids'})
        for field, value in update_data.items():
            setattr(db_journal, field, value)

        db.commit()
        db.refresh(db_journal)

        # 记录审计日志
        try:
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="journals",
                action="UPDATE",
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
    """
    try:
        # 检查期刊是否存在
        journal = journal_crud.get(db, id=journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 检查是否被引用
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

        # 记录审计日志（在删除前）
        old_values = {
            "name": journal.name,
            "language": journal.language,
            "notes": journal.notes
        }

        try:
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="journals",
                action="DELETE",
                record_id=journal_id,
                old_values=old_values
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

        # 删除期刊
        journal_crud.remove(db, id=journal_id)

        return {
            "message": "期刊删除成功",
            "journal_name": old_values["name"]
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
                "language": journal.language,
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
    - ref_type: 'reference'(参考期刊) 或 'target'(拟投稿期刊)，None表示全部
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
                # 检查期刊是否已存在
                existing = db.query(Journal).filter(Journal.name == journal_data.name).first()
                if existing:
                    skipped_journals.append({
                        "name": journal_data.name,
                        "reason": "期刊名称已存在"
                    })
                    continue

                # 验证language字段
                if journal_data.language not in ['zh', 'en']:
                    errors.append({
                        "name": journal_data.name,
                        "error": f"无效的language值: {journal_data.language}，必须为zh或en"
                    })
                    continue

                # 创建期刊
                new_journal = Journal(**journal_data.model_dump())
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
