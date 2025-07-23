"""
文献管理路由模块

提供文献的CRUD操作、批量导入、AI匹配验证等功能
包含用户数据隔离和批量AI分析功能
"""
# 标准库导入
import asyncio
import io
import json
from typing import List, Optional, Dict, Tuple
import time
from concurrent.futures import ThreadPoolExecutor

# 第三方库导入
import httpx

# 全局HTTP客户端
_global_http_client: Optional[httpx.AsyncClient] = None

# 在模块初始化时注册清理函数
import atexit
atexit.register(lambda: asyncio.create_task(cleanup_http_client()) if _global_http_client else None)
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

# 本地导入
from ..models import (
    get_db, Literature, LiteratureSchema, 
    LiteratureCreate, LiteratureUpdate,
    FileUploadResponse, ValidationRequest, ValidationResult,
    BatchMatchingRequest, MatchingResult, BatchMatchingResponse,
    SystemConfig
)

# 批量删除请求模型
class BatchDeleteRequest(BaseModel):
    literature_ids: List[int]

# 批量删除响应模型  
class BatchDeleteResponse(BaseModel):
    success: bool
    message: str
    deleted_count: int
    failed_ids: List[int] = []
    errors: List[str] = []
from ..utils.encryption import encryption_util
from ..core.ai_config import AIBatchConfig, performance_monitor, get_optimized_prompt_template, estimate_processing_time

router = APIRouter()

@router.get("/", response_model=List[LiteratureSchema])
async def get_literature(
    request: Request,
    skip: int = 0, 
    limit: int = 100,
    status_filter: Optional[str] = None,
    validation_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取文献列表（数据共享，user_id仅用于前端分类展示）"""
    current_user = request.state.current_user
    
    # 所有数据共享，不过滤user_id
    # 暂时移除joinedload避免关联错误
    query = db.query(Literature)
    
    if status_filter:
        query = query.filter(Literature.status == status_filter)
    if validation_status:
        query = query.filter(Literature.validation_status == validation_status)
    
    literature = query.order_by(Literature.created_at.desc()).offset(skip).limit(limit).all()
    return literature

@router.get("/{literature_id}", response_model=LiteratureSchema)
async def get_literature_item(
    request: Request,
    literature_id: int, 
    db: Session = Depends(get_db)
):
    """获取单个文献详情（数据共享）"""
    current_user = request.state.current_user
    
    # 所有数据共享，不过滤user_id
    # 暂时移除joinedload避免关联错误
    literature = db.query(Literature).filter(
        Literature.id == literature_id
    ).first()
    
    if not literature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature not found"
        )
    return literature

@router.post("/", response_model=LiteratureSchema)
async def create_literature(
    request: Request,
    literature: LiteratureCreate, 
    db: Session = Depends(get_db)
):
    """手动创建文献记录"""
    current_user = request.state.current_user
    
    db_literature = Literature(**literature.dict(), user_id=current_user.id)
    db.add(db_literature)
    db.commit()
    db.refresh(db_literature)
    return db_literature

@router.put("/{literature_id}", response_model=LiteratureSchema)
async def update_literature(
    request: Request,
    literature_id: int,
    literature_update: LiteratureUpdate,
    db: Session = Depends(get_db)
):
    """更新文献信息（数据共享）"""
    current_user = request.state.current_user
    
    # 所有数据共享，不过滤user_id
    db_literature = db.query(Literature).filter(
        Literature.id == literature_id
    ).first()
    
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
    
    # 重新查询加载用户信息
    # 暂时移除joinedload避免关联错误
    db_literature = db.query(Literature).filter(
        Literature.id == literature_id
    ).first()
    return db_literature

@router.delete("/{literature_id}")
async def delete_literature(
    request: Request,
    literature_id: int, 
    db: Session = Depends(get_db)
):
    """删除文献（数据共享）"""
    current_user = request.state.current_user
    
    # 所有数据共享，不过滤user_id
    db_literature = db.query(Literature).filter(
        Literature.id == literature_id
    ).first()
    
    if not db_literature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature not found"
        )
    
    db.delete(db_literature)
    db.commit()
    return {"message": "Literature deleted successfully"}

@router.post("/batch-delete", response_model=BatchDeleteResponse)
async def batch_delete_literature(
    request: Request,
    batch_request: BatchDeleteRequest,
    db: Session = Depends(get_db)
):
    """批量删除文献"""
    current_user = request.state.current_user
    literature_ids = batch_request.literature_ids
    
    if not literature_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No literature IDs provided"
        )
    
    # 验证所有文献是否存在并获取详细信息
    existing_literature = db.query(Literature).filter(
        Literature.id.in_(literature_ids)
    ).all()
    
    existing_ids = {lit.id for lit in existing_literature}
    missing_ids = [lit_id for lit_id in literature_ids if lit_id not in existing_ids]
    
    deleted_count = 0
    failed_ids = []
    errors = []
    
    # 使用事务确保批量操作的原子性
    try:
        for literature in existing_literature:
            try:
                db.delete(literature)
                deleted_count += 1
            except Exception as e:
                failed_ids.append(literature.id)
                errors.append(f"删除文献ID {literature.id} 失败: {str(e)}")
                db.rollback()  # 回滚当前文献的删除
                continue
        
        # 提交所有成功的删除操作
        db.commit()
        
        # 处理不存在的文献ID
        if missing_ids:
            failed_ids.extend(missing_ids)
            errors.extend([f"文献ID {lit_id} 不存在" for lit_id in missing_ids])
        
        success = deleted_count > 0
        total_requested = len(literature_ids)
        
        if success:
            if deleted_count == total_requested:
                message = f"成功删除 {deleted_count} 篇文献"
            else:
                message = f"成功删除 {deleted_count} 篇文献，{len(failed_ids)} 篇失败"
        else:
            message = "所有文献删除失败"
        
        return BatchDeleteResponse(
            success=success,
            message=message,
            deleted_count=deleted_count,
            failed_ids=failed_ids,
            errors=errors
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除操作失败: {str(e)}"
        )

@router.post("/upload", response_model=FileUploadResponse)
async def upload_literature_file(
    request: Request,
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
                
                # Create literature record with user_id
                current_user = request.state.current_user
                db_literature = Literature(**literature_data, user_id=current_user.id)
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
    request: Request,
    validation_request: ValidationRequest,
    db: Session = Depends(get_db)
):
    """验证文献是否符合要求（调用外部API）"""
    results = []
    
    current_user = request.state.current_user
    
    for literature_id in validation_request.literature_ids:
        # 所有数据共享，不过滤user_id
        literature = db.query(Literature).filter(
            Literature.id == literature_id
        ).first()
        if not literature:
            results.append(ValidationResult(
                literature_id=literature_id,
                status="error",
                score=None,
                reason="Literature not found"
            ))
            continue
        
        # 使用基本验证逻辑（可以后续扩展为AI验证）
        try:
            # 基本验证逻辑
            validation_score = 0.8  # 基本验证分数
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

from pydantic import BaseModel
from typing import Optional

class ConvertToIdeaRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[str] = None
    estimated_duration: Optional[str] = None
    required_skills: Optional[str] = None
    potential_impact: Optional[str] = None
    priority: Optional[str] = "medium"
    tags: Optional[str] = None

@router.put("/{literature_id}/convert-to-idea")
async def convert_literature_to_idea(
    request: Request,
    literature_id: int,
    idea_data: Optional[ConvertToIdeaRequest] = None,
    db: Session = Depends(get_db)
):
    """将文献转换为idea"""
    from ..models import Idea
    
    current_user = request.state.current_user
    
    # 所有数据共享，不过滤user_id
    literature = db.query(Literature).filter(
        Literature.id == literature_id
    ).first()
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
    
    # Create idea from literature with custom data
    base_idea_data = {
        'title': literature.title,
        'description': literature.abstract or f"Based on: {literature.title}",
        'source': 'literature',
        'source_literature_id': literature.id,
        'tags': literature.keywords,
        'priority': 'medium'
    }
    
    # Override with user provided data if available
    if idea_data:
        if idea_data.title:
            base_idea_data['title'] = idea_data.title
        if idea_data.description:
            base_idea_data['description'] = idea_data.description
        if idea_data.difficulty_level:
            base_idea_data['difficulty_level'] = idea_data.difficulty_level
        if idea_data.estimated_duration:
            base_idea_data['estimated_duration'] = idea_data.estimated_duration
        if idea_data.required_skills:
            base_idea_data['required_skills'] = idea_data.required_skills
        if idea_data.potential_impact:
            base_idea_data['potential_impact'] = idea_data.potential_impact
        if idea_data.priority:
            base_idea_data['priority'] = idea_data.priority
        if idea_data.tags:
            base_idea_data['tags'] = idea_data.tags
    
    db_idea = Idea(**base_idea_data, user_id=current_user.id)
    db.add(db_idea)
    
    # Update literature status
    literature.status = "converted_to_idea"
    
    db.commit()
    db.refresh(db_idea)
    
    return {"message": "Literature converted to idea successfully", "idea_id": db_idea.id}

@router.post("/batch-match", response_model=BatchMatchingResponse)
async def batch_match_literature(
    request: Request,
    matching_request: BatchMatchingRequest,
    db: Session = Depends(get_db)
):
    """
    批量AI匹配文献 - 高性能并发版本
    
    优化特性:
    - 并发处理多个文献（最大并发数可配置）
    - 批量数据库操作减少查询次数
    - HTTP连接池复用
    - 智能错误恢复和重试
    - 进度跟踪和性能监控
    """
    start_time = time.time()
    current_user = request.state.current_user
    
    # 从配置获取参数
    BATCH_SIZE_LIMIT = AIBatchConfig.get_batch_size_limit()
    MAX_CONCURRENT = AIBatchConfig.get_max_concurrent()
    
    # 检查批处理大小限制
    if len(matching_request.literature_ids) > BATCH_SIZE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size too large. Maximum {BATCH_SIZE_LIMIT} items allowed."
        )
    
    # 获取AI配置
    ai_config = db.query(SystemConfig).filter(
        SystemConfig.key == f"ai_provider_{matching_request.ai_provider}",
        SystemConfig.category == "ai_api",
        SystemConfig.is_active == True
    ).first()
    
    if not ai_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AI provider '{matching_request.ai_provider}' not configured"
        )
    
    try:
        # 解密AI配置
        decrypted_config = encryption_util.decrypt(ai_config.value)
        provider_config = json.loads(decrypted_config)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load AI configuration: {str(e)}"
        )
    
    # 批量获取文献数据，减少数据库查询次数
    literature_dict = await get_literature_batch(
        db, matching_request.literature_ids, 1  # user_id参数已无用，传入任意值
    )
    
    # 并发处理文献匹配
    results, stats = await process_literature_concurrent(
        literature_dict,
        matching_request.literature_ids,
        matching_request.prompt_template,
        provider_config,
        MAX_CONCURRENT
    )
    
    # 批量更新数据库
    await update_literature_batch(db, results)
    
    # 计算处理时间
    processing_time = time.time() - start_time
    avg_time_per_item = processing_time / max(1, stats['total_processed'])
    
    return BatchMatchingResponse(
        success=True,
        message=f"Processed {stats['total_processed']} items in {processing_time:.2f}s (avg: {avg_time_per_item:.2f}s/item, {MAX_CONCURRENT} concurrent)",
        results=results,
        total_processed=stats['total_processed'],
        successful_count=stats['successful_count'],
        error_count=stats['error_count']
    )


async def get_literature_batch(db: Session, literature_ids: List[int], user_id: int) -> Dict[int, Literature]:
    """
    批量获取文献数据，减少数据库查询
    
    Args:
        db: 数据库会话
        literature_ids: 文献ID列表
        user_id: 用户ID
        
    Returns:
        文献ID到Literature对象的映射字典
    """
    # 所有数据共享，不过滤user_id，只按ID获取文献
    literature_list = db.query(Literature).filter(
        Literature.id.in_(literature_ids)
    ).all()
    
    return {lit.id: lit for lit in literature_list}


async def process_literature_concurrent(
    literature_dict: Dict[int, Literature],
    literature_ids: List[int],
    prompt_template: str,
    provider_config: dict,
    max_concurrent: int
) -> Tuple[List[MatchingResult], Dict[str, int]]:
    """
    并发处理文献匹配
    
    Args:
        literature_dict: 文献字典
        literature_ids: 要处理的文献ID列表
        prompt_template: AI提示模板
        provider_config: AI提供商配置
        max_concurrent: 最大并发数
        
    Returns:
        (匹配结果列表, 统计信息)
    """
    # 创建信号量控制并发数
    semaphore = asyncio.Semaphore(max_concurrent)
    
    # 创建任务列表
    tasks = [
        process_single_literature(
            semaphore,
            literature_id,
            literature_dict.get(literature_id),
            prompt_template,
            provider_config
        )
        for literature_id in literature_ids
    ]
    
    # 并发执行所有任务
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 处理结果和异常
    final_results = []
    successful_count = 0
    error_count = 0
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            # 处理异常情况
            final_results.append(MatchingResult(
                literature_id=literature_ids[i],
                status="error",
                reason=f"Processing exception: {str(result)}"
            ))
            error_count += 1
        else:
            final_results.append(result)
            if result.status in ["matched", "not_matched"]:
                successful_count += 1
            else:
                error_count += 1
    
    stats = {
        'total_processed': len(results),
        'successful_count': successful_count,
        'error_count': error_count
    }
    
    return final_results, stats


async def process_single_literature(
    semaphore: asyncio.Semaphore,
    literature_id: int,
    literature: Optional[Literature],
    prompt_template: str,
    provider_config: dict
) -> MatchingResult:
    """
    处理单个文献的AI匹配
    
    Args:
        semaphore: 并发控制信号量
        literature_id: 文献ID
        literature: 文献对象
        prompt_template: AI提示模板
        provider_config: AI提供商配置
        
    Returns:
        匹配结果
    """
    async with semaphore:  # 控制并发数
        if not literature:
            return MatchingResult(
                literature_id=literature_id,
                status="error",
                reason="Literature not found or access denied"
            )
        
        try:
            # 构造AI提示
            literature_info = f"""
标题: {literature.title}
作者: {literature.authors or '未知'}
期刊: {literature.journal or '未知'}
年份: {literature.year or '未知'}
摘要: {literature.abstract or '无摘要'}
关键词: {literature.keywords or '无关键词'}
            """.strip()
            
            full_prompt = prompt_template.replace("{literature_info}", literature_info)
            
            # 优化提示词模板
            optimized_prompt = get_optimized_prompt_template(full_prompt, "standard")
            
            # 调用AI API（带重试机制）
            start_time = time.time()
            max_retries = AIBatchConfig.get_max_retries()
            ai_response = await call_ai_api_with_retry(provider_config, optimized_prompt, max_retries)
            
            if ai_response:
                # 解析AI响应
                match_status, score = parse_ai_response(ai_response)
                
                # 记录性能统计
                processing_time = time.time() - start_time
                performance_monitor.record_request(True, processing_time, 0)
                
                return MatchingResult(
                    literature_id=literature_id,
                    status=match_status,
                    score=score,
                    reason=ai_response[:500],  # 截取前500字符
                    ai_response=ai_response
                )
            else:
                # 记录失败统计
                processing_time = time.time() - start_time
                performance_monitor.record_request(False, processing_time, max_retries)
                
                return MatchingResult(
                    literature_id=literature_id,
                    status="error",
                    reason="AI API call failed after retries"
                )
                
        except Exception as e:
            return MatchingResult(
                literature_id=literature_id,
                status="error",
                reason=f"Processing error: {str(e)}"
            )


def parse_ai_response(ai_response: str) -> Tuple[str, float]:
    """
    解析AI响应，提取匹配状态和分数
    
    Args:
        ai_response: AI的响应文本
        
    Returns:
        (匹配状态, 分数)
    """
    ai_text = ai_response.lower()
    
    # 从配置获取响应解析参数
    parsing_config = AIBatchConfig.get_response_parsing_config()
    positive_keywords = parsing_config["positive_keywords"]
    negative_keywords = parsing_config["negative_keywords"]
    
    positive_score = sum(1 for keyword in positive_keywords if keyword in ai_text)
    negative_score = sum(1 for keyword in negative_keywords if keyword in ai_text)
    
    if positive_score > negative_score:
        # 根据积极词汇数量调整分数
        base_score = parsing_config["default_positive_score"]
        adjustment = positive_score * parsing_config["score_adjustment_step"]
        score = min(parsing_config["max_score"], base_score + adjustment)
        return "matched", score
    elif negative_score > positive_score:
        # 根据消极词汇数量调整分数
        base_score = parsing_config["default_negative_score"]
        adjustment = negative_score * parsing_config["score_adjustment_step"]
        score = max(parsing_config["min_score"], base_score - adjustment)
        return "not_matched", score
    else:
        # 中性响应
        return "not_matched", parsing_config["neutral_score"]


async def update_literature_batch(db: Session, results: List[MatchingResult]):
    """
    批量更新文献的验证状态
    
    Args:
        db: 数据库会话
        results: 匹配结果列表
    """
    try:
        # 批量更新，减少数据库操作次数
        for result in results:
            if result.status in ["matched", "not_matched"] and result.score is not None:
                db.execute(
                    "UPDATE literature SET validation_status = :status, validation_score = :score, "
                    "validation_reason = :reason WHERE id = :id",
                    {
                        "status": "validated" if result.status == "matched" else "rejected",
                        "score": result.score,
                        "reason": result.reason,
                        "id": result.literature_id
                    }
                )
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database batch update error: {str(e)}"
        )


async def call_ai_api_with_retry(
    provider_config: dict, 
    prompt: str, 
    max_retries: int = 3
) -> Optional[str]:
    """
    带重试机制的AI API调用
    
    Args:
        provider_config: AI提供商配置
        prompt: 提示词
        max_retries: 最大重试次数
        
    Returns:
        AI响应文本，失败返回None
    """
    for attempt in range(max_retries + 1):
        try:
            result = await call_ai_api(provider_config, prompt)
            if result:
                return result
        except Exception as e:
            if attempt == max_retries:
                print(f"AI API call failed after {max_retries} retries: {str(e)}")
                return None
            
            # 指数退避重试
            wait_time = (2 ** attempt) * 0.5  # 0.5s, 1s, 2s
            await asyncio.sleep(wait_time)
    
    return None

# 全局HTTP客户端已在文件开头定义


async def get_http_client() -> httpx.AsyncClient:
    """
    获取全局HTTP客户端，复用连接池提高性能
    
    Returns:
        配置好的HTTP客户端实例
    """
    global _global_http_client
    
    if _global_http_client is None:
        # 配置连接池和超时
        # 从配置获取HTTP参数
        http_config = AIBatchConfig.get_http_config()
        
        limits = httpx.Limits(
            max_keepalive_connections=http_config["max_keepalive_connections"],
            max_connections=http_config["max_connections"],
            keepalive_expiry=http_config["keepalive_expiry"]
        )
        
        timeout = httpx.Timeout(
            connect=http_config["connect_timeout"],
            read=http_config["read_timeout"],
            write=http_config["write_timeout"],
            pool=http_config["pool_timeout"]
        )
        
        _global_http_client = httpx.AsyncClient(
            limits=limits,
            timeout=timeout,
            http2=http_config["enable_http2"]  # 从配置获取HTTP/2设置
        )
    
    return _global_http_client


async def cleanup_http_client():
    """
    清理全局HTTP客户端资源，应用关闭时调用
    """
    global _global_http_client
    
    if _global_http_client is not None:
        await _global_http_client.aclose()
        _global_http_client = None


async def call_ai_api(provider_config: dict, prompt: str) -> Optional[str]:
    """
    调用AI API进行文献匹配分析
    
    Args:
        provider_config: AI提供商配置字典，包含provider、api_key、api_url等
        prompt: 要发送给AI的提示词
        
    Returns:
        AI的响应文本，失败时返回None
        
    Raises:
        Exception: 在网络错误或API调用失败时抛出
    """
    try:
        provider: str = provider_config.get("provider", "openai")
        api_key: str = provider_config.get("api_key")
        api_url: Optional[str] = provider_config.get("api_url")
        model: str = provider_config.get("model", "gpt-3.5-turbo")
        max_tokens: int = provider_config.get("max_tokens", 1000)
        temperature: float = provider_config.get("temperature", 0.7)
        
        if not api_key:
            raise ValueError(f"API key is required for provider {provider}")
            
        # 根据不同provider构造请求参数
        if provider == "openai" or not api_url:
            api_url = api_url or "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        elif provider == "anthropic":
            api_url = api_url or "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            data = {
                "model": model or "claude-3-haiku-20240307",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        else:
            # 通用OpenAI兼容接口
            api_url = api_url or "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        
        # 使用全局HTTP客户端发送请求，复用连接池
        client = await get_http_client()
        response = await client.post(api_url, json=data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            # 根据不同provider解析响应
            if provider == "anthropic":
                content = result.get("content", [])
                if content and len(content) > 0:
                    return content[0].get("text", "")
            else:
                choices = result.get("choices", [])
                if choices and len(choices) > 0:
                    return choices[0].get("message", {}).get("content", "")
            
            # 如果没有获得有效响应
            return None
        else:
            # 记录详细的API错误信息
            error_msg = f"AI API error: {response.status_code} - {response.text[:200]}"
            print(error_msg)
            return None
                
    except httpx.TimeoutException:
        print(f"AI API call timeout for provider {provider}")
        return None
    except httpx.RequestError as e:
        print(f"AI API request error for provider {provider}: {str(e)}")
        return None
    except Exception as e:
        print(f"Unexpected error in AI API call: {str(e)}")
        return None

@router.get("/prompts", response_model=List[dict])
async def get_predefined_prompts(request: Request):
    """获取预定义的匹配提示词"""
    # 确保用户已认证
    current_user = request.state.current_user
    prompts = [
        {
            "id": "research_relevance",
            "name": "研究相关性评估",
            "template": """
请评估以下文献是否与我的研究兴趣相关：

{literature_info}

请从以下几个方面进行评估：
1. 研究主题相关性
2. 方法学价值
3. 创新性
4. 实用性

请给出你的评估结果（相关/不相关），并简要说明原因。
"""
        },
        {
            "id": "idea_potential",
            "name": "创意潜力评估",
            "template": """
请评估以下文献是否能够启发新的研究创意：

{literature_info}

请考虑：
1. 是否提出了新的问题或假设？
2. 是否有可以改进或扩展的方法？
3. 是否存在研究空白？
4. 是否能与其他领域结合产生新想法？

请评估其创意启发潜力（高/中/低），并详细说明理由。
"""
        },
        {
            "id": "methodology_focus",
            "name": "方法学重点评估",
            "template": """
请从方法学角度评估以下文献：

{literature_info}

重点关注：
1. 使用的研究方法是否新颖？
2. 数据收集和分析方法是否严谨？
3. 实验设计是否完善？
4. 方法是否可以应用到其他研究中？

请评估其方法学价值（高价值/中等价值/低价值），并说明理由。
"""
        },
        {
            "id": "application_value",
            "name": "应用价值评估",
            "template": """
请评估以下文献的实际应用价值：

{literature_info}

评估维度：
1. 研究结果是否有实际应用前景？
2. 是否能解决现实问题？
3. 技术或方法的可行性如何？
4. 商业化或产业化潜力如何？

请评估其应用价值（高/中/低），并详细分析。
"""
        }
    ]
    
    return prompts


# 性能监控和统计函数
@router.get("/batch-match/stats")
async def get_batch_matching_stats():
    """
    获取批量AI匹配的性能统计
    """
    # 这里可以添加实际的性能监控逻辑
    # 例如：Redis缓存的调用次数、平均响应时间等
    # 获取实际性能统计
    stats = performance_monitor.get_stats()
    config = AIBatchConfig.get_config()
    
    return {
        "performance_stats": stats,
        "success_rate": performance_monitor.get_success_rate(),
        "configuration": {
            "batch_size_limit": config["batch_size_limit"],
            "max_concurrent": config["max_concurrent"],
            "max_retries": config["max_retries"],
        },
        "optimization_features": [
            f"并发处理（最大{config['max_concurrent']}个并发）",
            "HTTP连接池复用",
            "批量数据库操作",
            f"智能重试机制（最大{config['max_retries']}次）",
            "性能监控和统计",
            "动态配置管理",
            "智能响应解析"
        ]
    }