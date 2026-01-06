"""
研究方法使用统计辅助函数
"""
from sqlalchemy.orm import Session
from app.models.database import ResearchMethod


def update_research_method_usage(db: Session, method_name: str, increment: int = 1):
    """
    更新研究方法的使用次数

    Args:
        db: 数据库会话
        method_name: 研究方法名称
        increment: 增量（正数增加，负数减少）
    """
    if not method_name:
        return

    method = db.query(ResearchMethod).filter(ResearchMethod.name == method_name).first()
    if method:
        method.usage_count = max(0, method.usage_count + increment)


def cleanup_unused_methods(db: Session) -> int:
    """
    自动删除usage_count为0的研究方法

    Returns:
        删除的方法数量
    """
    unused_methods = db.query(ResearchMethod).filter(ResearchMethod.usage_count == 0).all()
    deleted_count = len(unused_methods)

    for method in unused_methods:
        db.delete(method)

    if deleted_count > 0:
        db.commit()

    return deleted_count
