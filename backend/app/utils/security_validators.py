"""
安全数据验证和输入清理工具
"""
import re
import html
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class SecurityValidator:
    """安全验证器 - 防止XSS、SQL注入等安全威胁"""
    
    # 危险的SQL关键词模式
    SQL_INJECTION_PATTERNS = [
        r'\bUNION\s+SELECT\b',
        r'\bDROP\s+TABLE\b', 
        r'\bDELETE\s+FROM\b',
        r'\bINSERT\s+INTO\b',
        r'\bUPDATE\s+SET\b',
        r'\bEXEC\s*\(',
        r'\bEXECUTE\s*\(',
        r'--',
        r'/\*.*?\*/',
        r'\bOR\s+1\s*=\s*1\b',
        r'\bAND\s+1\s*=\s*1\b',
        r'\'.*\bOR\b.*\'',
        r'\".*\bOR\b.*\"',
    ]
    
    # XSS攻击模式
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'onload\s*=',
        r'onclick\s*=',
        r'onerror\s*=',
        r'onmouseover\s*=',
        r'<iframe[^>]*>',
        r'<object[^>]*>',
        r'<embed[^>]*>',
        r'eval\s*\(',
        r'expression\s*\(',
    ]
    
    @classmethod
    def sanitize_string(cls, text: str, max_length: int = None) -> str:
        """
        清理输入字符串，防止XSS攻击
        
        Args:
            text: 需要清理的字符串
            max_length: 最大长度限制
            
        Returns:
            清理后的安全字符串
        """
        if not isinstance(text, str):
            return ""
        
        # HTML转义
        text = html.escape(text)
        
        # 移除危险的HTML标签和属性
        for pattern in cls.XSS_PATTERNS:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
        
        # 移除控制字符（除了常见的空白字符）
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\t\n\r')
        
        # 限制长度
        if max_length and len(text) > max_length:
            text = text[:max_length]
            logger.warning(f"String truncated to {max_length} characters")
        
        return text.strip()
    
    @classmethod
    def check_sql_injection(cls, text: str) -> bool:
        """
        检查字符串是否包含SQL注入攻击模式
        
        Args:
            text: 需要检查的字符串
            
        Returns:
            True如果检测到潜在的SQL注入攻击
        """
        if not isinstance(text, str):
            return False
        
        text_upper = text.upper()
        
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text_upper, re.IGNORECASE):
                logger.warning(f"Potential SQL injection detected: {pattern}")
                return True
        
        return False
    
    @classmethod
    def validate_and_sanitize_project_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证和清理项目数据
        
        Args:
            data: 项目数据字典
            
        Returns:
            包含验证结果和清理后数据的字典
        """
        errors = []
        sanitized_data = {}
        
        # 验证和清理标题
        title = data.get('title', '')
        if not title or not title.strip():
            errors.append("项目标题不能为空")
        else:
            if cls.check_sql_injection(title):
                errors.append("项目标题包含不安全的内容")
            sanitized_data['title'] = cls.sanitize_string(title, max_length=200)
        
        # 验证和清理描述
        description = data.get('idea_description', '')
        if not description or not description.strip():
            errors.append("项目描述不能为空")
        else:
            if cls.check_sql_injection(description):
                errors.append("项目描述包含不安全的内容")
            sanitized_data['idea_description'] = cls.sanitize_string(description, max_length=2000)
        
        # 验证和清理研究方法
        research_method = data.get('research_method', '')
        if research_method:
            if cls.check_sql_injection(research_method):
                errors.append("研究方法包含不安全的内容")
            else:
                sanitized_data['research_method'] = cls.sanitize_string(research_method, max_length=2000)
        
        # 验证和清理来源（旧字段，保留兼容性）
        source = data.get('source', '')
        if source:
            if cls.check_sql_injection(source):
                errors.append("来源包含不安全的内容")
            else:
                sanitized_data['source'] = cls.sanitize_string(source, max_length=2000)

        # 验证和清理参考论文（新字段）
        reference_paper = data.get('reference_paper', '')
        if reference_paper:
            if cls.check_sql_injection(reference_paper):
                errors.append("参考论文包含不安全的内容")
            else:
                sanitized_data['reference_paper'] = cls.sanitize_string(reference_paper, max_length=1000)

        # 验证和清理参考期刊（新字段）
        reference_journal = data.get('reference_journal', '')
        if reference_journal:
            if cls.check_sql_injection(reference_journal):
                errors.append("参考期刊包含不安全的内容")
            else:
                sanitized_data['reference_journal'] = cls.sanitize_string(reference_journal, max_length=200)

        # 验证和清理目标期刊
        target_journal = data.get('target_journal', '')
        if target_journal:
            if cls.check_sql_injection(target_journal):
                errors.append("目标期刊包含不安全的内容")
            else:
                sanitized_data['target_journal'] = cls.sanitize_string(target_journal, max_length=200)
        
        # 验证状态
        status = data.get('status', 'active')
        if status not in ['active', 'paused', 'completed', 'reviewing', 'revising']:
            errors.append("无效的项目状态")
        sanitized_data['status'] = status
        
        # 验证进度
        progress = data.get('progress')
        if progress is not None:
            try:
                progress = float(progress)
                if not (0 <= progress <= 100):
                    errors.append("项目进度必须在0-100之间")
                sanitized_data['progress'] = progress
            except (ValueError, TypeError):
                errors.append("项目进度必须是数字")
        
        # 验证日期
        expected_completion = data.get('expected_completion')
        if expected_completion:
            if isinstance(expected_completion, str):
                try:
                    parsed_date = datetime.strptime(expected_completion, '%Y-%m-%d').date()
                    sanitized_data['expected_completion'] = parsed_date
                except ValueError:
                    errors.append("预计完成时间格式无效，应为YYYY-MM-DD")
            elif isinstance(expected_completion, (date, datetime)):
                sanitized_data['expected_completion'] = expected_completion
        
        # 验证开始日期
        start_date = data.get('start_date')
        if start_date:
            if isinstance(start_date, str):
                try:
                    # 处理ISO格式的日期时间字符串
                    if 'T' in start_date:
                        parsed_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    else:
                        parsed_date = datetime.strptime(start_date, '%Y-%m-%d')
                    sanitized_data['start_date'] = parsed_date
                except ValueError:
                    errors.append("开始时间格式无效")
            elif isinstance(start_date, (date, datetime)):
                sanitized_data['start_date'] = start_date
        else:
            # 如果没有提供start_date，明确设置为None
            sanitized_data['start_date'] = None
        
        # 验证合作者IDs
        collaborator_ids = data.get('collaborator_ids', [])
        if collaborator_ids:
            try:
                sanitized_ids = []
                for cid in collaborator_ids:
                    if isinstance(cid, str) and cid.isdigit():
                        sanitized_ids.append(int(cid))
                    elif isinstance(cid, int) and cid > 0:
                        sanitized_ids.append(cid)
                    else:
                        errors.append(f"无效的合作者ID: {cid}")
                sanitized_data['collaborator_ids'] = sanitized_ids
            except (ValueError, TypeError):
                errors.append("合作者ID必须是有效的数字")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'sanitized_data': sanitized_data
        }
    
    @classmethod
    def validate_and_sanitize_collaborator_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证和清理合作者数据
        """
        errors = []
        sanitized_data = {}
        
        # 验证姓名
        name = data.get('name', '')
        if not name or not name.strip():
            errors.append("合作者姓名不能为空")
        else:
            if cls.check_sql_injection(name):
                errors.append("合作者姓名包含不安全的内容")
            sanitized_data['name'] = cls.sanitize_string(name, max_length=50)
        
        # 验证邮箱
        email = data.get('email', '')
        if email:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                errors.append("邮箱格式无效")
            else:
                sanitized_data['email'] = email.lower().strip()
        
        # 验证班级
        class_name = data.get('class_name', '')
        if class_name:
            if cls.check_sql_injection(class_name):
                errors.append("班级名称包含不安全的内容")
            sanitized_data['class_name'] = cls.sanitize_string(class_name, max_length=100)
        
        # 验证性别
        gender = data.get('gender', '')
        if gender and gender not in ['男', '女', 'M', 'F', 'male', 'female']:
            errors.append("无效的性别值")
        if gender:
            sanitized_data['gender'] = gender

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'sanitized_data': sanitized_data
        }
    
    @classmethod
    def validate_and_sanitize_communication_log(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证和清理交流日志数据
        """
        errors = []
        sanitized_data = {}
        
        # 验证标题
        title = data.get('title', '')
        if title:
            if cls.check_sql_injection(title):
                errors.append("标题包含不安全的内容")
            sanitized_data['title'] = cls.sanitize_string(title, max_length=200)
        
        # 验证内容
        content = data.get('content', '')
        if not content or not content.strip():
            errors.append("交流内容不能为空")
        else:
            if cls.check_sql_injection(content):
                errors.append("交流内容包含不安全的内容")
            sanitized_data['content'] = cls.sanitize_string(content, max_length=5000)

        # 验证交流类型
        communication_type = data.get('communication_type', 'meeting')
        valid_types = ['meeting', 'email', 'phone', 'video_call', 'in_person', 'chat']
        if communication_type not in valid_types:
            errors.append(f"无效的交流类型，有效值: {valid_types}")
        sanitized_data['communication_type'] = communication_type
        
        # 验证日期
        communication_date = data.get('communication_date')
        if communication_date:
            if isinstance(communication_date, str):
                try:
                    # 尝试解析 ISO 格式
                    if 'T' in communication_date:
                        parsed_date = datetime.fromisoformat(communication_date.replace('Z', '+00:00'))
                    else:
                        parsed_date = datetime.strptime(communication_date, '%Y-%m-%d')
                    sanitized_data['communication_date'] = parsed_date
                except ValueError:
                    errors.append("交流日期格式无效")
            elif isinstance(communication_date, (date, datetime)):
                sanitized_data['communication_date'] = communication_date
        
        # 验证项目ID
        project_id = data.get('project_id')
        if project_id:
            try:
                sanitized_data['project_id'] = int(project_id)
            except (ValueError, TypeError):
                errors.append("项目ID必须是有效的数字")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'sanitized_data': sanitized_data
        }