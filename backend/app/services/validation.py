"""
数据验证服务：提供数据完整性检查和关联验证
"""

from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..models import (
    ResearchProject, Collaborator, CommunicationLog,
    Literature, Idea
)

class ValidationService:
    """数据验证服务类"""
    
    @staticmethod
    def check_project_dependencies(project_id: int, db: Session) -> Dict[str, Any]:
        """检查项目的依赖关系"""
        project = db.query(ResearchProject).filter(
            ResearchProject.id == project_id
        ).first()
        
        if not project:
            return {"valid": False, "error": "Project not found"}
        
        # 检查交流日志
        communication_logs = db.query(CommunicationLog).filter(
            CommunicationLog.project_id == project_id
        ).count()
        
        # 检查关联的合作者
        collaborators = len(project.collaborators)
        
        return {
            "valid": True,
            "project_id": project_id,
            "project_title": project.title,
            "dependencies": {
                "communication_logs": communication_logs,
                "collaborators": collaborators
            },
            "can_delete": True,
            "warnings": []
        }
    
    @staticmethod
    def check_collaborator_dependencies(collaborator_id: int, db: Session) -> Dict[str, Any]:
        """检查合作者的依赖关系"""
        collaborator = db.query(Collaborator).filter(
            Collaborator.id == collaborator_id,
            Collaborator.is_deleted == False
        ).first()
        
        if not collaborator:
            return {"valid": False, "error": "Collaborator not found"}
        
        # 检查参与的项目
        active_projects = [p for p in collaborator.projects if p.status == "active"]
        completed_projects = [p for p in collaborator.projects if p.status == "completed"]
        
        # 检查交流日志
        communication_logs = db.query(CommunicationLog).filter(
            CommunicationLog.collaborator_id == collaborator_id
        ).count()
        
        warnings = []
        if active_projects:
            warnings.append(f"合作者参与了 {len(active_projects)} 个活跃项目")
        
        return {
            "valid": True,
            "collaborator_id": collaborator_id,
            "collaborator_name": collaborator.name,
            "dependencies": {
                "active_projects": len(active_projects),
                "completed_projects": len(completed_projects),
                "total_projects": len(collaborator.projects),
                "communication_logs": communication_logs
            },
            "can_soft_delete": True,
            "can_hard_delete": len(active_projects) == 0,
            "warnings": warnings
        }
    
    @staticmethod
    def validate_project_data(project_data: Dict[str, Any]) -> Dict[str, Any]:
        """验证项目数据的完整性"""
        errors = []
        warnings = []
        
        # 必填字段验证
        if not project_data.get("title"):
            errors.append("项目标题不能为空")
        elif len(project_data["title"]) > 200:
            errors.append("项目标题不能超过200个字符")
        
        if not project_data.get("idea_description"):
            errors.append("项目描述不能为空")
        
        # 进度验证
        progress = project_data.get("progress", 0)
        if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
            errors.append("项目进度必须在0-100之间")
        
        # 状态验证
        valid_statuses = ["active", "completed", "paused"]
        status = project_data.get("status", "active")
        if status not in valid_statuses:
            errors.append(f"项目状态必须是以下之一: {', '.join(valid_statuses)}")
        
        # 逻辑验证
        if status == "completed" and progress < 100:
            warnings.append("已完成的项目进度应该是100%")
        
        if not project_data.get("collaborator_ids"):
            warnings.append("项目没有分配合作者")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    @staticmethod
    def validate_collaborator_data(collaborator_data: Dict[str, Any]) -> Dict[str, Any]:
        """验证合作者数据的完整性"""
        errors = []
        warnings = []
        
        # 必填字段验证
        if not collaborator_data.get("name"):
            errors.append("合作者姓名不能为空")
        elif len(collaborator_data["name"]) > 100:
            errors.append("合作者姓名不能超过100个字符")
        
        # 性别验证
        if collaborator_data.get("gender"):
            valid_genders = ["男", "女", "male", "female", "M", "F"]
            if collaborator_data["gender"] not in valid_genders:
                warnings.append("性别格式不标准")
        
        # 联系方式验证
        contact = collaborator_data.get("contact_info")
        if contact and len(contact) > 200:
            errors.append("联系方式不能超过200个字符")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    @staticmethod
    def check_data_consistency(db: Session) -> Dict[str, Any]:
        """检查整体数据一致性"""
        issues = []
        
        # 检查孤立的交流日志（项目已删除但日志还在）
        orphan_logs = db.query(CommunicationLog).join(
            ResearchProject,
            CommunicationLog.project_id == ResearchProject.id,
            isouter=True
        ).filter(ResearchProject.id == None).count()
        
        if orphan_logs > 0:
            issues.append({
                "type": "orphan_data",
                "message": f"发现 {orphan_logs} 条孤立的交流日志",
                "severity": "warning"
            })
        
        # 检查没有合作者的项目
        projects_without_collaborators = db.query(ResearchProject).filter(
            ~ResearchProject.collaborators.any()
        ).count()
        
        if projects_without_collaborators > 0:
            issues.append({
                "type": "missing_relation",
                "message": f"发现 {projects_without_collaborators} 个没有合作者的项目",
                "severity": "info"
            })
        
        # 检查重复的合作者名称
        from sqlalchemy import func
        duplicate_names = db.query(
            Collaborator.name,
            func.count(Collaborator.id).label('count')
        ).filter(
            Collaborator.is_deleted == False
        ).group_by(
            Collaborator.name
        ).having(
            func.count(Collaborator.id) > 1
        ).all()
        
        for name, count in duplicate_names:
            issues.append({
                "type": "duplicate_data",
                "message": f"发现 {count} 个名为 '{name}' 的合作者",
                "severity": "warning"
            })
        
        return {
            "consistent": len(issues) == 0,
            "issues": issues,
            "summary": {
                "total_issues": len(issues),
                "warnings": len([i for i in issues if i["severity"] == "warning"]),
                "info": len([i for i in issues if i["severity"] == "info"])
            }
        }