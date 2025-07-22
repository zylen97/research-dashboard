"""
统一响应格式处理
"""
from typing import TypeVar, Optional, Dict, Any, List, Union
from pydantic import BaseModel

T = TypeVar('T')


class ResponseModel(BaseModel):
    """统一响应模型"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None
    errors: Optional[List[str]] = None
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "操作成功",
                "data": {"id": 1, "name": "示例"},
                "errors": None
            }
        }


def success_response(
    data: Any = None, 
    message: str = "操作成功"
) -> Dict[str, Any]:
    """
    成功响应
    
    Args:
        data: 响应数据
        message: 成功消息
        
    Returns:
        格式化的响应字典
    """
    return {
        "success": True,
        "message": message,
        "data": data,
        "errors": None
    }


def error_response(
    message: str = "操作失败",
    errors: Optional[List[str]] = None,
    data: Any = None
) -> Dict[str, Any]:
    """
    错误响应
    
    Args:
        message: 错误消息
        errors: 错误详情列表
        data: 额外数据
        
    Returns:
        格式化的响应字典
    """
    return {
        "success": False,
        "message": message,
        "data": data,
        "errors": errors or []
    }


def paginated_response(
    items: List[Any],
    total: int,
    page: int = 1,
    page_size: int = 10,
    message: str = "获取成功"
) -> Dict[str, Any]:
    """
    分页响应
    
    Args:
        items: 数据项列表
        total: 总数
        page: 当前页
        page_size: 每页大小
        message: 成功消息
        
    Returns:
        格式化的分页响应字典
    """
    return {
        "success": True,
        "message": message,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        },
        "errors": None
    }