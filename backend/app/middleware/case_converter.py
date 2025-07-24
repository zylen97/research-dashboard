"""
字段命名格式转换中间件
自动在snake_case（Python）和camelCase（JavaScript）之间转换
"""
import re
from typing import Any, Dict, List, Union
from datetime import datetime, date
from pydantic import BaseModel


def snake_to_camel(snake_str: str) -> str:
    """
    将snake_case转换为camelCase
    
    Examples:
        future_plan -> futurePlan
        is_senior -> isSenior
        communication_date -> communicationDate
    """
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


def camel_to_snake(camel_str: str) -> str:
    """
    将camelCase转换为snake_case
    
    Examples:
        futurePlan -> future_plan
        isSenior -> is_senior
        communicationDate -> communication_date
    """
    # 在大写字母前插入下划线
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', camel_str)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def convert_keys(obj: Any, converter_func: callable) -> Any:
    """
    递归转换对象中的所有键名
    
    Args:
        obj: 要转换的对象
        converter_func: 转换函数（snake_to_camel 或 camel_to_snake）
    
    Returns:
        转换后的对象
    """
    if isinstance(obj, dict):
        # 转换字典的键
        return {
            converter_func(k) if isinstance(k, str) else k: convert_keys(v, converter_func)
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        # 递归处理列表中的每个元素
        return [convert_keys(item, converter_func) for item in obj]
    elif isinstance(obj, BaseModel):
        # 处理Pydantic模型
        return convert_keys(obj.dict(), converter_func)
    elif isinstance(obj, (datetime, date)):
        # 日期时间对象转换为ISO格式字符串
        return obj.isoformat()
    else:
        # 其他类型直接返回
        return obj


def to_camel_case(obj: Any) -> Any:
    """将对象的键从snake_case转换为camelCase"""
    return convert_keys(obj, snake_to_camel)


def to_snake_case(obj: Any) -> Any:
    """将对象的键从camelCase转换为snake_case"""
    return convert_keys(obj, camel_to_snake)


class CaseConverterMiddleware:
    """
    FastAPI中间件：自动转换请求和响应的字段命名格式
    
    使用方法：
    app = FastAPI()
    app.add_middleware(CaseConverterMiddleware)
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # 处理请求
            if scope["method"] in ["POST", "PUT", "PATCH"]:
                # 需要转换请求体
                pass  # TODO: 实现请求体转换
            
            # 处理响应
            async def send_wrapper(message):
                if message["type"] == "http.response.body":
                    # TODO: 实现响应体转换
                    pass
                await send(message)
            
            await self.app(scope, receive, send_wrapper)
        else:
            await self.app(scope, receive, send)


# Pydantic模型配置，自动进行字段转换
class CamelCaseModel(BaseModel):
    """
    自动将字段名转换为camelCase的基础模型
    
    使用方法：
    class UserResponse(CamelCaseModel):
        user_name: str
        is_active: bool
        created_at: datetime
    
    # 输出时自动转换为：
    # {
    #   "userName": "...",
    #   "isActive": true,
    #   "createdAt": "..."
    # }
    """
    
    class Config:
        # 允许使用字段别名
        allow_population_by_field_name = True
        # 自定义JSON编码器
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
        }
    
    def dict(self, **kwargs):
        """重写dict方法，自动转换字段名"""
        data = super().dict(**kwargs)
        return to_camel_case(data)
    
    def json(self, **kwargs):
        """重写json方法，自动转换字段名"""
        data = self.dict(**kwargs)
        import json
        return json.dumps(data, ensure_ascii=False, default=str)


# 装饰器：自动转换响应格式
def convert_response_to_camel_case(func):
    """
    装饰器：自动将响应中的snake_case字段转换为camelCase
    
    使用方法：
    @router.get("/users")
    @convert_response_to_camel_case
    async def get_users():
        return {"user_name": "John", "is_active": True}
    
    # 返回：{"userName": "John", "isActive": true}
    """
    from functools import wraps
    
    @wraps(func)
    async def wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)
        return to_camel_case(result)
    
    # 处理同步函数
    if not asyncio.iscoroutinefunction(func):
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            return to_camel_case(result)
        return sync_wrapper
    
    return wrapper


# 请求体转换装饰器
def convert_request_to_snake_case(func):
    """
    装饰器：自动将请求中的camelCase字段转换为snake_case
    
    使用方法：
    @router.post("/users")
    @convert_request_to_snake_case
    async def create_user(data: dict):
        # data中的字段已经从camelCase转换为snake_case
        return data
    """
    from functools import wraps
    from fastapi import Request
    
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        # 获取请求体
        body = await request.json()
        # 转换为snake_case
        converted_body = to_snake_case(body)
        # 替换kwargs中的数据
        for key, value in kwargs.items():
            if isinstance(value, dict):
                kwargs[key] = to_snake_case(value)
        
        return await func(request, *args, **kwargs)
    
    return wrapper


import asyncio