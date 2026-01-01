"""
论文管理路由
提供论文CRUD、Excel导入、AI分析、提示词管理等功能
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import logging
import re

from ..models import (
    get_db, Paper, Journal, Idea, SystemConfig,
    PaperCreate, PaperUpdate, PaperSchema, FileUploadResponse
)
from ..services.audit import AuditService
from ..services.excel_import_service import ExcelImportService
from ..services.ai_analysis_service import AIAnalysisService
from ..utils.crud_base import CRUDBase
from ..utils.response import success_response, paginated_response

logger = logging.getLogger(__name__)

router = APIRouter()

# 创建CRUD实例
paper_crud = CRUDBase[Paper, PaperCreate, PaperUpdate](Paper)

# 提示词模板配置前缀
PROMPT_CONFIG_PREFIX = "paper.prompt."

# 用户配置键名
USER_CONFIG_KEYS = {
    "user_profile": "paper.user_profile",
    "research_fields": "paper.research_fields",
}


# ===== 论文CRUD路由 =====

@router.get("/")
async def get_papers(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    migration_potential: Optional[str] = None,
    journal_id: Optional[int] = None,
    batch_id: Optional[str] = None,
    tag_ids: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取论文列表，支持筛选和搜索"""
    query = db.query(Paper).options(
        joinedload(Paper.journal)
    )

    # 状态筛选
    if status:
        query = query.filter(Paper.status == status)

    # 迁移潜力筛选
    if migration_potential:
        query = query.filter(Paper.migration_potential == migration_potential)

    # 期刊筛选
    if journal_id:
        query = query.filter(Paper.journal_id == journal_id)

    # 批次筛选
    if batch_id:
        query = query.filter(Paper.import_batch_id == batch_id)

    # 标签筛选（通过期刊关联）
    if tag_ids:
        from ..models.database import journal_tags
        tag_id_list = [int(tid.strip()) for tid in tag_ids.split(',') if tid.strip()]
        if tag_id_list:
            # JOIN journal_tags 表筛选包含指定标签的期刊
            query = query.join(journal_tags, Paper.journal_id == journal_tags.c.journal_id)\
                .filter(journal_tags.c.tag_id.in_(tag_id_list))\
                .distinct()

    # 搜索（标题、作者、关键词）
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Paper.title.like(search_pattern),
                Paper.authors.like(search_pattern),
                Paper.keywords.like(search_pattern)
            )
        )

    # 获取总数
    total = query.count()

    # 按创建时间倒序
    query = query.order_by(Paper.created_at.desc())

    papers = query.offset(skip).limit(limit).all()

    # 返回分页响应
    return paginated_response(
        items=papers,
        total=total,
        page=(skip // limit) + 1 if limit > 0 else 1,
        page_size=limit
    )


@router.get("/{paper_id:int}", response_model=PaperSchema)
async def get_paper(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """获取单个论文详情"""
    paper = db.query(Paper).options(
        joinedload(Paper.journal)
    ).filter(Paper.id == paper_id).first()

    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper {paper_id} not found"
        )

    return paper


@router.post("/", response_model=PaperSchema)
async def create_paper(
    paper: PaperCreate,
    db: Session = Depends(get_db)
):
    """创建新论文"""
    db_paper = Paper(**paper.model_dump())
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)

    # 记录审计日志
    AuditService.log_create(
        db=db,
        table_name="papers",
        record_id=db_paper.id,
        new_values=AuditService.serialize_model_instance(db_paper)
    )

    return db_paper


@router.put("/{paper_id:int}", response_model=PaperSchema)
async def update_paper(
    paper_id: int,
    paper: PaperUpdate,
    db: Session = Depends(get_db)
):
    """更新论文信息"""
    db_paper = db.query(Paper).filter(Paper.id == paper_id).first()

    if not db_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper {paper_id} not found"
        )

    # 记录旧值
    old_values = AuditService.serialize_model_instance(db_paper)

    # 更新字段
    update_data = paper.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_paper, field, value)

    db_paper.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_paper)

    # 记录审计日志
    AuditService.log_update(
        db=db,
        table_name="papers",
        record_id=db_paper.id,
        old_values=old_values,
        new_values=AuditService.serialize_model_instance(db_paper)
    )

    return db_paper


@router.delete("/{paper_id:int}")
async def delete_paper(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """删除论文"""
    db_paper = db.query(Paper).filter(Paper.id == paper_id).first()

    if not db_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper {paper_id} not found"
        )

    # 检查是否有Idea引用此论文
    referencing_ideas = db.query(Idea).filter(Idea.source_paper_id == paper_id).count()
    if referencing_ideas > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete paper: {referencing_ideas} idea(s) reference this paper"
        )

    # 检查是否有ResearchProject引用此论文（通过reference_paper字段）
    from ..models.database import ResearchProject
    referencing_projects = db.query(ResearchProject).filter(
        ResearchProject.reference_paper == db_paper.title
    ).count()
    if referencing_projects > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete paper: {referencing_projects} research project(s) reference this paper"
        )

    # 记录审计日志
    old_values = AuditService.serialize_model_instance(db_paper)
    AuditService.log_delete(
        db=db,
        table_name="papers",
        record_id=db_paper.id,
        old_values=old_values
    )

    db.delete(db_paper)
    db.commit()

    return success_response(message="Paper deleted successfully")


# ===== Excel导入路由 =====

@router.post("/import-excel", response_model=FileUploadResponse)
async def import_papers_from_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """从Excel文件导入论文"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel files (.xlsx, .xls) are supported"
        )

    try:
        contents = await file.read()
        imported_count, errors, batch_id = ExcelImportService.import_papers_from_excel(
            file_content=contents,
            db=db
        )

        return FileUploadResponse(
            message=f"Successfully imported {imported_count} papers",
            imported_count=imported_count,
            errors=errors
        )

    except Exception as e:
        logger.error(f"Excel import failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


# ===== 批量操作路由 =====

@router.post("/batch-delete")
async def batch_delete_papers(
    paper_ids: List[int],
    db: Session = Depends(get_db)
):
    """批量删除论文"""
    deleted_count = 0
    errors = []

    for paper_id in paper_ids:
        try:
            db_paper = db.query(Paper).filter(Paper.id == paper_id).first()
            if not db_paper:
                errors.append(f"Paper {paper_id} not found")
                continue

            # 检查引用
            referencing_ideas = db.query(Idea).filter(Idea.source_paper_id == paper_id).count()
            if referencing_ideas > 0:
                errors.append(f"Paper {paper_id} is referenced by {referencing_ideas} idea(s)")
                continue

            db.delete(db_paper)
            deleted_count += 1

        except Exception as e:
            errors.append(f"Paper {paper_id}: {str(e)}")

    db.commit()

    return success_response(
        data={
            "deleted_count": deleted_count,
            "errors": errors
        },
        message=f"Deleted {deleted_count} papers"
    )


@router.patch("/{paper_id}/status")
async def update_paper_status(
    paper_id: int,
    new_status: str,
    db: Session = Depends(get_db)
):
    """更新论文状态"""
    valid_statuses = ['pending', 'analyzed', 'converted']
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    db_paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not db_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper {paper_id} not found"
        )

    old_values = AuditService.serialize_model_instance(db_paper)
    db_paper.status = new_status
    db_paper.updated_at = datetime.utcnow()
    db.commit()

    AuditService.log_update(
        db=db,
        table_name="papers",
        record_id=db_paper.id,
        old_values=old_values,
        new_values=AuditService.serialize_model_instance(db_paper)
    )

    return success_response(
        data=PaperSchema.model_validate(db_paper),
        message=f"Paper status updated to {new_status}"
    )


# ===== 统计路由 =====

@router.get("/stats/summary")
async def get_papers_stats(db: Session = Depends(get_db)):
    """获取论文统计信息"""
    total = db.query(Paper).count()
    pending = db.query(Paper).filter(Paper.status == 'pending').count()
    analyzed = db.query(Paper).filter(Paper.status == 'analyzed').count()
    converted = db.query(Paper).filter(Paper.status == 'converted').count()
    high_potential = db.query(Paper).filter(Paper.migration_potential == 'high').count()
    medium_potential = db.query(Paper).filter(Paper.migration_potential == 'medium').count()
    low_potential = db.query(Paper).filter(Paper.migration_potential == 'low').count()

    return success_response(data={
        "total": total,
        "by_status": {
            "pending": pending,
            "analyzed": analyzed,
            "converted": converted,
        },
        "by_potential": {
            "high": high_potential,
            "medium": medium_potential,
            "low": low_potential,
        }
    })


# ===== AI分析路由 =====

@router.post("/batch-analyze")
async def batch_analyze_papers(
    paper_ids: List[int],
    max_concurrent: int = 3,
    db: Session = Depends(get_db)
):
    """批量AI分析论文"""
    if not paper_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="paper_ids cannot be empty"
        )

    if max_concurrent < 1 or max_concurrent > 10:
        max_concurrent = 3

    try:
        results = await AIAnalysisService.batch_analyze_papers(
            paper_ids=paper_ids,
            db=db,
            max_concurrent=max_concurrent
        )

        return success_response(
            data=results,
            message=f"Analyzed {results['success']}/{results['total']} papers"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Batch analysis failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/{paper_id:int}/analyze")
async def analyze_single_paper(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """分析单篇论文"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper {paper_id} not found"
        )

    try:
        result = await AIAnalysisService.analyze_single_paper(paper, db)

        if result.get("success"):
            return success_response(
                data=result,
                message="Paper analyzed successfully"
            )
        else:
            return success_response(
                data=result,
                message=f"Analysis completed with issues: {result.get('error', 'Unknown error')}"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Paper analysis failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


# ===== 论文转Idea路由 =====

@router.post("/{paper_id:int}/convert-to-idea")
async def convert_paper_to_idea(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """将论文转换为Idea"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper {paper_id} not found"
        )

    # 检查是否已转换
    existing_idea = db.query(Idea).filter(Idea.source_paper_id == paper_id).first()
    if existing_idea:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paper already converted to idea (ID: {existing_idea.id})"
        )

    # 获取第一个合作者作为默认负责人
    from ..models import Collaborator
    default_collaborator = db.query(Collaborator).filter(
        Collaborator.is_deleted == False
    ).first()

    if not default_collaborator:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No collaborator found to assign as responsible person"
        )

    # 保存论文信息（在删除前）
    paper_title = paper.title
    paper_abstract = paper.abstract
    paper_core_idea = paper.core_idea_summary
    journal_name = paper.journal.name if paper.journal else None

    # 记录审计日志（在删除前）
    old_values = AuditService.serialize_model_instance(paper)

    # 创建Idea（使用保存的值）
    idea = Idea(
        project_name=paper_title[:200],  # 限制长度
        project_description=paper_core_idea or paper_abstract or "",
        research_method="待确定",
        reference_paper=paper_title,
        reference_journal=journal_name,
        target_journal=None,
        responsible_person_id=default_collaborator.id,
        maturity="immature",
        source_paper_id=paper_id  # 保留源论文ID作为引用
    )

    db.add(idea)
    db.flush()  # 获取idea.id

    # 删除原论文（而不是更新状态）
    db.delete(paper)
    db.commit()

    # 记录审计日志
    AuditService.log_delete(
        db=db,
        table_name="papers",
        record_id=paper_id,
        old_values=old_values,
        extra_info=f"Converted to Idea (ID: {idea.id})"
    )

    return success_response(
        data={
            "idea_id": idea.id,
            "paper_id": paper_id,
            "deleted": True  # 标识论文已被删除
        },
        message="Paper converted to idea and deleted successfully"
    )


# ===== 提示词模板管理路由 =====

def extract_variables_from_template(template_content: str) -> List[str]:
    """
    从提示词模板中提取变量

    支持的变量格式：{variable_name}
    返回去重的变量列表
    """
    pattern = r'\{([a-zA-Z_][a-zA-Z0-9_]*)\}'
    variables = re.findall(pattern, template_content)
    # 内置变量，不需要用户输入
    builtin_vars = {'title', 'authors', 'abstract', 'keywords', 'year', 'journal_name'}
    # 返回用户自定义变量
    return list(set(variables) - builtin_vars)


@router.get("/prompts")
async def get_prompt_templates(
    db: Session = Depends(get_db)
):
    """获取所有提示词模板列表"""
    try:
        # 查询所有提示词配置
        configs = db.query(SystemConfig).filter(
            SystemConfig.key.like(f"{PROMPT_CONFIG_PREFIX}%"),
            SystemConfig.is_active == True
        ).order_by(SystemConfig.created_at).all()

        templates = []
        for cfg in configs:
            # 提取模板名称
            template_name = cfg.key.replace(PROMPT_CONFIG_PREFIX, "")

            try:
                template_data = json.loads(cfg.value)
                templates.append({
                    "name": template_name,
                    "content": template_data.get("content", ""),
                    "variables": template_data.get("variables", []),
                    "is_default": cfg.key.endswith(".default") or template_data.get("is_default", False),
                    "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
                    "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
                })
            except json.JSONDecodeError:
                logger.warning(f"Invalid template data for: {template_name}")
                continue

        return success_response(data=templates, message="获取提示词模板成功")

    except Exception as e:
        logger.error(f"获取提示词模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取提示词模板失败: {str(e)}")


@router.get("/prompts/{template_name}")
async def get_prompt_template(
    template_name: str,
    db: Session = Depends(get_db)
):
    """获取单个提示词模板详情"""
    config_key = f"{PROMPT_CONFIG_PREFIX}{template_name}"
    config = db.query(SystemConfig).filter(
        SystemConfig.key == config_key,
        SystemConfig.is_active == True
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail=f"提示词模板 '{template_name}' 不存在")

    try:
        template_data = json.loads(config.value)
        return success_response(data={
            "name": template_name,
            **template_data,
            "created_at": config.created_at.isoformat() if config.created_at else None,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        })
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="提示词模板数据格式错误")


@router.post("/prompts")
async def create_prompt_template(
    name: str = Body(..., description="模板名称"),
    content: str = Body(..., description="提示词内容"),
    is_default: bool = Body(False, description="是否设为默认模板"),
    db: Session = Depends(get_db)
):
    """创建新的提示词模板"""
    # 验证模板名称
    if not name or not name.replace('_', '').replace('-', '').isalnum():
        raise HTTPException(status_code=400, detail="模板名称只能包含字母、数字、下划线和连字符")

    # 检查是否已存在
    config_key = f"{PROMPT_CONFIG_PREFIX}{name}"
    existing = db.query(SystemConfig).filter(SystemConfig.key == config_key).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"提示词模板 '{name}' 已存在")

    # 提取变量
    variables = extract_variables_from_template(content)

    # 创建配置
    template_data = {
        "content": content,
        "variables": variables,
        "is_default": is_default
    }

    try:
        # 如果设置为默认，先取消其他默认模板
        if is_default:
            db.query(SystemConfig).filter(
                SystemConfig.key.like(f"{PROMPT_CONFIG_PREFIX}%"),
                SystemConfig.is_active == True
            ).all()
            for cfg in db.query(SystemConfig).filter(
                SystemConfig.key.like(f"{PROMPT_CONFIG_PREFIX}%")
            ).all():
                try:
                    cfg_data = json.loads(cfg.value)
                    if cfg_data.get("is_default", False):
                        cfg_data["is_default"] = False
                        cfg.value = json.dumps(cfg_data, ensure_ascii=False)
                except:
                    pass

        config = SystemConfig(
            key=config_key,
            value=json.dumps(template_data, ensure_ascii=False),
            category="paper_prompt",
            description=f"论文分析提示词模板: {name}",
            is_active=True
        )
        db.add(config)
        db.commit()

        return success_response(
            data={
                "name": name,
                "content": content,
                "variables": variables,
                "is_default": is_default
            },
            message=f"提示词模板 '{name}' 创建成功"
        )

    except Exception as e:
        db.rollback()
        logger.error(f"创建提示词模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建提示词模板失败: {str(e)}")


@router.put("/prompts/{template_name}")
async def update_prompt_template(
    template_name: str,
    content: Optional[str] = Body(None, description="提示词内容"),
    is_default: Optional[bool] = Body(None, description="是否设为默认模板"),
    db: Session = Depends(get_db)
):
    """更新提示词模板"""
    config_key = f"{PROMPT_CONFIG_PREFIX}{template_name}"
    config = db.query(SystemConfig).filter(
        SystemConfig.key == config_key,
        SystemConfig.is_active == True
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail=f"提示词模板 '{template_name}' 不存在")

    try:
        template_data = json.loads(config.value)

        # 更新内容
        if content is not None:
            template_data["content"] = content
            template_data["variables"] = extract_variables_from_template(content)

        # 更新默认标记
        if is_default is not None:
            if is_default:
                # 取消其他默认模板
                for cfg in db.query(SystemConfig).filter(
                    SystemConfig.key.like(f"{PROMPT_CONFIG_PREFIX}%"),
                    SystemConfig.key != config_key
                ).all():
                    try:
                        cfg_data = json.loads(cfg.value)
                        if cfg_data.get("is_default", False):
                            cfg_data["is_default"] = False
                            cfg.value = json.dumps(cfg_data, ensure_ascii=False)
                    except:
                        pass
            template_data["is_default"] = is_default

        config.value = json.dumps(template_data, ensure_ascii=False)
        config.updated_at = datetime.utcnow()
        db.commit()

        return success_response(
            data={
                "name": template_name,
                **template_data
            },
            message=f"提示词模板 '{template_name}' 更新成功"
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="提示词模板数据格式错误")
    except Exception as e:
        db.rollback()
        logger.error(f"更新提示词模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新提示词模板失败: {str(e)}")


@router.delete("/prompts/{template_name}")
async def delete_prompt_template(
    template_name: str,
    db: Session = Depends(get_db)
):
    """删除提示词模板"""
    config_key = f"{PROMPT_CONFIG_PREFIX}{template_name}"
    config = db.query(SystemConfig).filter(
        SystemConfig.key == config_key,
        SystemConfig.is_active == True
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail=f"提示词模板 '{template_name}' 不存在")

    try:
        # 检查是否为默认模板
        template_data = json.loads(config.value)
        if template_data.get("is_default", False):
            raise HTTPException(status_code=400, detail="无法删除默认模板，请先设置其他模板为默认")

        db.delete(config)
        db.commit()

        return success_response(message=f"提示词模板 '{template_name}' 删除成功")

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="提示词模板数据格式错误")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除提示词模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除提示词模板失败: {str(e)}")


# ===== 全局用户配置路由 =====

@router.get("/user-config")
async def get_user_config(
    db: Session = Depends(get_db)
):
    """获取全局用户配置"""
    try:
        configs = db.query(SystemConfig).filter(
            SystemConfig.key.in_(list(USER_CONFIG_KEYS.values())),
            SystemConfig.is_active == True
        ).all()

        result = {
            "user_profile": "",
            "research_fields": []
        }

        for cfg in configs:
            if cfg.key == USER_CONFIG_KEYS["user_profile"]:
                result["user_profile"] = cfg.value
            elif cfg.key == USER_CONFIG_KEYS["research_fields"]:
                try:
                    result["research_fields"] = json.loads(cfg.value)
                except:
                    result["research_fields"] = []

        return success_response(data=result)

    except Exception as e:
        logger.error(f"获取用户配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取用户配置失败: {str(e)}")


@router.put("/user-config")
async def update_user_config(
    user_profile: Optional[str] = Body(None, description="用户背景"),
    research_fields: Optional[List[str]] = Body(None, description="研究领域列表"),
    db: Session = Depends(get_db)
):
    """更新全局用户配置"""
    try:
        updated_fields = []

        # 更新用户背景
        if user_profile is not None:
            config = db.query(SystemConfig).filter(
                SystemConfig.key == USER_CONFIG_KEYS["user_profile"]
            ).first()
            if config:
                config.value = user_profile
                config.updated_at = datetime.utcnow()
            else:
                config = SystemConfig(
                    key=USER_CONFIG_KEYS["user_profile"],
                    value=user_profile,
                    category="paper_analysis",
                    description="用户研究背景",
                    is_active=True
                )
                db.add(config)
            updated_fields.append("user_profile")

        # 更新研究领域
        if research_fields is not None:
            fields_json = json.dumps(research_fields, ensure_ascii=False)
            config = db.query(SystemConfig).filter(
                SystemConfig.key == USER_CONFIG_KEYS["research_fields"]
            ).first()
            if config:
                config.value = fields_json
                config.updated_at = datetime.utcnow()
            else:
                config = SystemConfig(
                    key=USER_CONFIG_KEYS["research_fields"],
                    value=fields_json,
                    category="paper_analysis",
                    description="用户关注的研究领域",
                    is_active=True
                )
                db.add(config)
            updated_fields.append("research_fields")

        db.commit()

        return success_response(
            data={
                "user_profile": user_profile,
                "research_fields": research_fields
            },
            message=f"用户配置更新成功: {', '.join(updated_fields)}"
        )

    except Exception as e:
        db.rollback()
        logger.error(f"更新用户配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新用户配置失败: {str(e)}")


# ===== 增强的批量分析路由（支持自定义提示词模板）=====

@router.post("/batch-analyze-with-prompt")
async def batch_analyze_papers_with_prompt(
    paper_ids: List[int] = Body(..., description="论文ID列表"),
    template_name: Optional[str] = Body(None, description="使用的提示词模板名称"),
    template_variables: Optional[Dict[str, Any]] = Body(None, description="模板变量值"),
    max_concurrent: int = Body(3, description="最大并发数"),
    db: Session = Depends(get_db)
):
    """
    使用自定义提示词模板批量分析论文

    参数：
    - paper_ids: 要分析的论文ID列表
    - template_name: 提示词模板名称（如果不指定，使用默认配置）
    - template_variables: 模板变量值（覆盖全局配置）
    - max_concurrent: 最大并发数（1-10）
    """
    if not paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids 不能为空")

    if len(paper_ids) > 100:
        raise HTTPException(status_code=400, detail="单次最多分析100篇论文")

    if max_concurrent < 1 or max_concurrent > 10:
        max_concurrent = 3

    # 获取论文对象
    papers = db.query(Paper).filter(Paper.id.in_(paper_ids)).all()
    if not papers:
        raise HTTPException(status_code=404, detail="未找到指定的论文")

    # 构建配置
    config = {}

    # 如果指定了模板，加载模板内容
    if template_name:
        config_key = f"{PROMPT_CONFIG_PREFIX}{template_name}"
        template_config = db.query(SystemConfig).filter(
            SystemConfig.key == config_key,
            SystemConfig.is_active == True
        ).first()

        if not template_config:
            raise HTTPException(status_code=404, detail=f"提示词模板 '{template_name}' 不存在")

        try:
            template_data = json.loads(template_config.value)
            config["custom_prompt"] = template_data["content"]
        except (json.JSONDecodeError, KeyError):
            raise HTTPException(status_code=500, detail="提示词模板数据格式错误")

    # 添加变量覆盖
    if template_variables:
        if "user_profile" in template_variables:
            config["user_profile"] = template_variables["user_profile"]
        if "research_fields" in template_variables:
            if isinstance(template_variables["research_fields"], list):
                config["research_fields"] = json.dumps(template_variables["research_fields"])
            else:
                config["research_fields"] = template_variables["research_fields"]

    try:
        results = await AIAnalysisService.batch_analyze_papers(
            paper_ids=paper_ids,
            db=db,
            max_concurrent=max_concurrent,
            config=config if config else None
        )

        return success_response(
            data=results,
            message=f"分析完成：{results.get('success', 0)}/{results.get('total', 0)} 篇成功"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"批量分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")
