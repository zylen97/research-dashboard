from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import pandas as pd
import io
import asyncio
from datetime import datetime

from app.models.database import get_db, Prompt
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
    prompt_id: Optional[int] = Form(None),
    custom_prompt: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    智能Excel处理端点（使用系统配置的AI）
    自动使用系统配置的AI提供商处理Excel文件
    支持prompt选择：数据库预定义prompt或自定义prompt
    
    参数:
    - file: Excel文件（必须包含"摘要"和"标题"列）
    - prompt_id: 可选，数据库中预定义prompt的ID
    - custom_prompt: 可选，用户自定义的prompt文本
    
    Prompt优先级：prompt_id > custom_prompt > 默认prompt
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
        
        # 检查连接状态
        if not main_config.get('is_connected', False):
            error_msg = "AI配置存在但尚未测试连接，请先在页面左侧的AI配置中点击'测试连接'按钮"
            logger.error(error_msg)
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        logger.info("AI配置有效且已连接")
        
        # 6. 确定使用哪个prompt
        default_prompt = """请将给定的研究内容优化和精炼，使其更加清晰、专业，并强调其创新性和研究价值。

要求：
1. 保持原意不变的前提下，改进语言表达
2. 突出研究的创新点和潜在价值
3. 确保专业性和学术性
4. 返回优化后的内容即可，不要添加额外的说明或评论

研究内容："""
        
        prompt_to_use = None
        
        # 优先使用数据库中的prompt
        if prompt_id:
            try:
                logger.info(f"查询数据库中的prompt_id: {prompt_id}")
                # 使用ORM查询prompt
                prompt_obj = db.query(Prompt).filter(Prompt.id == prompt_id).first()
                
                if prompt_obj:
                    prompt_to_use = prompt_obj.content
                    logger.info(f"使用数据库prompt: {prompt_obj.name}")
                else:
                    logger.warning(f"未找到prompt_id={prompt_id}，将使用自定义prompt或默认prompt")
            except Exception as e:
                logger.error(f"查询prompt失败: {e}")
                # 继续使用自定义prompt或默认prompt
        
        # 其次使用自定义prompt
        if not prompt_to_use and custom_prompt:
            prompt_to_use = custom_prompt
            logger.info("使用自定义prompt")
        
        # 最后使用默认prompt
        if not prompt_to_use:
            prompt_to_use = default_prompt
            logger.info("使用默认prompt")
        
        # 7. 处理Excel数据
        logger.info(f"开始处理Excel数据，共 {len(df)} 行")
        results = []
        processed_count = 0
        error_count = 0
        
        # 显示处理进度
        total_rows = len(df)
        
        for index, row in df.iterrows():
            try:
                abstract = str(row.get('摘要', '')).strip()
                title = str(row.get('标题', '')).strip()
                
                # 跳过空行
                if not abstract or abstract == 'nan':
                    results.append({
                        '序号': index + 1,
                        '标题': title,
                        '原始摘要': abstract,
                        '优化后的研究内容': '',
                        '处理状态': '跳过-空内容'
                    })
                    continue
                
                # 构建完整内容
                content = f"标题：{title}\n摘要：{abstract}" if title and title != 'nan' else abstract
                
                # 调用AI处理
                logger.info(f"处理第 {index + 1}/{total_rows} 行...")
                
                # 使用系统配置的AI服务进行处理
                result = await ai_service.process_with_prompt(content, prompt_to_use)
                
                if result['success']:
                    results.append({
                        '序号': index + 1,
                        '标题': title,
                        '原始摘要': abstract,
                        '优化后的研究内容': result['response'],
                        '处理状态': '成功'
                    })
                    processed_count += 1
                else:
                    results.append({
                        '序号': index + 1,
                        '标题': title,
                        '原始摘要': abstract,
                        '优化后的研究内容': '',
                        '处理状态': f"失败-{result.get('error', '未知错误')}"
                    })
                    error_count += 1
                    logger.error(f"处理第 {index + 1} 行失败: {result.get('error')}")
                
                # 添加延迟避免API限流
                if index < len(df) - 1:  # 不是最后一行
                    await asyncio.sleep(0.5)
                    
            except Exception as e:
                error_msg = str(e)
                logger.error(f"处理第 {index + 1} 行时出错: {error_msg}")
                results.append({
                    '序号': index + 1,
                    '标题': row.get('标题', ''),
                    '原始摘要': row.get('摘要', ''),
                    '优化后的研究内容': '',
                    '处理状态': f"错误-{error_msg}"
                })
                error_count += 1
        
        # 8. 创建结果Excel文件
        result_df = pd.DataFrame(results)
        
        # 创建Excel输出
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            result_df.to_excel(writer, sheet_name='处理结果', index=False)
            
            # 获取workbook和worksheet对象
            workbook = writer.book
            worksheet = writer.sheets['处理结果']
            
            # 设置列宽
            worksheet.set_column('A:A', 10)  # 序号
            worksheet.set_column('B:B', 30)  # 标题
            worksheet.set_column('C:C', 50)  # 原始摘要
            worksheet.set_column('D:D', 60)  # 优化后的研究内容
            worksheet.set_column('E:E', 20)  # 处理状态
            
            # 添加处理统计信息
            stats_df = pd.DataFrame([{
                '处理时间': str(datetime.now() - start_time),
                '总行数': total_rows,
                '成功处理': processed_count,
                '处理失败': error_count,
                '跳过行数': total_rows - processed_count - error_count,
                'AI模型': main_config.get('model', 'unknown'),
                'Prompt来源': 'prompt' if prompt_id else ('自定义' if custom_prompt else '默认')
            }])
            stats_df.to_excel(writer, sheet_name='处理统计', index=False)
        
        output.seek(0)
        
        # 9. 返回处理后的文件
        filename = f"processed_{file.filename.replace('.xlsx', '').replace('.xls', '')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        logger.info(f"Excel处理完成: 成功={processed_count}, 失败={error_count}, 总耗时={datetime.now() - start_time}")
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"处理Excel文件时发生未预期错误: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"处理文件时发生错误: {str(e)}"
        )

@router.get("/health")
async def health_check():
    """健康检查端点"""
    return success_response({
        "status": "healthy",
        "service": "idea_discovery",
        "timestamp": datetime.now().isoformat()
    })