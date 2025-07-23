from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import pandas as pd
import io
import json
import tempfile
import os
import asyncio
from datetime import datetime

from app.models.database import get_db
from app.utils.response import success_response
from app.utils.auth import get_current_user
from app.models.schemas import User
from app.services.ai_service import create_ai_service

router = APIRouter()

class ProcessingStatus(BaseModel):
    """处理状态模型"""
    current_step: int
    total_steps: int
    status: str  # 'processing', 'completed', 'error'
    message: str
    progress: float

class FileUploadResponse(BaseModel):
    """文件上传响应模型"""
    success: bool
    message: str
    file_id: str
    file_name: str
    file_size: int
    columns: List[str]
    row_count: int

class ProcessingRequest(BaseModel):
    """处理请求模型"""
    file_id: str
    ai_provider: str = "openai"
    prompt_template: Optional[str] = None

class ProcessingResult(BaseModel):
    """处理结果模型"""
    success: bool
    message: str
    result_file_id: str
    processing_time: float
    enhanced_data: Dict[str, Any]

# 临时存储处理中的文件和状态
processing_storage = {}
file_storage = {}

# 配置类
class IdeaDiscoveryConfig:
    """
    Idea发掘功能配置类
    
    集中管理所有与Idea发掘功能相关的配置参数，
    便于维护和调整处理流程中的各项设置。
    """
    
    # 文件管理配置
    FILE_EXPIRY_HOURS = 2  # 临时文件保存时长（小时）
    
    # 处理流程配置
    TOTAL_PROCESSING_STEPS = 4  # 总处理步骤数
    
    # 处理步骤进度映射（步骤编号 -> 进度百分比）
    STEP_PROGRESS = {
        1: 25.0,  # CSV转换完成进度
        2: 50.0,  # AI分析完成进度
        3: 75.0,  # 数据增强完成进度
        4: 100.0  # 全部处理完成
    }
    
    # 处理步骤状态消息（步骤编号 -> 状态描述）
    STEP_MESSAGES = {
        1: '正在将Excel转换为CSV格式...',
        2: '正在使用AI分析数据并生成研究建议...',
        3: '正在生成增强的数据集...',
        4: '处理完成！'
    }
    
    # AI处理配置
    SAMPLE_DATA_ROWS = 10  # 发送给AI分析的样本数据行数（避免超出API限制）

config = IdeaDiscoveryConfig()

def cleanup_expired_files():
    """清理过期的临时文件"""
    try:
        current_time = datetime.now()
        expired_files = []
        
        for file_id, file_data in file_storage.items():
            upload_time = file_data.get('upload_time', current_time)
            if (current_time - upload_time).total_seconds() > config.FILE_EXPIRY_HOURS * 3600:
                expired_files.append(file_id)
        
        for file_id in expired_files:
            del file_storage[file_id]
            
        # 同时清理相关的处理状态
        expired_processing = []
        for proc_id in processing_storage.keys():
            if any(proc_id.endswith(file_id.replace('excel_', '')) for file_id in expired_files):
                expired_processing.append(proc_id)
                
        for proc_id in expired_processing:
            del processing_storage[proc_id]
            
        if expired_files:
            logger.info(f"Cleaned up {len(expired_files)} expired files")
            
    except Exception as e:
        logger.error(f"Error during file cleanup: {e}")

# 导入logger
import logging
logger = logging.getLogger(__name__)

@router.post("/upload", response_model=FileUploadResponse)
async def upload_excel_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    上传Excel文件并进行初步解析
    """
    # 清理过期文件
    cleanup_expired_files()
    
    try:
        # 验证文件类型
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400, 
                detail="仅支持Excel文件格式 (.xlsx, .xls)"
            )
        
        # 读取文件内容
        file_content = await file.read()
        
        # 使用pandas读取Excel文件
        try:
            # 尝试读取Excel文件
            df = pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件解析失败: {str(e)}"
            )
        
        # 生成文件ID
        file_id = f"excel_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
        
        # 存储文件数据到内存（临时存储）
        file_storage[file_id] = {
            'original_filename': file.filename,
            'dataframe': df,
            'upload_time': datetime.now(),
            'user_id': current_user.id
        }
        
        return FileUploadResponse(
            success=True,
            message="文件上传成功",
            file_id=file_id,
            file_name=file.filename,
            file_size=len(file_content),
            columns=df.columns.tolist(),
            row_count=len(df)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"文件上传失败: {str(e)}"
        )

@router.post("/process", response_model=Dict[str, Any])
async def start_processing(
    request: ProcessingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    开始处理Excel文件：转换为CSV -> AI分析 -> 生成增强Excel
    """
    try:
        # 检查文件是否存在
        if request.file_id not in file_storage:
            raise HTTPException(
                status_code=404,
                detail="文件不存在或已过期"
            )
        
        file_data = file_storage[request.file_id]
        
        # 验证用户权限
        if file_data['user_id'] != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="无权限访问此文件"
            )
        
        # 初始化处理状态
        processing_id = f"proc_{request.file_id}"
        processing_storage[processing_id] = ProcessingStatus(
            current_step=0,
            total_steps=config.TOTAL_PROCESSING_STEPS,
            status='processing',
            message='准备开始处理...',
            progress=0.0
        )
        
        # 添加后台任务进行实际处理
        background_tasks.add_task(
            process_file_background,
            processing_id,
            request,
            file_data,
            current_user.id
        )
        
        return success_response(
            message="处理任务已启动",
            data={
                "processing_id": processing_id,
                "status": "started"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"启动处理失败: {str(e)}"
        )

@router.get("/status/{processing_id}", response_model=ProcessingStatus)
async def get_processing_status(
    processing_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    获取处理状态
    """
    if processing_id not in processing_storage:
        raise HTTPException(
            status_code=404,
            detail="处理任务不存在"
        )
    
    return processing_storage[processing_id]

@router.get("/download/{result_file_id}")
async def download_result_file(
    result_file_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    下载处理结果文件
    """
    try:
        # 检查结果文件是否存在
        if result_file_id not in file_storage:
            raise HTTPException(
                status_code=404,
                detail="结果文件不存在或已过期"
            )
        
        file_data = file_storage[result_file_id]
        
        # 验证用户权限
        if file_data['user_id'] != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="无权限下载此文件"
            )
        
        # 获取增强后的数据
        enhanced_df = file_data['dataframe']
        
        # 使用内存中的字节流代替临时文件
        from io import BytesIO
        
        # 创建内存中的Excel文件
        excel_buffer = BytesIO()
        enhanced_df.to_excel(excel_buffer, index=False, engine='openpyxl')
        excel_buffer.seek(0)
        
        # 返回流式响应
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                "Content-Disposition": f"attachment; filename=enhanced_{file_data['original_filename']}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"文件下载失败: {str(e)}"
        )

def update_processing_status(processing_id: str, step: int, status: str, message: str = None, progress: float = None):
    """
    更新处理状态的辅助函数
    
    Args:
        processing_id: 处理任务的唯一标识符
        step: 当前处理步骤编号（1-4）
        status: 处理状态（'processing', 'completed', 'error'）
        message: 可选的自定义状态消息，不提供时使用配置的默认消息
        progress: 可选的自定义进度百分比，不提供时使用配置的默认进度
    """
    # 如果没有提供消息和进度，从配置中获取
    if message is None:
        message = config.STEP_MESSAGES.get(step, f'处理步骤 {step}')
    if progress is None:
        progress = config.STEP_PROGRESS.get(step, 0.0)
        
    processing_storage[processing_id] = ProcessingStatus(
        current_step=step,
        total_steps=config.TOTAL_PROCESSING_STEPS,
        status=status,
        message=message,
        progress=progress
    )

async def convert_to_csv(processing_id: str, df: pd.DataFrame) -> str:
    """
    步骤1: 转换Excel为CSV格式
    
    Args:
        processing_id: 处理任务ID
        df: pandas DataFrame对象，包含原始Excel数据
        
    Returns:
        str: CSV格式的字符串数据
    """
    update_processing_status(processing_id, 1, 'processing')
    await asyncio.sleep(1)
    csv_string = df.to_csv(index=False)
    return csv_string

async def process_with_ai(processing_id: str, df: pd.DataFrame, request: ProcessingRequest, db: Session) -> Dict[str, List[str]]:
    """
    步骤2: 使用AI分析数据并生成研究建议
    
    Args:
        processing_id: 处理任务ID
        df: pandas DataFrame对象
        request: 处理请求对象，包含AI提供商和提示模板
        db: 数据库会话对象
        
    Returns:
        Dict[str, List[str]]: AI分析结果，包含建议、评分和理由
    """
    update_processing_status(processing_id, 2, 'processing')
    
    # 创建AI服务实例
    ai_service = create_ai_service(db)
    
    # 准备数据摘要
    sample_data = df.head(min(config.SAMPLE_DATA_ROWS, len(df))).to_string()
    data_summary = f"数据包含{len(df)}行，{len(df.columns)}列。\n\n列名：{', '.join(df.columns.tolist())}\n\n示例数据：\n{sample_data}"
    
    # 调用AI服务
    ai_result = await ai_service.generate_research_suggestions(
        provider_name=request.ai_provider or 'openai',
        data_content=data_summary,
        custom_prompt=request.prompt_template
    )
    
    if not ai_result['success']:
        raise Exception(f"AI处理失败: {ai_result.get('error', 'Unknown error')}")
    
    # 解析AI响应
    ai_suggestions = ai_service.parse_ai_response(ai_result['response'], len(df))
    return ai_suggestions

async def enhance_dataframe(processing_id: str, df: pd.DataFrame, ai_suggestions: Dict[str, List[str]]) -> pd.DataFrame:
    """
    步骤3: 生成增强数据集，将AI建议添加到原始数据中
    
    Args:
        processing_id: 处理任务ID
        df: 原始 pandas DataFrame
        ai_suggestions: AI分析结果字典
        
    Returns:
        pd.DataFrame: 增强后的DataFrame，包含原始数据和AI建议列
    """
    update_processing_status(processing_id, 3, 'processing')
    await asyncio.sleep(1)
    
    # 添加AI建议列到原数据
    enhanced_df = df.copy()
    enhanced_df['AI研究建议'] = ai_suggestions['suggestions']
    enhanced_df['相关性评分'] = ai_suggestions['relevance_scores']
    enhanced_df['推荐理由'] = ai_suggestions['reasons']
    
    return enhanced_df

def store_result_file(processing_id: str, enhanced_df: pd.DataFrame, file_data: Dict[str, Any], user_id: int) -> str:
    """
    步骤4: 存储结果文件到内存缓存
    
    Args:
        processing_id: 处理任务ID
        enhanced_df: 增强后的DataFrame
        file_data: 原始文件数据
        user_id: 用户ID
        
    Returns:
        str: 结果文件ID，用于后续下载
    """
    update_processing_status(processing_id, 4, 'completed')
    
    result_file_id = f"result_{processing_id}"
    file_storage[result_file_id] = {
        'original_filename': file_data['original_filename'],
        'dataframe': enhanced_df,
        'upload_time': datetime.now(),
        'user_id': user_id,
        'type': 'result'
    }
    
    # 更新处理状态，添加结果文件ID
    processing_storage[processing_id].message = f"处理完成！结果文件ID: {result_file_id}"
    return result_file_id

async def process_file_background(
    processing_id: str,
    request: ProcessingRequest,
    file_data: Dict[str, Any],
    user_id: int
):
    """
    后台处理文件的主流程 - 重构后的版本
    """
    db = None
    try:
        # 获取数据库连接
        from app.models.database import SessionLocal
        db = SessionLocal()
        
        # 获取原始数据
        df = file_data['dataframe']
        
        # 执行处理步骤
        csv_string = await convert_to_csv(processing_id, df)
        ai_suggestions = await process_with_ai(processing_id, df, request, db)
        enhanced_df = await enhance_dataframe(processing_id, df, ai_suggestions)
        result_file_id = store_result_file(processing_id, enhanced_df, file_data, user_id)
        
        logger.info(f"File processing completed successfully: {result_file_id}")
        
    except Exception as e:
        logger.error(f"File processing failed for {processing_id}: {str(e)}")
        # 处理失败时更新状态
        current_step = processing_storage.get(processing_id, ProcessingStatus(0, 4, 'error', '', 0.0)).current_step
        update_processing_status(processing_id, current_step, 'error', f'处理失败: {str(e)}', 0.0)
    finally:
        if db:
            db.close()


@router.delete("/cleanup/{file_id}")
async def cleanup_file(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    清理临时文件
    """
    try:
        if file_id in file_storage:
            file_data = file_storage[file_id]
            if file_data['user_id'] == current_user.id:
                del file_storage[file_id]
                
        # 同时清理相关的处理状态
        processing_id = f"proc_{file_id}"
        if processing_id in processing_storage:
            del processing_storage[processing_id]
            
        return success_response(
            message="文件清理完成"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"文件清理失败: {str(e)}"
        )