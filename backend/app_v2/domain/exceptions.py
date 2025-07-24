#!/usr/bin/env python3
"""
🏗️ Domain Exceptions
领域异常

定义领域层的异常类型，用于表达业务规则违反和领域错误
这些异常应该具有业务意义，不应该暴露技术细节

创建时间：2025-07-24
"""

from typing import Optional, Dict, Any, List


class DomainException(Exception):
    """
    领域异常基类
    
    所有领域相关的异常都应该继承自这个类
    这些异常表示业务规则的违反，而不是技术错误
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'error_type': self.__class__.__name__,
            'error_code': self.error_code,
            'message': self.message,
            'details': self.details
        }


class ValidationException(DomainException):
    """验证异常 - 当数据不符合业务规则时抛出"""
    
    def __init__(
        self, 
        message: str, 
        field: Optional[str] = None,
        value: Optional[Any] = None,
        validation_rules: Optional[List[str]] = None
    ):
        super().__init__(message, "VALIDATION_ERROR")
        self.field = field
        self.value = value
        self.validation_rules = validation_rules or []
        
        self.details.update({
            'field': field,
            'value': str(value) if value is not None else None,
            'validation_rules': validation_rules
        })


class BusinessRuleException(DomainException):
    """业务规则异常 - 当违反业务规则时抛出"""
    
    def __init__(
        self, 
        message: str, 
        rule_name: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, "BUSINESS_RULE_VIOLATION")
        self.rule_name = rule_name
        self.context = context or {}
        
        self.details.update({
            'rule_name': rule_name,
            'context': context
        })


class EntityNotFoundException(DomainException):
    """实体未找到异常"""
    
    def __init__(
        self, 
        entity_type: str, 
        entity_id: Any,
        message: Optional[str] = None
    ):
        default_message = f"{entity_type} with id '{entity_id}' not found"
        super().__init__(message or default_message, "ENTITY_NOT_FOUND")
        self.entity_type = entity_type
        self.entity_id = entity_id
        
        self.details.update({
            'entity_type': entity_type,
            'entity_id': str(entity_id)
        })


class DuplicateEntityException(DomainException):
    """重复实体异常"""
    
    def __init__(
        self, 
        entity_type: str, 
        conflicting_field: str,
        conflicting_value: Any,
        message: Optional[str] = None
    ):
        default_message = f"{entity_type} with {conflicting_field} '{conflicting_value}' already exists"
        super().__init__(message or default_message, "DUPLICATE_ENTITY")
        self.entity_type = entity_type
        self.conflicting_field = conflicting_field
        self.conflicting_value = conflicting_value
        
        self.details.update({
            'entity_type': entity_type,
            'conflicting_field': conflicting_field,
            'conflicting_value': str(conflicting_value)
        })


class InvalidStateTransitionException(DomainException):
    """无效状态转换异常"""
    
    def __init__(
        self, 
        entity_type: str,
        current_state: str,
        target_state: str,
        message: Optional[str] = None
    ):
        default_message = f"Cannot transition {entity_type} from '{current_state}' to '{target_state}'"
        super().__init__(message or default_message, "INVALID_STATE_TRANSITION")
        self.entity_type = entity_type
        self.current_state = current_state
        self.target_state = target_state
        
        self.details.update({
            'entity_type': entity_type,
            'current_state': current_state,
            'target_state': target_state
        })


class InsufficientPermissionException(DomainException):
    """权限不足异常"""
    
    def __init__(
        self, 
        required_permission: str,
        user_permissions: Optional[List[str]] = None,
        resource: Optional[str] = None,
        message: Optional[str] = None
    ):
        default_message = f"Insufficient permission: '{required_permission}' required"
        if resource:
            default_message += f" for resource '{resource}'"
            
        super().__init__(message or default_message, "INSUFFICIENT_PERMISSION")
        self.required_permission = required_permission
        self.user_permissions = user_permissions or []
        self.resource = resource
        
        self.details.update({
            'required_permission': required_permission,
            'user_permissions': user_permissions,
            'resource': resource
        })


class ConcurrencyException(DomainException):
    """并发异常 - 当发生并发冲突时抛出"""
    
    def __init__(
        self, 
        entity_type: str,
        entity_id: Any,
        expected_version: Optional[int] = None,
        actual_version: Optional[int] = None,
        message: Optional[str] = None
    ):
        default_message = f"Concurrency conflict for {entity_type} '{entity_id}'"
        if expected_version is not None and actual_version is not None:
            default_message += f" (expected version {expected_version}, actual version {actual_version})"
            
        super().__init__(message or default_message, "CONCURRENCY_CONFLICT")
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.expected_version = expected_version
        self.actual_version = actual_version
        
        self.details.update({
            'entity_type': entity_type,
            'entity_id': str(entity_id),
            'expected_version': expected_version,
            'actual_version': actual_version
        })


class ResourceLimitExceededException(DomainException):
    """资源限制超出异常"""
    
    def __init__(
        self, 
        resource_type: str,
        limit: int,
        current_count: int,
        message: Optional[str] = None
    ):
        default_message = f"{resource_type} limit exceeded: {current_count}/{limit}"
        super().__init__(message or default_message, "RESOURCE_LIMIT_EXCEEDED")
        self.resource_type = resource_type
        self.limit = limit
        self.current_count = current_count
        
        self.details.update({
            'resource_type': resource_type,
            'limit': limit,
            'current_count': current_count
        })


class InvalidOperationException(DomainException):
    """无效操作异常"""
    
    def __init__(
        self, 
        operation: str,
        reason: str,
        context: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None
    ):
        default_message = f"Invalid operation '{operation}': {reason}"
        super().__init__(message or default_message, "INVALID_OPERATION")
        self.operation = operation
        self.reason = reason
        self.context = context or {}
        
        self.details.update({
            'operation': operation,
            'reason': reason,
            'context': context
        })


# 特定领域异常

class CollaboratorException(DomainException):
    """合作者相关异常"""
    pass


class CollaboratorAlreadyExistsException(CollaboratorException):
    """合作者已存在异常"""
    
    def __init__(self, field: str, value: str):
        message = f"Collaborator with {field} '{value}' already exists"
        super().__init__(message, "COLLABORATOR_ALREADY_EXISTS")
        self.field = field
        self.value = value


class CollaboratorCannotBeDeletedExeception(CollaboratorException):
    """合作者不能被删除异常"""
    
    def __init__(self, collaborator_id: int, reason: str):
        message = f"Collaborator {collaborator_id} cannot be deleted: {reason}"
        super().__init__(message, "COLLABORATOR_CANNOT_BE_DELETED")
        self.collaborator_id = collaborator_id
        self.reason = reason


class ProjectException(DomainException):
    """项目相关异常"""
    pass


class ProjectDeadlineException(ProjectException):
    """项目截止日期异常"""
    
    def __init__(self, project_id: int, deadline: str, current_date: str):
        message = f"Project {project_id} deadline ({deadline}) has passed (current: {current_date})"
        super().__init__(message, "PROJECT_DEADLINE_PASSED")
        self.project_id = project_id
        self.deadline = deadline
        self.current_date = current_date


class ProjectCapacityException(ProjectException):
    """项目容量异常"""
    
    def __init__(self, project_id: int, max_collaborators: int, current_count: int):
        message = f"Project {project_id} cannot accept more collaborators (max: {max_collaborators}, current: {current_count})"
        super().__init__(message, "PROJECT_CAPACITY_EXCEEDED")
        self.project_id = project_id
        self.max_collaborators = max_collaborators
        self.current_count = current_count


class IdeaException(DomainException):
    """想法相关异常"""
    pass


class IdeaAlreadyImplementedException(IdeaException):
    """想法已实现异常"""
    
    def __init__(self, idea_id: int):
        message = f"Idea {idea_id} has already been implemented"
        super().__init__(message, "IDEA_ALREADY_IMPLEMENTED")
        self.idea_id = idea_id


# 异常处理工具函数

def handle_domain_exception(exception: DomainException) -> Dict[str, Any]:
    """
    处理领域异常，返回标准化的错误响应
    """
    return {
        'success': False,
        'error': exception.to_dict(),
        'message': exception.message,
        'timestamp': __import__('datetime').datetime.utcnow().isoformat()
    }


def wrap_validation_errors(errors: List[Dict[str, str]]) -> ValidationException:
    """
    将多个验证错误包装成单个验证异常
    """
    if not errors:
        raise ValueError("No validation errors provided")
    
    if len(errors) == 1:
        error = errors[0]
        return ValidationException(
            message=error.get('message', 'Validation failed'),
            field=error.get('field'),
            value=error.get('value')
        )
    
    # 多个错误的情况
    message = f"Validation failed with {len(errors)} errors"
    return ValidationException(
        message=message,
        details={'errors': errors}
    )