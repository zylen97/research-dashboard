#!/usr/bin/env python3
"""
🏗️ Collaborator Domain Entity
领域实体 - 合作者

DDD架构中的核心实体，包含业务规则和不变性约束
这个实体包含了合作者的核心业务逻辑，独立于基础设施层

创建时间：2025-07-24
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from ..value_objects import Email, Phone, StudentId
from ..exceptions import DomainException


class CollaboratorLevel(Enum):
    """合作者级别枚举"""
    FRESHMAN = "freshman"        # 大一
    SOPHOMORE = "sophomore"      # 大二
    JUNIOR = "junior"           # 大三
    SENIOR = "senior"           # 大四
    GRADUATE = "graduate"       # 研究生
    PHD = "phd"                 # 博士生
    ALUMNI = "alumni"           # 毕业生


class CollaboratorStatus(Enum):
    """合作者状态枚举"""
    ACTIVE = "active"           # 活跃
    INACTIVE = "inactive"       # 不活跃
    GRADUATED = "graduated"     # 已毕业
    SUSPENDED = "suspended"     # 暂停
    DELETED = "deleted"         # 已删除


@dataclass(frozen=True)
class CollaboratorId:
    """合作者ID值对象"""
    value: int
    
    def __post_init__(self):
        if self.value <= 0:
            raise DomainException("Collaborator ID must be positive")


class Collaborator:
    """
    合作者领域实体
    
    职责：
    - 维护合作者的核心信息
    - 执行业务规则验证
    - 处理状态转换
    - 管理技能和研究兴趣
    """
    
    def __init__(
        self,
        id: Optional[CollaboratorId],
        name: str,
        level: CollaboratorLevel,
        gender: Optional[str] = None,
        student_id: Optional[StudentId] = None,
        grade: Optional[str] = None,
        major: Optional[str] = None,
        class_name: Optional[str] = None,
        email: Optional[Email] = None,
        phone: Optional[Phone] = None,
        qq: Optional[str] = None,
        wechat: Optional[str] = None,
        skills: Optional[List[str]] = None,
        research_interests: Optional[List[str]] = None,
        future_plan: Optional[str] = None,
        contact_info: Optional[str] = None,
        status: CollaboratorStatus = CollaboratorStatus.ACTIVE,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        # 验证必要字段
        if not name or not name.strip():
            raise DomainException("Collaborator name cannot be empty")
        
        if len(name.strip()) > 100:
            raise DomainException("Collaborator name cannot exceed 100 characters")
        
        # 初始化属性
        self._id = id
        self._name = name.strip()
        self._level = level
        self._gender = gender
        self._student_id = student_id
        self._grade = grade
        self._major = major
        self._class_name = class_name
        self._email = email
        self._phone = phone
        self._qq = qq
        self._wechat = wechat
        self._skills = skills or []
        self._research_interests = research_interests or []
        self._future_plan = future_plan
        self._contact_info = contact_info
        self._status = status
        self._created_at = created_at or datetime.utcnow()
        self._updated_at = updated_at or datetime.utcnow()
        
        # 验证业务规则
        self._validate_business_rules()
    
    def _validate_business_rules(self):
        """验证业务规则"""
        
        # 如果有学号，必须有年级和专业
        if self._student_id and not (self._grade and self._major):
            raise DomainException("Student must have grade and major")
        
        # 毕业生不能是大一到大四
        if self._status == CollaboratorStatus.GRADUATED:
            if self._level in [CollaboratorLevel.FRESHMAN, CollaboratorLevel.SOPHOMORE, 
                              CollaboratorLevel.JUNIOR, CollaboratorLevel.SENIOR]:
                raise DomainException("Graduated collaborator cannot be undergraduate")
        
        # 联系方式至少要有一种
        if not any([self._email, self._phone, self._qq, self._wechat, self._contact_info]):
            raise DomainException("At least one contact method is required")
    
    # 属性访问器
    @property
    def id(self) -> Optional[CollaboratorId]:
        return self._id
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def level(self) -> CollaboratorLevel:
        return self._level
    
    @property
    def status(self) -> CollaboratorStatus:
        return self._status
    
    @property
    def is_senior_level(self) -> bool:
        """判断是否为高年级"""
        return self._level in [
            CollaboratorLevel.SENIOR, 
            CollaboratorLevel.GRADUATE, 
            CollaboratorLevel.PHD
        ]
    
    @property
    def is_active(self) -> bool:
        """判断是否活跃"""
        return self._status == CollaboratorStatus.ACTIVE
    
    @property
    def email(self) -> Optional[Email]:
        return self._email
    
    @property
    def student_id(self) -> Optional[StudentId]:
        return self._student_id
    
    @property
    def skills(self) -> List[str]:
        return self._skills.copy()
    
    @property
    def research_interests(self) -> List[str]:
        return self._research_interests.copy()
    
    @property
    def created_at(self) -> datetime:
        return self._created_at
    
    @property
    def updated_at(self) -> datetime:
        return self._updated_at
    
    # 业务方法
    def update_personal_info(
        self,
        name: Optional[str] = None,
        gender: Optional[str] = None,
        grade: Optional[str] = None,
        major: Optional[str] = None,
        class_name: Optional[str] = None
    ) -> None:
        """更新个人信息"""
        if name is not None:
            if not name.strip():
                raise DomainException("Name cannot be empty")
            if len(name.strip()) > 100:
                raise DomainException("Name cannot exceed 100 characters")
            self._name = name.strip()
        
        if gender is not None:
            self._gender = gender
        
        if grade is not None:
            self._grade = grade
        
        if major is not None:
            self._major = major
        
        if class_name is not None:
            self._class_name = class_name
        
        self._updated_at = datetime.utcnow()
        self._validate_business_rules()
    
    def update_contact_info(
        self,
        email: Optional[Email] = None,
        phone: Optional[Phone] = None,
        qq: Optional[str] = None,
        wechat: Optional[str] = None,
        contact_info: Optional[str] = None
    ) -> None:
        """更新联系方式"""
        if email is not None:
            self._email = email
        
        if phone is not None:
            self._phone = phone
        
        if qq is not None:
            self._qq = qq
        
        if wechat is not None:
            self._wechat = wechat
        
        if contact_info is not None:
            self._contact_info = contact_info
        
        self._updated_at = datetime.utcnow()
        self._validate_business_rules()
    
    def add_skill(self, skill: str) -> None:
        """添加技能"""
        if not skill or not skill.strip():
            raise DomainException("Skill cannot be empty")
        
        skill = skill.strip()
        if skill not in self._skills:
            self._skills.append(skill)
            self._updated_at = datetime.utcnow()
    
    def remove_skill(self, skill: str) -> None:
        """移除技能"""
        if skill in self._skills:
            self._skills.remove(skill)
            self._updated_at = datetime.utcnow()
    
    def add_research_interest(self, interest: str) -> None:
        """添加研究兴趣"""
        if not interest or not interest.strip():
            raise DomainException("Research interest cannot be empty")
        
        interest = interest.strip()
        if interest not in self._research_interests:
            self._research_interests.append(interest)
            self._updated_at = datetime.utcnow()
    
    def remove_research_interest(self, interest: str) -> None:
        """移除研究兴趣"""
        if interest in self._research_interests:
            self._research_interests.remove(interest)
            self._updated_at = datetime.utcnow()
    
    def update_level(self, new_level: CollaboratorLevel) -> None:
        """更新级别"""
        if new_level != self._level:
            self._level = new_level
            self._updated_at = datetime.utcnow()
            self._validate_business_rules()
    
    def graduate(self) -> None:
        """标记为毕业"""
        if self._status == CollaboratorStatus.GRADUATED:
            raise DomainException("Collaborator is already graduated")
        
        self._status = CollaboratorStatus.GRADUATED
        self._level = CollaboratorLevel.ALUMNI
        self._updated_at = datetime.utcnow()
    
    def suspend(self, reason: Optional[str] = None) -> None:
        """暂停合作者"""
        if self._status == CollaboratorStatus.SUSPENDED:
            raise DomainException("Collaborator is already suspended")
        
        self._status = CollaboratorStatus.SUSPENDED
        self._updated_at = datetime.utcnow()
    
    def reactivate(self) -> None:
        """重新激活合作者"""
        if self._status == CollaboratorStatus.ACTIVE:
            raise DomainException("Collaborator is already active")
        
        if self._status == CollaboratorStatus.DELETED:
            raise DomainException("Cannot reactivate deleted collaborator")
        
        self._status = CollaboratorStatus.ACTIVE
        self._updated_at = datetime.utcnow()
    
    def soft_delete(self) -> None:
        """软删除合作者"""
        if self._status == CollaboratorStatus.DELETED:
            raise DomainException("Collaborator is already deleted")
        
        self._status = CollaboratorStatus.DELETED
        self._updated_at = datetime.utcnow()
    
    def can_participate_in_project(self) -> bool:
        """判断是否可以参与项目"""
        return self._status in [CollaboratorStatus.ACTIVE, CollaboratorStatus.INACTIVE]
    
    def get_display_name(self) -> str:
        """获取显示名称"""
        if self._student_id:
            return f"{self._name} ({self._student_id.value})"
        return self._name
    
    def calculate_experience_years(self) -> float:
        """计算合作经验年数"""
        now = datetime.utcnow()
        delta = now - self._created_at
        return round(delta.days / 365.25, 1)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self._id.value if self._id else None,
            'name': self._name,
            'level': self._level.value,
            'status': self._status.value,
            'gender': self._gender,
            'student_id': self._student_id.value if self._student_id else None,
            'grade': self._grade,
            'major': self._major,
            'class_name': self._class_name,
            'email': self._email.value if self._email else None,
            'phone': self._phone.value if self._phone else None,
            'qq': self._qq,
            'wechat': self._wechat,
            'skills': self._skills,
            'research_interests': self._research_interests,
            'future_plan': self._future_plan,
            'contact_info': self._contact_info,
            'is_senior_level': self.is_senior_level,
            'is_active': self.is_active,
            'experience_years': self.calculate_experience_years(),
            'created_at': self._created_at.isoformat(),
            'updated_at': self._updated_at.isoformat(),
        }
    
    def __eq__(self, other):
        if not isinstance(other, Collaborator):
            return False
        return self._id == other._id if self._id and other._id else False
    
    def __hash__(self):
        return hash(self._id.value) if self._id else hash(id(self))
    
    def __repr__(self):
        return f"Collaborator(id={self._id}, name='{self._name}', level={self._level.value})"