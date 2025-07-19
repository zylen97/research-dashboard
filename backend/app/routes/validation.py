"""
数据验证相关的路由
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from ..models import get_db
from ..services import ValidationService

router = APIRouter()

@router.get("/project/{project_id}/dependencies")
async def check_project_dependencies(
    project_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """检查项目的依赖关系"""
    return ValidationService.check_project_dependencies(project_id, db)

@router.get("/collaborator/{collaborator_id}/dependencies")
async def check_collaborator_dependencies(
    collaborator_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """检查合作者的依赖关系"""
    return ValidationService.check_collaborator_dependencies(collaborator_id, db)

@router.post("/project/validate")
async def validate_project_data(
    project_data: Dict[str, Any]
) -> Dict[str, Any]:
    """验证项目数据"""
    return ValidationService.validate_project_data(project_data)

@router.post("/collaborator/validate")
async def validate_collaborator_data(
    collaborator_data: Dict[str, Any]
) -> Dict[str, Any]:
    """验证合作者数据"""
    return ValidationService.validate_collaborator_data(collaborator_data)

@router.get("/consistency")
async def check_data_consistency(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """检查整体数据一致性"""
    return ValidationService.check_data_consistency(db)