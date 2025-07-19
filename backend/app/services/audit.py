"""
审计服务：记录数据变更历史
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from ..models.database import AuditLog

class AuditService:
    """审计服务类"""
    
    @staticmethod
    def log_create(
        db: Session,
        table_name: str,
        record_id: int,
        new_values: Dict[str, Any],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """记录创建操作"""
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action="CREATE",
            user_id=user_id,
            ip_address=ip_address,
            new_values=json.dumps(new_values, ensure_ascii=False, default=str),
            old_values=None,
            changes=json.dumps(list(new_values.keys()), ensure_ascii=False)
        )
        db.add(audit_log)
        db.commit()
        return audit_log
    
    @staticmethod
    def log_update(
        db: Session,
        table_name: str,
        record_id: int,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Optional[AuditLog]:
        """记录更新操作"""
        # 计算变更的字段
        changes = {}
        for key, new_value in new_values.items():
            old_value = old_values.get(key)
            if old_value != new_value:
                changes[key] = {
                    "old": old_value,
                    "new": new_value
                }
        
        # 如果没有变更，不记录
        if not changes:
            return None
        
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action="UPDATE",
            user_id=user_id,
            ip_address=ip_address,
            old_values=json.dumps(old_values, ensure_ascii=False, default=str),
            new_values=json.dumps(new_values, ensure_ascii=False, default=str),
            changes=json.dumps(changes, ensure_ascii=False, default=str)
        )
        db.add(audit_log)
        db.commit()
        return audit_log
    
    @staticmethod
    def log_delete(
        db: Session,
        table_name: str,
        record_id: int,
        old_values: Dict[str, Any],
        is_soft_delete: bool = False,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """记录删除操作"""
        action = "SOFT_DELETE" if is_soft_delete else "DELETE"
        
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action=action,
            user_id=user_id,
            ip_address=ip_address,
            old_values=json.dumps(old_values, ensure_ascii=False, default=str),
            new_values=None,
            changes=json.dumps({"deleted": True}, ensure_ascii=False)
        )
        db.add(audit_log)
        db.commit()
        return audit_log
    
    @staticmethod
    def log_restore(
        db: Session,
        table_name: str,
        record_id: int,
        restored_values: Dict[str, Any],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """记录恢复操作"""
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action="RESTORE",
            user_id=user_id,
            ip_address=ip_address,
            old_values=None,
            new_values=json.dumps(restored_values, ensure_ascii=False, default=str),
            changes=json.dumps({"restored": True}, ensure_ascii=False)
        )
        db.add(audit_log)
        db.commit()
        return audit_log
    
    @staticmethod
    def get_record_history(
        db: Session,
        table_name: str,
        record_id: int,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取记录的历史变更"""
        logs = db.query(AuditLog).filter(
            AuditLog.table_name == table_name,
            AuditLog.record_id == record_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()
        
        history = []
        for log in logs:
            history_entry = {
                "id": log.id,
                "action": log.action,
                "created_at": log.created_at.isoformat(),
                "user_id": log.user_id,
                "ip_address": log.ip_address
            }
            
            if log.changes:
                history_entry["changes"] = json.loads(log.changes)
            
            if log.action == "UPDATE" and log.old_values and log.new_values:
                old_vals = json.loads(log.old_values)
                new_vals = json.loads(log.new_values)
                history_entry["details"] = []
                
                changes = json.loads(log.changes) if log.changes else {}
                for field, change in changes.items():
                    history_entry["details"].append({
                        "field": field,
                        "old_value": change.get("old"),
                        "new_value": change.get("new")
                    })
            
            history.append(history_entry)
        
        return history
    
    @staticmethod
    def get_user_activities(
        db: Session,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """获取用户的操作历史"""
        query = db.query(AuditLog).filter(AuditLog.user_id == user_id)
        
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        
        activities = []
        for log in logs:
            activity = {
                "id": log.id,
                "table_name": log.table_name,
                "record_id": log.record_id,
                "action": log.action,
                "created_at": log.created_at.isoformat()
            }
            
            if log.changes:
                activity["changes"] = json.loads(log.changes)
            
            activities.append(activity)
        
        return activities
    
    @staticmethod
    def serialize_model_instance(instance) -> Dict[str, Any]:
        """将 SQLAlchemy 模型实例序列化为字典"""
        result = {}
        
        # 获取模型的所有列
        mapper = inspect(instance.__class__)
        for column in mapper.columns:
            value = getattr(instance, column.name)
            # 处理特殊类型
            if isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value
        
        return result