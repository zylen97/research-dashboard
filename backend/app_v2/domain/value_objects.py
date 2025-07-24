#!/usr/bin/env python3
"""
🏗️ Domain Value Objects
领域值对象

值对象是DDD中表示概念的不可变对象，通过属性而非身份来定义相等性
这些值对象封装了业务规则和验证逻辑

创建时间：2025-07-24
"""

import re
from dataclasses import dataclass
from typing import Optional, List
from .exceptions import DomainException


@dataclass(frozen=True)
class Email:
    """邮箱地址值对象"""
    value: str
    
    def __post_init__(self):
        if not self.value:
            raise DomainException("Email cannot be empty")
        
        # 简单的邮箱格式验证
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, self.value):
            raise DomainException(f"Invalid email format: {self.value}")
        
        if len(self.value) > 254:  # RFC 5321 限制
            raise DomainException("Email address too long")
    
    @property
    def domain(self) -> str:
        """获取邮箱域名"""
        return self.value.split('@')[1]
    
    @property
    def local_part(self) -> str:
        """获取邮箱用户名部分"""
        return self.value.split('@')[0]
    
    def is_educational(self) -> bool:
        """判断是否为教育邮箱"""
        educational_domains = ['.edu', '.edu.cn', '.ac.cn', '.org.cn']
        return any(self.domain.endswith(suffix) for suffix in educational_domains)


@dataclass(frozen=True)
class Phone:
    """电话号码值对象"""
    value: str
    
    def __post_init__(self):
        if not self.value:
            raise DomainException("Phone number cannot be empty")
        
        # 移除所有非数字字符进行验证
        digits_only = re.sub(r'[^\d]', '', self.value)
        
        # 中国手机号验证（11位，以1开头）
        if len(digits_only) == 11 and digits_only.startswith('1'):
            # 验证手机号格式
            pattern = r'^1[3-9]\d{9}$'
            if not re.match(pattern, digits_only):
                raise DomainException(f"Invalid Chinese mobile number: {self.value}")
        # 国际号码（允许更灵活的格式）
        elif len(digits_only) >= 7:
            if not digits_only.isdigit():
                raise DomainException(f"Phone number contains invalid characters: {self.value}")
        else:
            raise DomainException(f"Phone number too short: {self.value}")
    
    @property
    def digits_only(self) -> str:
        """获取纯数字格式"""
        return re.sub(r'[^\d]', '', self.value)
    
    @property
    def formatted(self) -> str:
        """获取格式化后的号码"""
        digits = self.digits_only
        if len(digits) == 11 and digits.startswith('1'):
            # 中国手机号格式：138-0013-8000
            return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
        return self.value
    
    def is_mobile(self) -> bool:
        """判断是否为手机号"""
        digits = self.digits_only
        return len(digits) == 11 and digits.startswith('1')


@dataclass(frozen=True)
class StudentId:
    """学号值对象"""
    value: str
    
    def __post_init__(self):
        if not self.value:
            raise DomainException("Student ID cannot be empty")
        
        # 学号基本格式验证
        if len(self.value) < 4 or len(self.value) > 20:
            raise DomainException("Student ID length must be between 4 and 20 characters")
        
        # 只允许字母、数字和连字符
        if not re.match(r'^[a-zA-Z0-9\-]+$', self.value):
            raise DomainException("Student ID can only contain letters, numbers and hyphens")
    
    @property
    def year(self) -> Optional[str]:
        """尝试提取入学年份"""
        # 尝试从学号中提取年份（前4位数字）
        match = re.match(r'^(\d{4})', self.value)
        if match:
            year = int(match.group(1))
            if 2000 <= year <= 2030:
                return str(year)
        return None
    
    @property
    def sequence(self) -> Optional[str]:
        """尝试提取序号部分"""
        # 提取年份后的数字部分
        if self.year:
            remaining = self.value[4:]
            match = re.search(r'(\d+)', remaining)
            if match:
                return match.group(1)
        return None


@dataclass(frozen=True)
class ProjectTitle:
    """项目标题值对象"""
    value: str
    
    def __post_init__(self):
        if not self.value or not self.value.strip():
            raise DomainException("Project title cannot be empty")
        
        title = self.value.strip()
        if len(title) < 3:
            raise DomainException("Project title must be at least 3 characters")
        
        if len(title) > 200:
            raise DomainException("Project title cannot exceed 200 characters")
        
        # 替换原值为清理后的值
        object.__setattr__(self, 'value', title)
    
    @property
    def word_count(self) -> int:
        """获取词数"""
        return len(self.value.split())
    
    def contains_keyword(self, keyword: str) -> bool:
        """检查是否包含关键词"""
        return keyword.lower() in self.value.lower()


@dataclass(frozen=True)
class Priority:
    """优先级值对象"""
    value: int
    
    def __post_init__(self):
        if not isinstance(self.value, int):
            raise DomainException("Priority must be an integer")
        
        if not (1 <= self.value <= 5):
            raise DomainException("Priority must be between 1 and 5")
    
    @property
    def description(self) -> str:
        """获取优先级描述"""
        descriptions = {
            1: "Very Low",
            2: "Low", 
            3: "Medium",
            4: "High",
            5: "Very High"
        }
        return descriptions[self.value]
    
    @property
    def is_high(self) -> bool:
        """判断是否为高优先级"""
        return self.value >= 4
    
    @property
    def is_urgent(self) -> bool:
        """判断是否紧急"""
        return self.value == 5


@dataclass(frozen=True)
class Progress:
    """进度值对象"""
    value: float
    
    def __post_init__(self):
        if not isinstance(self.value, (int, float)):
            raise DomainException("Progress must be a number")
        
        if not (0.0 <= self.value <= 100.0):
            raise DomainException("Progress must be between 0 and 100")
    
    @property
    def percentage(self) -> str:
        """获取百分比字符串"""
        return f"{self.value:.1f}%"
    
    @property
    def is_completed(self) -> bool:
        """判断是否已完成"""
        return self.value >= 100.0
    
    @property
    def is_started(self) -> bool:
        """判断是否已开始"""
        return self.value > 0.0
    
    @property
    def status_description(self) -> str:
        """获取状态描述"""
        if self.value == 0.0:
            return "Not Started"
        elif self.value < 25.0:
            return "Just Started"
        elif self.value < 50.0:
            return "In Progress"
        elif self.value < 75.0:
            return "Making Good Progress"
        elif self.value < 100.0:
            return "Nearly Complete"
        else:
            return "Completed"


@dataclass(frozen=True)
class DateRange:
    """日期范围值对象"""
    start_date: Optional[str]
    end_date: Optional[str]
    
    def __post_init__(self):
        if self.start_date and self.end_date:
            # 这里可以添加日期格式验证和逻辑验证
            # 简化实现，实际应该使用datetime对象
            if self.start_date > self.end_date:
                raise DomainException("Start date cannot be after end date")
    
    @property
    def is_valid_range(self) -> bool:
        """检查是否为有效范围"""
        return bool(self.start_date and self.end_date)
    
    @property
    def has_start_only(self) -> bool:
        """检查是否只有开始日期"""
        return bool(self.start_date and not self.end_date)


@dataclass(frozen=True)
class Skill:
    """技能值对象"""
    name: str
    level: Optional[str] = None  # Beginner, Intermediate, Advanced, Expert
    
    def __post_init__(self):
        if not self.name or not self.name.strip():
            raise DomainException("Skill name cannot be empty")
        
        name = self.name.strip()
        if len(name) > 50:
            raise DomainException("Skill name cannot exceed 50 characters")
        
        # 替换原值为清理后的值
        object.__setattr__(self, 'name', name)
        
        # 验证技能级别
        if self.level:
            valid_levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
            if self.level not in valid_levels:
                raise DomainException(f"Invalid skill level: {self.level}")
    
    @property
    def display_name(self) -> str:
        """获取显示名称"""
        if self.level:
            return f"{self.name} ({self.level})"
        return self.name
    
    def is_advanced(self) -> bool:
        """判断是否为高级技能"""
        return self.level in ['Advanced', 'Expert']


@dataclass(frozen=True)
class Tag:
    """标签值对象"""
    value: str
    
    def __post_init__(self):
        if not self.value or not self.value.strip():
            raise DomainException("Tag cannot be empty")
        
        tag = self.value.strip().lower()
        
        if len(tag) > 30:
            raise DomainException("Tag cannot exceed 30 characters")
        
        # 标签只允许字母、数字、中文和连字符
        if not re.match(r'^[\w\u4e00-\u9fff\-]+$', tag):
            raise DomainException("Tag contains invalid characters")
        
        # 替换原值为清理后的值
        object.__setattr__(self, 'value', tag)
    
    @property
    def display_value(self) -> str:
        """获取显示值（首字母大写）"""
        return self.value.capitalize()


@dataclass(frozen=True)
class Money:
    """金额值对象"""
    amount: float
    currency: str = "CNY"
    
    def __post_init__(self):
        if not isinstance(self.amount, (int, float)):
            raise DomainException("Amount must be a number")
        
        if self.amount < 0:
            raise DomainException("Amount cannot be negative")
        
        if self.currency not in ['CNY', 'USD', 'EUR', 'GBP']:
            raise DomainException(f"Unsupported currency: {self.currency}")
    
    @property
    def formatted(self) -> str:
        """获取格式化的金额"""
        symbols = {'CNY': '¥', 'USD': '$', 'EUR': '€', 'GBP': '£'}
        symbol = symbols.get(self.currency, self.currency)
        return f"{symbol}{self.amount:,.2f}"
    
    def __add__(self, other):
        if not isinstance(other, Money):
            raise DomainException("Can only add Money objects")
        if self.currency != other.currency:
            raise DomainException("Cannot add different currencies")
        return Money(self.amount + other.amount, self.currency)
    
    def __sub__(self, other):
        if not isinstance(other, Money):
            raise DomainException("Can only subtract Money objects")
        if self.currency != other.currency:
            raise DomainException("Cannot subtract different currencies")
        return Money(self.amount - other.amount, self.currency)