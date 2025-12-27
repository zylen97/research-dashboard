"""
审计日志相关的路由
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from ..models import get_db
from ..services import AuditService

router = APIRouter()

@router.get("/{table_name}/{record_id}/history")
async def get_record_history(
    table_name: str,
    record_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """获取记录的变更历史"""
    return AuditService.get_record_history(db, table_name, record_id, limit)

@router.get("/recent")
async def get_recent_activities(
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
    table_name: Optional[str] = None,
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """获取最近的操作记录"""
    from ..models.database import AuditLog
    
    query = db.query(AuditLog)
    
    if action:
        query = query.filter(AuditLog.action == action)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    
    activities = []
    for log in logs:
        activity = {
            "id": log.id,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "action": log.action,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat()
        }

        if log.changes:
            import json
            activity["changes_summary"] = json.loads(log.changes)

        activities.append(activity)

    return activities

@router.get("/statistics")
async def get_audit_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取审计统计信息"""
    from sqlalchemy import func
    from ..models.database import AuditLog
    
    query = db.query(AuditLog)
    
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    
    # 按操作类型统计
    action_stats = db.query(
        AuditLog.action,
        func.count(AuditLog.id).label('count')
    ).group_by(AuditLog.action).all()
    
    # 按表统计
    table_stats = db.query(
        AuditLog.table_name,
        func.count(AuditLog.id).label('count')
    ).group_by(AuditLog.table_name).all()
    
    # 总数
    total_count = query.count()
    
    return {
        "total_operations": total_count,
        "by_action": {action: count for action, count in action_stats},
        "by_table": {table: count for table, count in table_stats},
        "date_range": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }