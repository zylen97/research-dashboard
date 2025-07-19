from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Collaborator schemas
class CollaboratorBase(BaseModel):
    name: str = Field(..., max_length=100)
    gender: Optional[str] = Field(None, max_length=10)
    class_name: Optional[str] = Field(None, max_length=100)
    future_plan: Optional[str] = None
    background: Optional[str] = None
    contact_info: Optional[str] = Field(None, max_length=200)
    is_senior: Optional[bool] = Field(default=False)

class CollaboratorCreate(CollaboratorBase):
    pass

class CollaboratorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    gender: Optional[str] = Field(None, max_length=10)
    class_name: Optional[str] = Field(None, max_length=100)
    future_plan: Optional[str] = None
    background: Optional[str] = None
    contact_info: Optional[str] = Field(None, max_length=200)

class Collaborator(CollaboratorBase):
    id: int
    is_senior: bool
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

class ResearchProjectCreate(ResearchProjectBase):
    collaborator_ids: List[int] = []

class ResearchProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    idea_description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    progress: Optional[float] = Field(None, ge=0, le=100)
    expected_completion: Optional[datetime] = None
    collaborator_ids: Optional[List[int]] = None

class ResearchProject(ResearchProjectBase):
    id: int
    start_date: datetime
    created_at: datetime
    updated_at: datetime
    collaborators: List[Collaborator] = []
    latest_communication: Optional[str] = None  # 最新交流进度摘要
    actual_start_date: Optional[datetime] = None    # 从交流日志计算的实际开始时间
    
    class Config:
        from_attributes = True

# Literature schemas
class LiteratureBase(BaseModel):
    title: str = Field(..., max_length=500)
    authors: Optional[str] = Field(None, max_length=500)
    journal: Optional[str] = Field(None, max_length=200)
    year: Optional[int] = Field(None, ge=1900, le=2030)
    doi: Optional[str] = Field(None, max_length=100)
    abstract: Optional[str] = None
    keywords: Optional[str] = Field(None, max_length=500)
    citation_count: int = Field(default=0, ge=0)

class LiteratureCreate(LiteratureBase):
    pass

class LiteratureUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    authors: Optional[str] = Field(None, max_length=500)
    journal: Optional[str] = Field(None, max_length=200)
    year: Optional[int] = Field(None, ge=1900, le=2030)
    doi: Optional[str] = Field(None, max_length=100)
    abstract: Optional[str] = None
    keywords: Optional[str] = Field(None, max_length=500)
    citation_count: Optional[int] = Field(None, ge=0)
    validation_status: Optional[str] = Field(None, max_length=50)
    validation_score: Optional[float] = None
    validation_reason: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None

class Literature(LiteratureBase):
    id: int
    validation_status: str
    validation_score: Optional[float]
    validation_reason: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Idea schemas
class IdeaBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: str
    source: str = Field(..., max_length=100)
    source_literature_id: Optional[int] = None
    difficulty_level: Optional[str] = Field(None, max_length=20)
    estimated_duration: Optional[str] = Field(None, max_length=50)
    required_skills: Optional[str] = Field(None, max_length=500)
    potential_impact: Optional[str] = Field(None, max_length=20)
    priority: str = Field(default="medium", max_length=20)
    tags: Optional[str] = Field(None, max_length=500)

class IdeaCreate(IdeaBase):
    pass

class IdeaUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    difficulty_level: Optional[str] = Field(None, max_length=20)
    estimated_duration: Optional[str] = Field(None, max_length=50)
    required_skills: Optional[str] = Field(None, max_length=500)
    potential_impact: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, max_length=50)
    priority: Optional[str] = Field(None, max_length=20)
    tags: Optional[str] = Field(None, max_length=500)

class Idea(IdeaBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    source_literature: Optional[Literature] = None
    
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

class CommunicationLogCreate(CommunicationLogBase):
    pass

class CommunicationLogUpdate(BaseModel):
    communication_type: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    outcomes: Optional[str] = None
    action_items: Optional[str] = None
    communication_date: Optional[datetime] = None

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

# API validation schemas
class ValidationRequest(BaseModel):
    literature_ids: List[int]
    prompt: str

class ValidationResult(BaseModel):
    literature_id: int
    status: str
    score: Optional[float]
    reason: str