from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import re
from datetime import datetime
from ..models import (
    get_db, Collaborator, CollaboratorSchema, 
    CollaboratorCreate, CollaboratorUpdate, FileUploadResponse, User
)
from ..services import AuditService
from ..utils import DataValidator
from ..utils.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[CollaboratorSchema])
async def get_collaborators(
    skip: int = 0, 
    limit: int = 100,
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取合作者列表"""
    query = db.query(Collaborator)
    if not include_deleted:
        query = query.filter(Collaborator.is_deleted == False)
    collaborators = query.offset(skip).limit(limit).all()
    return collaborators

@router.get("/{collaborator_id}", response_model=CollaboratorSchema)
async def get_collaborator(collaborator_id: int, db: Session = Depends(get_db)):
    """获取单个合作者详情"""
    collaborator = db.query(Collaborator).filter(
        Collaborator.id == collaborator_id,
        Collaborator.is_deleted == False
    ).first()
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )
    return collaborator

@router.post("/", response_model=CollaboratorSchema)
async def create_collaborator(
    collaborator: CollaboratorCreate, 
    db: Session = Depends(get_db)
):
    """创建新合作者"""
    db_collaborator = Collaborator(**collaborator.dict())
    db.add(db_collaborator)
    db.commit()
    db.refresh(db_collaborator)
    
    # 记录审计日志
    AuditService.log_create(
        db=db,
        table_name="collaborators",
        record_id=db_collaborator.id,
        new_values=AuditService.serialize_model_instance(db_collaborator)
    )
    
    return db_collaborator

@router.put("/{collaborator_id}", response_model=CollaboratorSchema)
async def update_collaborator(
    collaborator_id: int,
    collaborator_update: CollaboratorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新合作者信息"""
    db_collaborator = db.query(Collaborator).filter(Collaborator.id == collaborator_id).first()
    if not db_collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )
    
    # 保存旧值用于审计
    old_values = AuditService.serialize_model_instance(db_collaborator)
    
    update_data = collaborator_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_collaborator, field, value)
    
    db.commit()
    db.refresh(db_collaborator)
    
    # 记录审计日志
    new_values = AuditService.serialize_model_instance(db_collaborator)
    AuditService.log_update(
        db=db,
        table_name="collaborators",
        record_id=collaborator_id,
        old_values=old_values,
        new_values=new_values
    )
    
    return db_collaborator

@router.delete("/{collaborator_id}")
async def delete_collaborator(
    collaborator_id: int,
    permanent: bool = False,
    db: Session = Depends(get_db)
):
    """删除合作者（默认软删除）"""
    db_collaborator = db.query(Collaborator).filter(
        Collaborator.id == collaborator_id,
        Collaborator.is_deleted == False
    ).first()
    if not db_collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )
    
    # 保存旧值用于审计
    old_values = AuditService.serialize_model_instance(db_collaborator)
    
    if permanent:
        # 永久删除
        db.delete(db_collaborator)
        db.commit()
        
        # 记录审计日志
        AuditService.log_delete(
            db=db,
            table_name="collaborators",
            record_id=collaborator_id,
            old_values=old_values,
            is_soft_delete=False
        )
    else:
        # 软删除
        db_collaborator.is_deleted = True
        db_collaborator.deleted_at = datetime.utcnow()
        db.commit()
        
        # 记录审计日志
        AuditService.log_delete(
            db=db,
            table_name="collaborators",
            record_id=collaborator_id,
            old_values=old_values,
            is_soft_delete=True
        )
    
    return {
        "message": "Collaborator deleted successfully",
        "permanent": permanent
    }

@router.post("/{collaborator_id}/restore")
async def restore_collaborator(
    collaborator_id: int,
    db: Session = Depends(get_db)
):
    """恢复已删除的合作者"""
    db_collaborator = db.query(Collaborator).filter(
        Collaborator.id == collaborator_id,
        Collaborator.is_deleted == True
    ).first()
    if not db_collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted collaborator not found"
        )
    
    db_collaborator.is_deleted = False
    db_collaborator.deleted_at = None
    db.commit()
    db.refresh(db_collaborator)
    
    # 记录审计日志
    AuditService.log_restore(
        db=db,
        table_name="collaborators",
        record_id=collaborator_id,
        restored_values=AuditService.serialize_model_instance(db_collaborator)
    )
    
    return {
        "message": "Collaborator restored successfully",
        "collaborator": db_collaborator
    }

@router.get("/{collaborator_id}/projects")
async def get_collaborator_projects(collaborator_id: int, db: Session = Depends(get_db)):
    """获取合作者参与的项目"""
    collaborator = db.query(Collaborator).filter(
        Collaborator.id == collaborator_id,
        Collaborator.is_deleted == False
    ).first()
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )
    return collaborator.projects

@router.post("/upload", response_model=FileUploadResponse)
async def upload_collaborators_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传Excel文件批量导入合作者信息"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel files (.xlsx, .xls) are supported"
        )
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        imported_count = 0
        errors = []
        
        # Expected columns mapping for collaborators
        column_mapping = {
            'name': ['姓名', 'name', 'Name', '名字'],
            'gender': ['性别', 'gender', 'Gender'],
            'class_name': ['班级', 'class', 'Class', '专业班级'],
            'future_plan': ['未来规划', 'future_plan', 'Future Plan', '规划'],
            'background': ['具体情况和背景', 'background', 'Background', '背景', '情况'],
            'contact_info': ['联系方式', 'contact', 'Contact', 'Email', '邮箱']
        }
        
        # Map columns
        mapped_columns = {}
        for standard_col, possible_names in column_mapping.items():
            for col_name in df.columns:
                if col_name in possible_names:
                    mapped_columns[standard_col] = col_name
                    break
        
        if 'name' not in mapped_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name column (姓名) is required"
            )
        
        for index, row in df.iterrows():
            try:
                collaborator_data = {}
                
                # Map required fields
                collaborator_data['name'] = str(row[mapped_columns['name']])[:100]
                
                # Map optional fields
                for field, col_name in mapped_columns.items():
                    if field != 'name' and col_name in df.columns:
                        value = row[col_name]
                        if pd.notna(value):
                            if field in ['gender', 'class_name', 'contact_info']:
                                collaborator_data[field] = str(value)[:100 if field != 'contact_info' else 200]
                            else:
                                collaborator_data[field] = str(value)
                
                # Check if collaborator already exists (including soft deleted)
                existing = db.query(Collaborator).filter(
                    Collaborator.name == collaborator_data['name']
                ).first()
                
                if existing:
                    # Update existing collaborator
                    for key, value in collaborator_data.items():
                        if key != 'name':  # Don't update name
                            setattr(existing, key, value)
                    # 如果是已删除的，恢复它
                    if existing.is_deleted:
                        existing.is_deleted = False
                        existing.deleted_at = None
                else:
                    # Create new collaborator
                    db_collaborator = Collaborator(**collaborator_data)
                    db.add(db_collaborator)
                
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 1}: {str(e)}")
        
        db.commit()
        
        return FileUploadResponse(
            message=f"Successfully imported {imported_count} collaborator records",
            imported_count=imported_count,
            errors=errors
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )

@router.post("/clean-names")
async def clean_collaborator_names(
    keyword: str = "srtp",
    db: Session = Depends(get_db)
):
    """批量清理合作者名称中的特定字符串"""
    try:
        # 查找所有包含关键词的合作者
        collaborators = db.query(Collaborator).filter(
            Collaborator.name.contains(keyword)
        ).all()
        
        cleaned_count = 0
        for collaborator in collaborators:
            # 移除名称中的关键词（不区分大小写）
            old_name = collaborator.name
            new_name = re.sub(rf'\s*{re.escape(keyword)}\s*', '', old_name, flags=re.IGNORECASE).strip()
            
            if old_name != new_name:
                collaborator.name = new_name
                cleaned_count += 1
                
        db.commit()
        
        return {
            "message": f"成功清理 {cleaned_count} 个合作者的名称",
            "cleaned_count": cleaned_count,
            "total_found": len(collaborators)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清理名称失败: {str(e)}")

@router.post("/create-batch")
async def create_collaborators_batch(
    collaborators: List[CollaboratorCreate],
    db: Session = Depends(get_db)
):
    """批量创建合作者"""
    try:
        created_collaborators = []
        for collaborator_data in collaborators:
            # 检查是否已存在
            existing = db.query(Collaborator).filter(
                Collaborator.name == collaborator_data.name
            ).first()
            
            if not existing:
                db_collaborator = Collaborator(**collaborator_data.dict())
                db.add(db_collaborator)
                created_collaborators.append(db_collaborator)
                
        db.commit()
        
        return {
            "message": f"成功创建 {len(created_collaborators)} 个合作者",
            "created_count": len(created_collaborators)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"批量创建失败: {str(e)}")

from pydantic import BaseModel

class GroupCreateRequest(BaseModel):
    group_name: str
    member_names: List[str]

@router.post("/create-group")
async def create_collaborator_group(
    request: GroupCreateRequest,
    db: Session = Depends(get_db)
):
    """创建合作者组（通过添加组标签）"""
    try:
        updated_count = 0
        not_found = []
        
        for name in request.member_names:
            collaborator = db.query(Collaborator).filter(
                Collaborator.name == name
            ).first()
            
            if collaborator:
                # 在背景信息中添加组标签
                if collaborator.background:
                    collaborator.background = f"{collaborator.background} [{request.group_name}]"
                else:
                    collaborator.background = f"[{request.group_name}]"
                updated_count += 1
            else:
                not_found.append(name)
                
        db.commit()
        
        return {
            "message": f"成功将 {updated_count} 个合作者添加到 {request.group_name}",
            "updated_count": updated_count,
            "not_found": not_found
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建组失败: {str(e)}")

@router.post("/{collaborator_id}/restore")
async def restore_collaborator(
    collaborator_id: int,
    db: Session = Depends(get_db)
):
    """恢复已软删除的合作者"""
    db_collaborator = db.query(Collaborator).filter(
        Collaborator.id == collaborator_id,
        Collaborator.is_deleted == True
    ).first()
    
    if not db_collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted collaborator not found"
        )
    
    # 恢复合作者
    db_collaborator.is_deleted = False
    db_collaborator.deleted_at = None
    
    db.commit()
    db.refresh(db_collaborator)
    
    return {
        "message": "Collaborator restored successfully",
        "collaborator": db_collaborator
    }

@router.get("/deleted/list", response_model=List[CollaboratorSchema])
async def get_deleted_collaborators(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取已删除的合作者列表"""
    collaborators = db.query(Collaborator).filter(
        Collaborator.is_deleted == True
    ).offset(skip).limit(limit).all()
    return collaborators

@router.get("/{collaborator_id}/check-dependencies")
async def check_collaborator_dependencies(collaborator_id: int, db: Session = Depends(get_db)):
    """检查合作者的依赖关系"""
    dependencies = DataValidator.check_collaborator_dependencies(collaborator_id, db)
    if not dependencies["exists"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )
    return dependencies