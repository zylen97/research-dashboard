from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import pandas as pd
import io
import asyncio
from datetime import datetime

from app.models.database import get_db
from app.utils.response import success_response
from app.utils.auth import get_current_user
from app.models.schemas import User
from app.services.ai_service import create_ai_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ProcessExcelRequest(BaseModel):
    """处理Excel请求模型"""
    ai_provider: str = "openai"
    custom_prompt: Optional[str] = None

class ProcessExcelResponse(BaseModel):
    """处理Excel响应模型"""
    success: bool
    message: str
    processing_time: float
    rows_processed: int
    ai_provider_used: str

@router.post("/process-excel")
async def process_excel_file(
    file: UploadFile = File(...),
    ai_provider: str = "openai",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    简化的Excel处理端点
    直接上传Excel -> AI处理 -> 返回增强Excel
    """
    start_time = datetime.now()
    
    try:
        # 1. 验证文件类型
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400, 
                detail="仅支持Excel文件格式 (.xlsx, .xls)"
            )
        
        # 2. 读取Excel文件
        file_content = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件解析失败: {str(e)}"
            )
        
        # 3. 验证必需列存在
        required_columns = ['摘要', '标题']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件缺少必需的列: {', '.join(missing_columns)}。需要包含'摘要'和'标题'列。"
            )
        
        # 4. 创建AI服务实例
        ai_service = create_ai_service(db)
        
        # 5. 为每行数据生成AI建议
        suggestions = []
        processed_count = 0
        
        for index, row in df.iterrows():
            try:
                # 构建AI提示内容
                title = str(row['标题']) if pd.notna(row['标题']) else ""
                abstract = str(row['摘要']) if pd.notna(row['摘要']) else ""
                
                if not title and not abstract:
                    suggestions.append("数据不完整，无法生成建议")
                    continue
                
                # 构建数据内容
                data_content = f"标题: {title}\n摘要: {abstract}"
                
                # 自定义提示词，专注于研究迁移建议
                custom_prompt = """
基于提供的文献标题和摘要，请生成一个简洁的研究迁移建议。

要求：
1. 分析该研究的核心技术或方法
2. 建议如何将其应用到其他领域或问题
3. 提出具体的迁移方向或应用场景
4. 建议控制在50-100字内

请直接给出建议内容，不需要格式化或额外说明。
"""
                
                # 调用AI服务
                ai_result = await ai_service.generate_research_suggestions(
                    provider_name=ai_provider,
                    data_content=data_content,
                    custom_prompt=custom_prompt
                )
                
                if ai_result['success']:
                    suggestion = ai_result['response'].strip()
                    # 确保建议不超过150字
                    if len(suggestion) > 150:
                        suggestion = suggestion[:147] + "..."
                    suggestions.append(suggestion)
                else:
                    suggestions.append(f"AI处理失败: {ai_result.get('error', '未知错误')}")
                
                processed_count += 1
                
                # 添加小延迟避免API限流
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"处理第{index+1}行时出错: {str(e)}")
                suggestions.append(f"处理出错: {str(e)}")
        
        # 6. 添加AI建议列到DataFrame
        column_name = f"迁移意见by{ai_provider}"
        df[column_name] = suggestions
        
        # 7. 生成增强的Excel文件
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, engine='openpyxl')
        excel_buffer.seek(0)
        
        # 8. 计算处理时间
        processing_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"成功处理Excel文件: {file.filename}, 处理行数: {processed_count}, 耗时: {processing_time:.2f}秒")
        
        # 9. 返回增强的Excel文件
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                "Content-Disposition": f"attachment; filename=enhanced_{file.filename}",
                "X-Processing-Time": str(processing_time),
                "X-Rows-Processed": str(processed_count),
                "X-AI-Provider": ai_provider
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Excel处理失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"处理失败: {str(e)}"
        )

@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "service": "idea_discovery_simple"}