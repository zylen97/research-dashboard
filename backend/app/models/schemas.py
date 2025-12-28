from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union
from datetime import datetime

# Collaborator schemas（极简版 - 只保留3个业务字段）
class CollaboratorBase(BaseModel):
    name: str = Field(..., max_length=100, description="姓名")
    background: str = Field(..., description="背景信息")
    is_senior: Optional[bool] = Field(default=True, description="高级合作者")

class CollaboratorCreate(CollaboratorBase):
    pass

class CollaboratorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100, description="姓名")
    background: Optional[str] = Field(None, description="背景信息")
    is_senior: Optional[bool] = None

class Collaborator(CollaboratorBase):
    id: int
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    project_count: int = 0  # 参与的项目数量（计算属性，不存储在数据库）

    class Config:
        from_attributes = True

# Research Project schemas
class ResearchProjectBase(BaseModel):
    title: str = Field(..., max_length=200)
    idea_description: str
    research_method: Optional[str] = Field(None, description="研究方法")
    source: Optional[str] = Field(None, description="来源")
    target_journal: Optional[str] = Field(None, description="(拟)投稿期刊")
    status: str = Field(default="active", max_length=50)
    progress: float = Field(default=0.0, ge=0, le=100)
    expected_completion: Optional[datetime] = None
    is_todo: bool = Field(default=False)

    # 我的身份字段
    my_role: str = Field(default='other_author', description="我的身份: first_author/corresponding_author/other_author")

    @field_validator('my_role')
    @classmethod
    def validate_my_role(cls, v):
        valid_roles = ['first_author', 'corresponding_author', 'other_author']
        if v not in valid_roles:
            raise ValueError(f'my_role must be one of {valid_roles}')
        return v

class ResearchProjectCreate(ResearchProjectBase):
    collaborator_ids: List[int] = []
    is_todo: Optional[bool] = Field(default=False)
    start_date: Optional[datetime] = Field(None, description="项目开始时间")

class ResearchProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    idea_description: Optional[str] = None
    research_method: Optional[str] = None
    source: Optional[str] = None
    target_journal: Optional[str] = Field(None, description="(拟)投稿期刊")
    status: Optional[str] = Field(None, max_length=50)
    progress: Optional[float] = Field(None, ge=0, le=100)
    expected_completion: Optional[datetime] = None
    collaborator_ids: Optional[List[int]] = None
    is_todo: Optional[bool] = None
    start_date: Optional[datetime] = Field(None, description="项目开始时间")

    # 我的身份字段（可选更新）
    my_role: Optional[str] = None

    @field_validator('my_role')
    @classmethod
    def validate_my_role(cls, v):
        if v is not None:
            valid_roles = ['first_author', 'corresponding_author', 'other_author']
            if v not in valid_roles:
                raise ValueError(f'my_role must be one of {valid_roles}')
        return v

class ResearchProject(ResearchProjectBase):
    id: int
    start_date: datetime
    is_todo: bool
    todo_marked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    collaborators: List[Collaborator] = []
    communication_logs: List['CommunicationLog'] = []  # 交流记录
    latest_communication: Optional[str] = None  # 最新交流进度摘要
    actual_start_date: Optional[datetime] = None    # 从交流日志计算的实际开始时间

    class Config:
        from_attributes = True


# Communication Log schemas
class CommunicationLogBase(BaseModel):
    project_id: int
    collaborator_id: Optional[int] = None
    communication_type: str = Field(..., max_length=50)
    title: str = Field(..., max_length=200)
    content: str
    outcomes: Optional[str] = None
    communication_date: datetime = Field(default_factory=datetime.utcnow)

class CommunicationLogCreate(BaseModel):
    collaborator_id: Optional[int] = None
    communication_type: str = Field(..., max_length=50)
    title: str = Field(..., max_length=200, min_length=1)
    content: str = Field(..., min_length=1)
    outcomes: Optional[str] = None
    communication_date: Union[str, datetime] = Field(default_factory=datetime.utcnow)
    
    @field_validator('title', 'content', mode='before')
    def strip_and_validate_text(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:  # 去除空白后如果为空，返回None让min_length验证失败
                return None
        return v

    @field_validator('communication_date', mode='before')
    def parse_communication_date(cls, v):
        if v is None:
            return datetime.utcnow()
        if isinstance(v, str):
            # 尝试解析日期字符串
            try:
                # 首先尝试解析 YYYY-MM-DD 格式
                if len(v) == 10 and v.count('-') == 2:
                    return datetime.strptime(v, '%Y-%m-%d')
                # 尝试解析带时间的格式
                return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                # 如果解析失败，返回当前时间
                return datetime.utcnow()
        return v

class CommunicationLogUpdate(BaseModel):
    communication_type: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    outcomes: Optional[str] = None
    communication_date: Optional[Union[str, datetime]] = None
    
    @field_validator('communication_date', mode='before')
    def parse_communication_date(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                # 首先尝试解析 YYYY-MM-DD 格式
                if len(v) == 10 and v.count('-') == 2:
                    return datetime.strptime(v, '%Y-%m-%d')
                # 尝试解析带时间的格式
                return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                return None
        return v

class CommunicationLog(CommunicationLogBase):
    id: int
    created_at: datetime
    updated_at: datetime
    collaborator: Optional[Collaborator] = None
    
    class Config:
        from_attributes = True

# File upload schemas
class FileUploadResponse(BaseModel):
    message: str
    imported_count: int
    errors: List[str] = []


# System Config schemas
class SystemConfigBase(BaseModel):
    key: str = Field(..., max_length=100)
    value: str
    category: str = Field(default="general", max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    is_encrypted: bool = Field(default=False)
    is_active: bool = Field(default=True)

class SystemConfigCreate(SystemConfigBase):
    pass

class SystemConfigUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None

class SystemConfig(SystemConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# AI Provider configuration
class AIProviderConfig(BaseModel):
    provider: Optional[str] = Field(default="custom", description="Legacy field for backward compatibility")
    api_key: str = Field(..., description="API密钥")
    api_url: Optional[str] = Field(None, description="API地址，默认使用官方地址")
    model: Optional[str] = Field(None, description="默认模型")
    max_tokens: Optional[int] = Field(None, description="最大token数")
    temperature: Optional[float] = Field(None, description="温度参数")

class AITestRequest(BaseModel):
    api_key: str
    api_url: Optional[str] = None
    model: Optional[str] = None
    test_prompt: str = Field(default="Hello, please respond with 'API connection successful'")
    provider: Optional[str] = Field(default="custom", description="Legacy field for backward compatibility")

class AITestResponse(BaseModel):
    success: bool
    message: str
    response: Optional[str] = None

# Ideas管理 schemas - 重新设计版本
class IdeaBase(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    project_description: Optional[str] = Field(None, max_length=2000, description="项目描述")
    research_method: str = Field(..., min_length=1, max_length=1000, description="研究方法")
    source: Optional[str] = Field(None, max_length=500, description="来源信息")
    responsible_person: str = Field(..., min_length=1, max_length=100, description="负责人")
    maturity: str = Field(default="immature", description="成熟度：mature/immature")
    
    @field_validator('maturity')
    @classmethod
    def validate_maturity(cls, v):
        if v not in ['mature', 'immature']:
            raise ValueError('maturity must be either "mature" or "immature"')
        return v

class IdeaCreate(IdeaBase):
    """创建Ideas的数据模型"""
    pass

class IdeaUpdate(BaseModel):
    """更新Ideas的数据模型"""
    project_name: Optional[str] = Field(None, min_length=1, max_length=200, description="项目名称")
    project_description: Optional[str] = Field(None, max_length=2000, description="项目描述")
    research_method: Optional[str] = Field(None, min_length=1, max_length=1000, description="研究方法")
    source: Optional[str] = Field(None, max_length=500, description="来源信息")
    responsible_person: Optional[str] = Field(None, min_length=1, max_length=100, description="负责人")
    maturity: Optional[str] = Field(None, description="成熟度：mature/immature")
    
    @field_validator('maturity')
    @classmethod
    def validate_maturity(cls, v):
        if v is not None and v not in ['mature', 'immature']:
            raise ValueError('maturity must be either "mature" or "immature"')
        return v

class Idea(IdeaBase):
    """完整的Ideas数据模型"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Schema aliases for compatibility
IdeaSchema = Idea

# Update forward references
ResearchProject.model_rebuild()  # Fix CommunicationLog forward reference