"""
数据验证和关联检查工具
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..models import ResearchProject, Collaborator, CommunicationLog, Idea

class DataValidator:
    """数据验证器"""
    
    @staticmethod
    def check_project_dependencies(project_id: int, db: Session) -> Dict[str, Any]:
        """
        检查项目的所有依赖关系
        返回依赖关系的详细信息
        """
        project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
        if not project:
            return {"exists": False}
        
        # 检查交流日志
        communication_logs = db.query(CommunicationLog).filter(
            CommunicationLog.project_id == project_id
        ).all()
        
        # 检查合作者
        collaborators = project.collaborators
        
        return {
            "exists": True,
            "project_id": project_id,
            "project_title": project.title,
            "communication_logs_count": len(communication_logs),
            "collaborators_count": len(collaborators),
            "collaborator_names": [c.name for c in collaborators],
            "can_delete": True,  # 现在有了级联删除，总是可以删除
            "warnings": []
        }
    
    @staticmethod
    def check_collaborator_dependencies(collaborator_id: int, db: Session) -> Dict[str, Any]:
        """
        检查合作者的所有依赖关系
        返回依赖关系的详细信息
        """
        collaborator = db.query(Collaborator).filter(
            Collaborator.id == collaborator_id,
            Collaborator.is_deleted == False
        ).first()

        if not collaborator:
            return {"exists": False}

        # 检查参与的项目
        projects = collaborator.projects
        active_projects = [p for p in projects if p.status in ["writing", "submitting"]]
        published_projects = [p for p in projects if p.status == "published"]

        # 检查交流日志
        communication_logs = db.query(CommunicationLog).filter(
            CommunicationLog.collaborator_id == collaborator_id
        ).count()

        # 检查作为负责人的Ideas（关键外键依赖）
        responsible_ideas = db.query(Idea).filter(
            Idea.responsible_person_id == collaborator_id
        ).all()

        warnings = []
        can_hard_delete = True  # 是否可以永久删除

        if active_projects:
            warnings.append(f"合作者仍参与 {len(active_projects)} 个活跃项目")
            can_hard_delete = False  # 有活跃项目，不能永久删除
        if published_projects:
            warnings.append(f"合作者参与了 {len(published_projects)} 个已发表项目")
        if communication_logs > 0:
            warnings.append(f"合作者有 {communication_logs} 条交流记录")
            can_hard_delete = False  # 有交流记录，不能永久删除（外键约束）
        if responsible_ideas:
            warnings.append(f"合作者参与了 {len(responsible_ideas)} 个项目想法")
            can_hard_delete = False  # 有外键约束，不能删除（包括软删除）

        return {
            "exists": True,
            "collaborator_id": collaborator_id,
            "collaborator_name": collaborator.name,
            "projects_count": len(projects),
            "active_projects_count": len(active_projects),
            "published_projects_count": len(published_projects),
            "project_titles": [p.title for p in projects],
            "communication_logs_count": communication_logs,
            "responsible_ideas_count": len(responsible_ideas),
            "responsible_idea_names": [idea.project_name for idea in responsible_ideas],
            "can_delete": can_hard_delete,  # 是否可以永久删除
            "warnings": warnings,
            "recommendation": "cannot_delete" if responsible_ideas else ("soft_delete_only" if (active_projects or communication_logs) else "safe_to_delete")
        }
    
    @staticmethod
    def validate_project_data(project_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """
        验证项目数据的完整性
        """
        errors = []
        warnings = []
        
        # 验证标题
        if not project_data.get("title"):
            errors.append("项目标题不能为空")
        elif len(project_data["title"]) > 200:
            errors.append("项目标题不能超过200个字符")
        
        # 验证描述
        if not project_data.get("idea_description"):
            errors.append("项目描述不能为空")
        
        # 验证进度
        progress = project_data.get("progress", 0)
        if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
            errors.append("项目进度必须在0-100之间")
        
        # 验证合作者
        collaborator_ids = project_data.get("collaborator_ids", [])
        if collaborator_ids:
            valid_collaborators = db.query(Collaborator).filter(
                Collaborator.id.in_(collaborator_ids),
                Collaborator.is_deleted == False
            ).all()
            valid_ids = [c.id for c in valid_collaborators]
            invalid_ids = set(collaborator_ids) - set(valid_ids)
            
            if invalid_ids:
                errors.append(f"无效的合作者ID: {list(invalid_ids)}")
        else:
            warnings.append("项目没有分配合作者")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    @staticmethod
    def validate_communication_log(log_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """
        验证交流日志数据
        """
        errors = []
        warnings = []
        
        # 验证项目
        project_id = log_data.get("project_id")
        if not project_id:
            errors.append("必须指定项目ID")
        else:
            project = db.query(ResearchProject).filter(
                ResearchProject.id == project_id
            ).first()
            if not project:
                errors.append("指定的项目不存在")
            elif project.status == "published":
                warnings.append("项目已发表，仍在添加交流日志")
        
        # 验证标题
        if not log_data.get("title"):
            errors.append("交流日志标题不能为空")
        
        # 验证内容
        if not log_data.get("content"):
            errors.append("交流内容不能为空")
        
        # 验证合作者（可选）
        collaborator_id = log_data.get("collaborator_id")
        if collaborator_id:
            collaborator = db.query(Collaborator).filter(
                Collaborator.id == collaborator_id,
                Collaborator.is_deleted == False
            ).first()
            if not collaborator:
                errors.append("指定的合作者不存在或已删除")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }