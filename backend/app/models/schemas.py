from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Union
from datetime import datetime

# Collaborator schemas
class CollaboratorBase(BaseModel):
    name: str = Field(..., max_length=100)
    gender: Optional[str] = Field(None, max_length=10)
    class_name: Optional[str] = Field(None, max_length=100)
    future_plan: Optional[str] = None
    background: Optional[str] = None
    contact_info: Optional[str] = Field(None, max_length=200)
    is_senior: Optional[bool] = Field(default=True)

class CollaboratorCreate(CollaboratorBase):
    pass

class CollaboratorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    gender: Optional[str] = Field(None, max_length=10)
    class_name: Optional[str] = Field(None, max_length=100)
    future_plan: Optional[str] = None
    background: Optional[str] = None
    contact_info: Optional[str] = Field(None, max_length=200)
    is_senior: Optional[bool] = None

class Collaborator(CollaboratorBase):
    id: int
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Research Project schemas
class ResearchProjectBase(BaseModel):
    title: str = Field(..., max_length=200)
    idea_description: str
    status: str = Field(default="active", max_length=50)
    progress: float = Field(default=0.0, ge=0, le=100)
    expected_completion: Optional[datetime] = None
    is_todo: bool = Field(default=False)

class ResearchProjectCreate(ResearchProjectBase):
    collaborator_ids: List[int] = []
    is_todo: Optional[bool] = Field(default=False)

class ResearchProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    idea_description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    progress: Optional[float] = Field(None, ge=0, le=100)
    expected_completion: Optional[datetime] = None
    collaborator_ids: Optional[List[int]] = None
    is_todo: Optional[bool] = None

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
    action_items: Optional[str] = None
    communication_date: datetime = Field(default_factory=datetime.utcnow)

class CommunicationLogCreate(BaseModel):
    collaborator_id: Optional[int] = None
    communication_type: str = Field(..., max_length=50)
    title: str = Field(..., max_length=200, min_length=1)
    content: str = Field(..., min_length=1)
    outcomes: Optional[str] = None
    action_items: Optional[str] = None
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
    action_items: Optional[str] = None
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


# User schemas
class UserBase(BaseModel):
    username: str = Field(..., max_length=50)
    email: EmailStr
    display_name: str = Field(..., max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=50)

class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Auth response schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User

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
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    
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

# Idea schemas
class IdeaBase(BaseModel):
    research_question: str = Field(..., description="研究问题")
    research_method: str = Field(..., description="研究方法")
    source_journal: str = Field(..., description="来源期刊")
    source_literature: str = Field(..., description="来源文献")
    maturity: str = Field(default="immature", description="成熟度：mature/immature")
    description: Optional[str] = Field(None, description="额外描述")
    collaborator_id: Optional[int] = Field(None, description="负责人ID")
    
    @field_validator('maturity')
    def validate_maturity(cls, v):
        if v not in ['mature', 'immature']:
            raise ValueError('maturity must be either "mature" or "immature"')
        return v

class IdeaCreate(IdeaBase):
    pass

class IdeaUpdate(BaseModel):
    research_question: Optional[str] = None
    research_method: Optional[str] = None
    source_journal: Optional[str] = None
    source_literature: Optional[str] = None
    maturity: Optional[str] = Field(None, description="成熟度：mature/immature")
    description: Optional[str] = None
    collaborator_id: Optional[int] = None
    
    @field_validator('maturity')
    def validate_maturity(cls, v):
        if v is not None and v not in ['mature', 'immature']:
            raise ValueError('maturity must be either "mature" or "immature"')
        return v

class Idea(IdeaBase):
    id: int
    created_at: datetime
    updated_at: datetime
    collaborator: Optional['Collaborator'] = None
    
    class Config:
        from_attributes = True


# Schema aliases for compatibility
IdeaSchema = Idea

# Update forward references
ResearchProject.model_rebuild()  # Fix CommunicationLog forward reference