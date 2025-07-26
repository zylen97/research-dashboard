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
    max_concurrent: Optional[int] = Form(50),
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
        # 生成安全的文件名用于日志和处理（避免中文编码问题）
        import re
        # 更严格的ASCII安全文件名：只保留英文字母、数字、连字符、下划线、点号
        safe_original_filename = re.sub(r'[^a-zA-Z0-9\-_\.]', '_', file.filename or 'unknown_file')
        
        # 1. 验证文件类型
        if not (file.filename and file.filename.lower().endswith(('.xlsx', '.xls'))):
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
        logger.info(f"🚀 开始处理Excel文件: {safe_original_filename}, 文件大小: {len(file_content)} bytes")
        
        try:
            logger.info("📦 创建AI服务实例...")
            ai_service = create_ai_service(db)
            logger.info("✅ AI服务实例创建成功")
        except Exception as e:
            error_msg = f"创建AI服务实例失败: {str(e)}"
            logger.error(f"❌ {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"系统配置错误: {error_msg}"
            )
        
        # 5. 检查AI配置状态
        try:
            logger.info("🔍 检查AI配置状态...")
            ai_config = await ai_service.get_ai_config()
            logger.info(f"📋 获取到的配置: {ai_config}")
            
            if not ai_config:
                error_msg = "AI配置为空，配置加载失败"
                logger.error(f"❌ {error_msg}")
                raise HTTPException(
                    status_code=500,
                    detail=f"配置加载错误: {error_msg}"
                )
            
            if not ai_config.get('api_key'):
                error_msg = "API密钥未设置，请先在页面左侧的AI配置中填写API密钥"
                logger.error(f"❌ {error_msg}")
                raise HTTPException(
                    status_code=400,
                    detail=error_msg
                )
                
        except HTTPException:
            raise
        except Exception as e:
            error_msg = f"获取AI配置失败: {str(e)}"
            logger.error(f"❌ {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"配置读取错误: {error_msg}"
            )
        
        # 明确显示当前使用的模型
        current_model = ai_config.get('model', 'claude-3-7-sonnet-20250219')
        logger.info(f"🎯 Excel处理将使用的AI模型: {current_model}")
        logger.info(f"📋 AI配置详情: model={current_model}, api_base={ai_config.get('api_base')}")
        
        logger.info("✅ AI配置检查完成")
        
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
        
        # 7. 验证并发数参数
        if max_concurrent is None or max_concurrent <= 0:
            max_concurrent = 50
        max_concurrent = min(max_concurrent, 50)  # 限制最大并发数
        logger.info(f"验证并发数参数: {max_concurrent}")
        
        # 8. 处理Excel数据 - 使用并发处理
        logger.info(f"开始并发处理Excel数据，共 {len(df)} 行，并发数: {max_concurrent}")
        
        # 直接在原DataFrame基础上工作，不重新组织数据
        # 首先创建AI结果列，初始化为空
        ai_column_name = f"迁移结果by{current_model}"
        df[ai_column_name] = ""
        
        logger.info(f"✅ 新增AI结果列: {ai_column_name}")
        logger.info(f"📊 DataFrame形状: {df.shape}, 列数: {len(df.columns)}")
        
        total_rows = len(df)
        
        # 并发处理函数 - 直接在DataFrame上工作
        async def process_single_row(row_index: int, dataframe: pd.DataFrame, ai_column: str, semaphore: asyncio.Semaphore, ai_service_inst, prompt_text: str) -> dict:
            task_start_time = datetime.now()
            row_number = row_index + 1  # 显示用的行号(从1开始)
            
            async with semaphore:
                try:
                    # 从DataFrame直接提取摘要和标题
                    row = dataframe.loc[row_index]
                    abstract = str(row.get('摘要', '')).strip()
                    title = str(row.get('标题', '')).strip()
                    
                    # 检查是否为空行
                    if not abstract or abstract == 'nan':
                        logger.info(f"⏭️ 第{row_number}行: 跳过空内容")
                        dataframe.loc[row_index, ai_column] = '跳过处理-空内容'
                        return {
                            'row_index': row_index,
                            'status': '跳过'
                        }
                    
                    # 构建完整内容
                    content = f"标题：{title}\n摘要：{abstract}" if title and title != 'nan' else abstract
                    
                    # 调用AI处理 - 添加详细时间追踪
                    logger.info(f"🚀 第{row_number}行: 开始处理 [{task_start_time.strftime('%H:%M:%S.%f')[:-3]}]")
                    logger.debug(f"第{row_number}行内容: {content[:100]}...")
                    
                    try:
                        ai_start_time = datetime.now()
                        result = await ai_service_inst.process_with_prompt(content, prompt_text)
                        ai_end_time = datetime.now()
                        ai_duration = (ai_end_time - ai_start_time).total_seconds()
                        
                        logger.info(f"✅ 第{row_number}行: AI调用完成 [{ai_end_time.strftime('%H:%M:%S.%f')[:-3]}] 耗时{ai_duration:.2f}s 成功: {result.get('success', False)}")
                    except Exception as ai_error:
                        ai_end_time = datetime.now()
                        ai_duration = (ai_end_time - task_start_time).total_seconds()
                        logger.error(f"❌ 第{row_number}行: AI调用异常 [{ai_end_time.strftime('%H:%M:%S.%f')[:-3]}] 耗时{ai_duration:.2f}s: {str(ai_error)}", exc_info=True)
                        dataframe.loc[row_index, ai_column] = f"AI调用异常: {str(ai_error)[:50]}"
                        return {
                            'row_index': row_index,
                            'status': '异常'
                        }
                    
                    if result and result.get('success'):
                        task_end_time = datetime.now()
                        total_duration = (task_end_time - task_start_time).total_seconds()
                        logger.info(f"🎉 第{row_number}行: 处理成功 [{task_end_time.strftime('%H:%M:%S.%f')[:-3]}] 总耗时{total_duration:.2f}s")
                        # 直接更新DataFrame中的AI结果列
                        dataframe.loc[row_index, ai_column] = result.get('response', '')
                        return {
                            'row_index': row_index,
                            'status': '成功'
                        }
                    else:
                        task_end_time = datetime.now()
                        total_duration = (task_end_time - task_start_time).total_seconds()
                        error_detail = result.get('error', '未知错误') if result else 'AI调用返回空结果'
                        logger.error(f"❌ 第{row_number}行: AI处理失败 [{task_end_time.strftime('%H:%M:%S.%f')[:-3]}] 总耗时{total_duration:.2f}s: {error_detail}")
                        dataframe.loc[row_index, ai_column] = f"处理失败: {error_detail}"
                        return {
                            'row_index': row_index,
                            'status': '失败'
                        }
                        
                except Exception as e:
                    task_end_time = datetime.now()
                    total_duration = (task_end_time - task_start_time).total_seconds()
                    error_msg = str(e)
                    logger.error(f"❌ 第{row_number}行: 处理异常 [{task_end_time.strftime('%H:%M:%S.%f')[:-3]}] 总耗时{total_duration:.2f}s: {error_msg}", exc_info=True)
                    dataframe.loc[row_index, ai_column] = f"处理异常: {error_msg}"
                    return {
                        'row_index': row_index,
                        'status': '异常'
                    }
        
        # 创建信号量控制并发数
        semaphore = asyncio.Semaphore(max_concurrent)
        
        # 基于DataFrame索引创建并发任务
        tasks = [
            process_single_row(row_index, df, ai_column_name, semaphore, ai_service, prompt_to_use) 
            for row_index in df.index
        ]
        
        # 执行并发处理 - 添加详细的并发统计
        concurrent_start_time = datetime.now()
        logger.info(f"🚀 开始并发执行 {len(tasks)} 个任务... [{concurrent_start_time.strftime('%H:%M:%S.%f')[:-3]}]")
        logger.info(f"📊 并发配置: 信号量={max_concurrent}, 任务数={len(tasks)}")
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        concurrent_end_time = datetime.now()
        concurrent_duration = (concurrent_end_time - concurrent_start_time).total_seconds()
        logger.info(f"🏁 并发执行完成 [{concurrent_end_time.strftime('%H:%M:%S.%f')[:-3]}] 并发总耗时{concurrent_duration:.2f}s")
        
        # 统计处理结果（AI结果已直接写入DataFrame）
        processed_count = 0
        error_count = 0
        skip_count = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"任务 {i+1} 发生异常: {result}")
                # 对于异常的任务，在对应行标记异常
                if i < len(df):
                    df.iloc[i, df.columns.get_loc(ai_column_name)] = f"处理异常: {str(result)}"
                error_count += 1
            else:
                # 统计处理结果
                if result['status'] == '成功':
                    processed_count += 1
                elif result['status'] == '跳过':
                    skip_count += 1
                elif result['status'] in ['失败', '异常']:
                    error_count += 1
        
        logger.info(f"并发处理完成: 成功={processed_count}, 失败={error_count}, 跳过={skip_count}, 总数={len(df)}")
        logger.info(f"✅ AI结果已填入列: {ai_column_name}")
        
        # 8. 输出增强后的Excel文件（保留所有原始列 + 新的AI结果列）
        result_df = df
        
        # 创建Excel输出 - 单工作表包含所有原始列+AI结果列
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            result_df.to_excel(writer, sheet_name='AI增强结果', index=False)
            
            # 获取workbook和worksheet对象
            workbook = writer.book
            worksheet = writer.sheets['AI增强结果']
            
            # 动态设置列宽 - 为所有列设置合适的宽度
            for col_num, column in enumerate(result_df.columns):
                # 计算列的合适宽度
                max_length = max(
                    len(str(column)),  # 列名长度
                    result_df[column].astype(str).str.len().max() if not result_df[column].empty else 0  # 内容最大长度
                )
                # 限制最大宽度，避免过宽
                max_length = min(max_length, 80)
                # 设置最小宽度
                max_length = max(max_length, 10)
                
                # 为AI结果列设置更宽的宽度
                if ai_column_name in column:
                    max_length = min(max_length + 20, 100)
                
                worksheet.set_column(col_num, col_num, max_length)
            
            # 添加说明信息到首行注释
            worksheet.write(f'A{len(result_df) + 3}', f'处理完成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
            worksheet.write(f'A{len(result_df) + 4}', f'使用模型: {current_model}')
            worksheet.write(f'A{len(result_df) + 5}', f'成功: {processed_count}, 失败: {error_count}, 跳过: {skip_count}, 总数: {len(df)}')
        
        output.seek(0)
        
        # 9. 返回增强后的文件
        # 使用已经生成的安全文件名，移除扩展名，确保完全ASCII安全
        safe_filename_base = safe_original_filename.replace('.xlsx', '').replace('.xls', '').replace('_xlsx', '').replace('_xls', '')
        # 再次确保文件名基础部分完全ASCII安全
        safe_filename_base = re.sub(r'[^a-zA-Z0-9\-_]', '_', safe_filename_base)
        # 使用模型名称作为文件名的一部分，确保完全ASCII安全
        safe_model_name = re.sub(r'[^a-zA-Z0-9\-_]', '_', current_model)
        filename = f"{safe_filename_base}_enhanced_by_{safe_model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        # 最终验证：确保整个文件名完全ASCII安全
        filename = re.sub(r'[^a-zA-Z0-9\-_\.]', '_', filename)
        
        logger.info(f"Excel处理完成 [{safe_original_filename}]: 成功={processed_count}, 失败={error_count}, 跳过={skip_count}, 总耗时={datetime.now() - start_time}")
        logger.info(f"📥 生成下载文件: {filename}")
        
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

@router.get("/test-ai-config-simple")
async def test_ai_config_simple(db: Session = Depends(get_db)):
    """测试AI配置端点 - 用于调试"""
    logger.info("🧪 开始测试AI配置...")
    
    try:
        # 1. 创建AI服务实例
        logger.info("📦 创建AI服务实例...")
        ai_service = create_ai_service(db)
        logger.info("✅ AI服务实例创建成功")
        
        # 2. 获取AI配置
        logger.info("🔍 获取AI配置...")
        ai_config = await ai_service.get_ai_config()
        logger.info(f"📋 获取到的配置: {ai_config}")
        
        if not ai_config:
            return {
                "success": False,
                "error": "AI配置为空",
                "config": None
            }
        
        if not ai_config.get('api_key'):
            return {
                "success": False,
                "error": "API密钥未设置",
                "config": {
                    "api_base": ai_config.get('api_base'),
                    "model": ai_config.get('model'),
                    "api_key_set": False
                }
            }
        
        # 3. 测试简单的AI调用
        logger.info("🤖 测试AI调用...")
        test_prompt = "请回复'AI配置测试成功'"
        test_content = "这是一个配置测试"
        
        try:
            result = await ai_service.call_ai_api(test_prompt, test_content)
            logger.info(f"📤 AI调用结果: {result}")
            
            return {
                "success": True,
                "message": "AI配置测试成功",
                "config": {
                    "api_base": ai_config.get('api_base'),
                    "model": ai_config.get('model'),
                    "api_key_set": True
                },
                "ai_response": result.get('response', '') if result.get('success') else None,
                "ai_error": result.get('error') if not result.get('success') else None
            }
            
        except Exception as ai_error:
            logger.error(f"❌ AI调用异常: {str(ai_error)}", exc_info=True)
            return {
                "success": False,
                "error": f"AI调用异常: {str(ai_error)}",
                "config": {
                    "api_base": ai_config.get('api_base'),
                    "model": ai_config.get('model'),
                    "api_key_set": True
                }
            }
            
    except Exception as e:
        logger.error(f"❌ AI配置测试失败: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": f"测试失败: {str(e)}",
            "config": None
        }