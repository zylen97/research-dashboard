from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
from ..models import (
    get_db, Literature, LiteratureSchema, 
    LiteratureCreate, LiteratureUpdate,
    FileUploadResponse, ValidationRequest, ValidationResult
)

router = APIRouter()

@router.get("/", response_model=List[LiteratureSchema])
async def get_literature(
    skip: int = 0, 
    limit: int = 100,
    status_filter: Optional[str] = None,
    validation_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取文献列表"""
    query = db.query(Literature)
    
    if status_filter:
        query = query.filter(Literature.status == status_filter)
    if validation_status:
        query = query.filter(Literature.validation_status == validation_status)
    
    literature = query.offset(skip).limit(limit).all()
    return literature

@router.get("/{literature_id}", response_model=LiteratureSchema)
async def get_literature_item(literature_id: int, db: Session = Depends(get_db)):
    """获取单个文献详情"""
    literature = db.query(Literature).filter(Literature.id == literature_id).first()
    if not literature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature not found"
        )
    return literature

@router.post("/", response_model=LiteratureSchema)
async def create_literature(
    literature: LiteratureCreate, 
    db: Session = Depends(get_db)
):
    """手动创建文献记录"""
    db_literature = Literature(**literature.dict())
    db.add(db_literature)
    db.commit()
    db.refresh(db_literature)
    return db_literature

@router.put("/{literature_id}", response_model=LiteratureSchema)
async def update_literature(
    literature_id: int,
    literature_update: LiteratureUpdate,
    db: Session = Depends(get_db)
):
    """更新文献信息"""
    db_literature = db.query(Literature).filter(Literature.id == literature_id).first()
    if not db_literature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature not found"
        )
    
    update_data = literature_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_literature, field, value)
    
    db.commit()
    db.refresh(db_literature)
    return db_literature

@router.delete("/{literature_id}")
async def delete_literature(literature_id: int, db: Session = Depends(get_db)):
    """删除文献"""
    db_literature = db.query(Literature).filter(Literature.id == literature_id).first()
    if not db_literature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature not found"
        )
    
    db.delete(db_literature)
    db.commit()
    return {"message": "Literature deleted successfully"}

@router.post("/upload", response_model=FileUploadResponse)
async def upload_literature_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传Excel文件批量导入文献"""
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
        
        # Expected columns mapping
        column_mapping = {
            'title': ['title', 'Title', '标题', '题目'],
            'authors': ['authors', 'Authors', '作者', 'author'],
            'journal': ['journal', 'Journal', '期刊', '杂志'],
            'year': ['year', 'Year', '年份', 'publication_year'],
            'doi': ['doi', 'DOI'],
            'abstract': ['abstract', 'Abstract', '摘要'],
            'keywords': ['keywords', 'Keywords', '关键词'],
            'citation_count': ['citation_count', 'citations', '引用数']
        }
        
        # Map columns
        mapped_columns = {}
        for standard_col, possible_names in column_mapping.items():
            for col_name in df.columns:
                if col_name in possible_names:
                    mapped_columns[standard_col] = col_name
                    break
        
        if 'title' not in mapped_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title column is required"
            )
        
        for index, row in df.iterrows():
            try:
                literature_data = {}
                
                # Map required fields
                literature_data['title'] = str(row[mapped_columns['title']])[:500]
                
                # Map optional fields
                for field, col_name in mapped_columns.items():
                    if field != 'title' and col_name in df.columns:
                        value = row[col_name]
                        if pd.notna(value):
                            if field == 'year':
                                literature_data[field] = int(value)
                            elif field == 'citation_count':
                                literature_data[field] = int(value) if value else 0
                            else:
                                literature_data[field] = str(value)[:500 if field != 'abstract' else None]
                
                # Create literature record
                db_literature = Literature(**literature_data)
                db.add(db_literature)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 1}: {str(e)}")
        
        db.commit()
        
        return FileUploadResponse(
            message=f"Successfully imported {imported_count} literature records",
            imported_count=imported_count,
            errors=errors
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )

@router.post("/validate", response_model=List[ValidationResult])
async def validate_literature(
    request: ValidationRequest,
    db: Session = Depends(get_db)
):
    """验证文献是否符合要求（调用外部API）"""
    results = []
    
    for literature_id in request.literature_ids:
        literature = db.query(Literature).filter(Literature.id == literature_id).first()
        if not literature:
            results.append(ValidationResult(
                literature_id=literature_id,
                status="error",
                score=None,
                reason="Literature not found"
            ))
            continue
        
        # TODO: 这里应该调用实际的外部API进行验证
        # 现在使用模拟的验证逻辑
        try:
            # 模拟API调用
            validation_score = 0.8  # 模拟分数
            validation_status = "validated" if validation_score > 0.7 else "rejected"
            validation_reason = f"Validation completed with score {validation_score}"
            
            # 更新数据库
            literature.validation_status = validation_status
            literature.validation_score = validation_score
            literature.validation_reason = validation_reason
            
            results.append(ValidationResult(
                literature_id=literature_id,
                status=validation_status,
                score=validation_score,
                reason=validation_reason
            ))
            
        except Exception as e:
            results.append(ValidationResult(
                literature_id=literature_id,
                status="error",
                score=None,
                reason=f"Validation error: {str(e)}"
            ))
    
    db.commit()
    return results

@router.put("/{literature_id}/convert-to-idea")
async def convert_literature_to_idea(
    literature_id: int,
    db: Session = Depends(get_db)
):
    """将文献转换为idea"""
    from ..models import Idea
    
    literature = db.query(Literature).filter(Literature.id == literature_id).first()
    if not literature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature not found"
        )
    
    if literature.validation_status != "validated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Literature must be validated before converting to idea"
        )
    
    # Create idea from literature
    idea_data = {
        'title': literature.title,
        'description': literature.abstract or f"Based on: {literature.title}",
        'source': 'literature',
        'source_literature_id': literature.id,
        'tags': literature.keywords
    }
    
    db_idea = Idea(**idea_data)
    db.add(db_idea)
    
    # Update literature status
    literature.status = "converted_to_idea"
    
    db.commit()
    db.refresh(db_idea)
    
    return {"message": "Literature converted to idea successfully", "idea_id": db_idea.id}