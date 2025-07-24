"""
响应格式自动包装中间件
自动将API响应包装成统一格式
"""
from typing import Any, Callable, Dict
from functools import wraps
from fastapi import Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import json

from ..utils.response import success_response, error_response


def wrap_response(func: Callable) -> Callable:
    """
    装饰器：自动包装响应格式
    
    使用方法：
    @router.get("/")
    @wrap_response
    async def get_items():
        return items  # 直接返回数据
    
    自动包装为：
    {
        "success": true,
        "data": items,
        "message": "操作成功"
    }
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            # 执行原函数
            result = await func(*args, **kwargs)
            
            # 如果已经是字典格式且包含success字段，直接返回
            if isinstance(result, dict) and 'success' in result:
                return JSONResponse(content=result)
            
            # 如果是Response对象，直接返回
            if isinstance(result, Response):
                return result
            
            # 如果是BaseModel，转换为dict
            if isinstance(result, BaseModel):
                result = result.dict()
            elif isinstance(result, list) and result and isinstance(result[0], BaseModel):
                # 如果是BaseModel列表，转换为dict列表
                result = [item.dict() for item in result]
            
            # 包装为统一格式
            return JSONResponse(
                content=success_response(data=result)
            )
            
        except Exception as e:
            # 错误响应
            error_msg = str(e)
            if hasattr(e, 'detail'):
                error_msg = e.detail
            
            status_code = 500
            if hasattr(e, 'status_code'):
                status_code = e.status_code
            
            return JSONResponse(
                status_code=status_code,
                content=error_response(message=error_msg)
            )
    
    # 处理同步函数
    if not asyncio.iscoroutinefunction(func):
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                
                if isinstance(result, dict) and 'success' in result:
                    return JSONResponse(content=result)
                
                if isinstance(result, Response):
                    return result
                
                if isinstance(result, BaseModel):
                    result = result.dict()
                elif isinstance(result, list) and result and isinstance(result[0], BaseModel):
                    result = [item.dict() for item in result]
                
                return JSONResponse(
                    content=success_response(data=result)
                )
                
            except Exception as e:
                error_msg = str(e)
                if hasattr(e, 'detail'):
                    error_msg = e.detail
                
                status_code = 500
                if hasattr(e, 'status_code'):
                    status_code = e.status_code
                
                return JSONResponse(
                    status_code=status_code,
                    content=error_response(message=error_msg)
                )
        
        return sync_wrapper
    
    return wrapper


def wrap_router_responses(router):
    """
    为整个路由器的所有端点包装响应格式
    
    使用方法：
    router = APIRouter()
    
    # 定义路由...
    
    # 在文件末尾添加
    wrap_router_responses(router)
    """
    for route in router.routes:
        if hasattr(route, 'endpoint'):
            route.endpoint = wrap_response(route.endpoint)
    return router


# 用于类视图的装饰器
class WrapResponseMeta(type):
    """
    元类：自动为类的所有方法包装响应格式
    
    使用方法：
    class ItemView(metaclass=WrapResponseMeta):
        async def get(self):
            return items
    """
    def __new__(cls, name, bases, namespace):
        # 获取所有方法
        for attr_name, attr_value in namespace.items():
            if callable(attr_value) and not attr_name.startswith('_'):
                namespace[attr_name] = wrap_response(attr_value)
        
        return super().__new__(cls, name, bases, namespace)


import asyncio