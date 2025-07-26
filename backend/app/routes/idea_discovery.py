from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Form
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
    custom_prompt: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    智能Excel处理端点（使用系统配置的AI）
    自动使用系统配置的AI提供商处理Excel文件
    直接上传Excel -> AI自动处理 -> 返回增强Excel
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
        logger.info(f"开始处理Excel文件: {file.filename}, 文件大小: {len(file_content)} bytes")
        ai_service = create_ai_service(db)
        
        # 5. 检查AI配置状态
        logger.info("检查AI配置状态...")
        main_config = await ai_service.get_main_ai_config()
        if not main_config:
            error_msg = "AI未配置，请先在页面左侧的AI配置中填写API密钥并测试连接"
            logger.error(error_msg)
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        logger.info(f"找到AI配置: model={main_config.get('model')}, api_url={main_config.get('api_url')}, is_connected={main_config.get('is_connected')}")
        
        if not main_config.get('is_connected'):
            error_msg = f"AI连接未测试通过，请在页面左侧点击'测试连接'按钮确保API可用 (当前状态: is_connected={main_config.get('is_connected')})"
            logger.warning(error_msg)
            # 不立即抛出异常，而是尝试继续处理，让AI服务自己决定是否能调用
            logger.info("忽略连接状态检查，尝试直接调用AI服务...")
        
        # 获取AI模型名称用于文件列名
        ai_model_name = main_config.get('model', 'default')
        
        # 6. 为每行数据生成AI建议
        logger.info(f"开始为 {len(df)} 行数据生成AI建议...")
        suggestions = []
        processed_count = 0
        error_count = 0
        
        for index, row in df.iterrows():
            try:
                logger.debug(f"处理第 {index+1}/{len(df)} 行数据...")
                
                # 构建AI提示内容
                title = str(row['标题']) if pd.notna(row['标题']) else ""
                abstract = str(row['摘要']) if pd.notna(row['摘要']) else ""
                
                if not title and not abstract:
                    logger.warning(f"第{index+1}行数据不完整，跳过")
                    suggestions.append("数据不完整，无法生成建议")
                    continue
                
                # 构建数据内容
                data_content = f"标题: {title}\n摘要: {abstract}"
                
                # 使用自定义提示词或默认提示词
                default_prompt = """
基于提供的文献标题和摘要，请生成一个简洁的研究迁移建议。

要求：
1. 分析该研究的核心技术或方法
2. 建议如何将其应用到其他领域或问题
3. 提出具体的迁移方向或应用场景
4. 建议控制在50-100字内

请直接给出建议内容，不需要格式化或额外说明。
"""
                
                # 使用用户自定义的prompt，如果没有则使用默认prompt
                prompt_to_use = custom_prompt if custom_prompt else default_prompt
                
                logger.debug(f"使用的prompt类型: {'自定义' if custom_prompt else '默认'}")
                if custom_prompt:
                    logger.debug(f"自定义prompt长度: {len(custom_prompt)}字符")
                
                # 调用AI服务（自动模式）
                logger.debug(f"调用AI服务处理第{index+1}行...")
                ai_result = await ai_service.generate_research_suggestions_auto(
                    data_content=data_content,
                    custom_prompt=prompt_to_use
                )
                
                if ai_result['success']:
                    suggestion = ai_result['response'].strip()
                    # 确保建议不超过150字
                    if len(suggestion) > 150:
                        suggestion = suggestion[:147] + "..."
                    suggestions.append(suggestion)
                    logger.debug(f"第{index+1}行处理成功，建议长度: {len(suggestion)}")
                else:
                    error_msg = ai_result.get('error', '未知错误')
                    logger.error(f"第{index+1}行AI处理失败: {error_msg}")
                    suggestions.append(f"AI处理失败: {error_msg}")
                    error_count += 1
                
                processed_count += 1
                
                # 添加小延迟避免API限流
                await asyncio.sleep(0.1)
                
            except Exception as e:
                error_msg = f"处理第{index+1}行时发生异常: {str(e)}"
                logger.error(error_msg)
                suggestions.append(f"处理出错: {str(e)}")
                error_count += 1
        
        logger.info(f"数据处理完成: 总共{len(df)}行，成功{processed_count - error_count}行，失败{error_count}行")
        
        # 7. 添加AI建议列到DataFrame
        # 使用模型名称作为列名
        column_name = f"迁移意见by{ai_model_name}"
        df[column_name] = suggestions
        
        # 8. 生成增强的Excel文件
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, engine='openpyxl')
        excel_buffer.seek(0)
        
        # 9. 计算处理时间
        processing_time = (datetime.now() - start_time).total_seconds()
        
        prompt_info = "自定义prompt" if custom_prompt else "默认prompt"
        logger.info(f"成功处理Excel文件: {file.filename}, 使用AI模型: {ai_model_name}, prompt类型: {prompt_info}, 处理行数: {processed_count}, 耗时: {processing_time:.2f}秒")
        
        # 10. 返回增强的Excel文件
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                "Content-Disposition": f"attachment; filename=enhanced_{file.filename}",
                "X-Processing-Time": str(processing_time),
                "X-Rows-Processed": str(processed_count),
                "X-AI-Model": ai_model_name,
                "X-System-Config": "auto",
                "X-Prompt-Type": "custom" if custom_prompt else "default"
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