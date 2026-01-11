from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from enum import Enum

# Research Method schemas (v4.7)
class ResearchMethodBase(BaseModel):
    """研究方法基础数据模型"""
    name: str = Field(..., min_length=1, max_length=200, description="研究方法名称")

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('研究方法名称不能为空')
        return v

class ResearchMethodCreate(ResearchMethodBase):
    """创建研究方法的数据模型"""
    pass

class ResearchMethodUpdate(BaseModel):
    """更新研究方法的数据模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="研究方法名称")

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError('研究方法名称不能为空')
        return v

class ResearchMethod(ResearchMethodBase):
    """完整的研究方法数据模型"""
    id: int
    usage_count: int = Field(default=0, description="使用次数")
    created_at: datetime

    class Config:
        from_attributes = True

# Collaborator schemas（极简版 - 只保留2个业务字段）
class CollaboratorBase(BaseModel):
    name: str = Field(..., max_length=100, description="姓名")
    background: str = Field(..., description="背景信息")

class CollaboratorCreate(CollaboratorBase):
    pass

class CollaboratorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100, description="姓名")
    background: Optional[str] = Field(None, description="背景信息")

class Collaborator(CollaboratorBase):
    id: int
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    project_count: int = 0  # 参与的项目数量（计算属性，不存储在数据库）

    class Config:
        from_attributes = True

# Research Project 枚举类型
class ProjectStatus(str, Enum):
    """项目状态枚举"""
    WRITING = "writing"        # 撰写中
    SUBMITTING = "submitting"  # 投稿中
    PUBLISHED = "published"    # 已发表

# Research Project schemas
class ResearchProjectBase(BaseModel):
    title: str = Field(..., max_length=200)
    idea_description: str = Field(default='', description="项目描述")
    research_method: str = Field(..., min_length=1, max_length=2000, description="研究方法")
    source: Optional[str] = Field(None, deprecated=True, description="来源（已废弃）")
    reference_paper: Optional[str] = Field(None, max_length=1000, description="参考论文")
    reference_journal: Optional[str] = Field(None, max_length=200, description="参考期刊")
    target_journal: Optional[str] = Field(None, description="投稿期刊")
    status: ProjectStatus = Field(default=ProjectStatus.WRITING, description="项目状态: writing/submitting/published")
    progress: float = Field(default=0.0, ge=0, le=100)
    expected_completion: Optional[datetime] = None
    is_todo: bool = Field(default=False)

    # 我的身份字段
    my_role: str = Field(default='first_author', description="我的身份: first_author/corresponding_author")

    @field_validator('my_role')
    @classmethod
    def validate_my_role(cls, v):
        valid_roles = ['first_author', 'corresponding_author']
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
    source: Optional[str] = Field(None, deprecated=True)
    reference_paper: Optional[str] = Field(None, max_length=1000)
    reference_journal: Optional[str] = Field(None, max_length=200)
    target_journal: Optional[str] = Field(None, description="投稿期刊")
    status: Optional[ProjectStatus] = Field(None, description="项目状态: writing/submitting/published/completed")
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
            valid_roles = ['first_author', 'corresponding_author']
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
    communication_type: Optional[str] = Field('meeting', max_length=50, description="通讯类型")
    title: str = Field(..., max_length=200)
    content: str
    outcomes: Optional[str] = None
    communication_date: datetime = Field(default_factory=datetime.utcnow)

class CommunicationLogCreate(BaseModel):
    collaborator_id: Optional[int] = None
    communication_type: Optional[str] = Field('meeting', max_length=50, description="通讯类型")
    title: str = Field(..., max_length=200, min_length=1)
    content: str = Field(default='', description="进度内容")
    outcomes: Optional[str] = None
    communication_date: Union[str, datetime] = Field(default_factory=datetime.utcnow)

    @field_validator('title', mode='before')
    def strip_and_validate_title(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:  # 去除空白后如果为空，返回None让min_length验证失败
                return None
        return v

    @field_validator('content', mode='before')
    def strip_content(cls, v):
        if v is None or v == '':
            return ''  # 允许空值，返回空字符串
        if isinstance(v, str):
            return v.strip()
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

# Ideas管理 schemas - 负责人外键化版本
class IdeaBase(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    project_description: str = Field(..., min_length=1, max_length=2000, description="项目描述")
    research_method: str = Field(..., min_length=1, max_length=1000, description="研究方法")
    source: Optional[str] = Field(None, max_length=500, deprecated=True, description="来源信息（已废弃）")
    reference_paper: Optional[str] = Field(None, max_length=1000, description="参考论文")
    reference_journal: Optional[str] = Field(None, max_length=200, description="参考期刊")
    target_journal: Optional[str] = Field(None, max_length=200, description="投稿期刊")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID（主负责人，可选）")
    responsible_person_ids: List[int] = Field(default_factory=list, description="负责人ID列表（多选）")
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
    source: Optional[str] = Field(None, max_length=500, deprecated=True)
    reference_paper: Optional[str] = Field(None, max_length=1000)
    reference_journal: Optional[str] = Field(None, max_length=200)
    target_journal: Optional[str] = Field(None, max_length=200, description="投稿期刊")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_ids: Optional[List[int]] = Field(None, description="负责人ID列表（多选）")
    maturity: Optional[str] = Field(None, description="成熟度：mature/immature")

    @field_validator('maturity')
    @classmethod
    def validate_maturity(cls, v):
        if v is not None and v not in ['mature', 'immature']:
            raise ValueError('maturity must be either "mature" or "immature"')
        return v

class Idea(IdeaBase):
    """完整的Ideas数据模型 - 包含关联的负责人对象"""
    id: int
    created_at: datetime
    updated_at: datetime

    # 关联的负责人对象
    responsible_person: Optional[Collaborator] = Field(None, description="主负责人对象")
    responsible_persons: List[Collaborator] = Field(default_factory=list, description="所有负责人对象列表")

    class Config:
        from_attributes = True

# Schema aliases for compatibility
IdeaSchema = Idea

# Tag schemas - 期刊标签管理
class TagBase(BaseModel):
    """标签基础数据模型"""
    name: str = Field(..., min_length=1, max_length=50, description="标签名称（唯一）")
    description: Optional[str] = Field(None, max_length=200, description="标签描述")
    color: str = Field(default='blue', description="前端显示颜色")

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('标签名称不能为空')
        return v

class TagCreate(TagBase):
    """创建标签的数据模型"""
    pass

class TagUpdate(BaseModel):
    """更新标签的数据模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="标签名称")
    description: Optional[str] = Field(None, max_length=200, description="标签描述")
    color: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError('标签名称不能为空')
        return v

class TagSchema(TagBase):
    """完整的标签数据模型（包含ID和时间戳）"""
    id: int
    created_at: datetime
    updated_at: datetime
    journal_count: int = Field(default=0, description="使用该标签的期刊数量")

    class Config:
        from_attributes = True

Tag = TagSchema  # 别名

# Journal schemas - 期刊库管理
class JournalBase(BaseModel):
    """期刊基础数据模型"""
    name: str = Field(..., min_length=1, max_length=200, description="期刊名称（唯一）")
    notes: Optional[str] = Field(None, description="备注")

class JournalCreate(JournalBase):
    """创建期刊的数据模型"""
    tag_ids: List[int] = Field(default=[], description="关联的标签ID列表（可选）")

class JournalUpdate(BaseModel):
    """更新期刊的数据模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="期刊名称")
    notes: Optional[str] = Field(None, description="备注")
    tag_ids: Optional[List[int]] = Field(None, description="标签ID列表（完全替换）")

class Journal(JournalBase):
    """完整的期刊数据模型（包含ID和时间戳）"""
    id: int
    created_at: datetime
    updated_at: datetime

    # v3.6 期卷号跟踪字段
    latest_volume: Optional[str] = Field(None, description="最新卷号")
    latest_issue: Optional[str] = Field(None, description="最新期号")

    # 关联的标签
    tags: List[Tag] = Field(default=[], description="关联的标签列表")

    # 统计字段（API返回时动态计算，v4.2简化）
    reference_count: int = Field(default=0, description="作为参考期刊的引用次数")
    target_count: int = Field(default=0, description="作为投稿期刊的引用次数")
    # paper_count已移除 - Papers功能已删除

    class Config:
        from_attributes = True

# Update forward references
ResearchProject.model_rebuild()  # Fix CommunicationLog forward reference


# Paper schemas 已移除 - 论文功能已删除


# ===== 批量操作 Schemas =====

class BatchDeleteRequest(BaseModel):
    """批量删除请求模型"""
    ids: List[int] = Field(..., min_items=1, description="要删除的记录ID列表")


class BatchUpdateMaturityRequest(BaseModel):
    """批量更新成熟度请求模型"""
    ids: List[int] = Field(..., min_items=1, description="要更新的记录ID列表")
    maturity: str = Field(..., description="新的成熟度：mature/immature")

    @field_validator('maturity')
    @classmethod
    def validate_maturity(cls, v):
        if v not in ['mature', 'immature']:
            raise ValueError('maturity must be either "mature" or "immature"')
        return v


# ===== Prompt Schemas (v4.8) =====

class PromptCategory(str, Enum):
    """提示词分类枚举"""
    READING = "reading"           # 文章精读和迁移
    WRITING = "writing"           # 论文写作
    POLISHING = "polishing"       # 论文润色
    REVIEWER = "reviewer"         # 审稿人
    HORIZONTAL = "horizontal"     # 横向课题


class PromptBase(BaseModel):
    """提示词基础数据模型"""
    title: str = Field(..., min_length=1, max_length=200, description="提示词标题")
    content: str = Field(..., min_length=1, description="提示词内容")
    category: PromptCategory = Field(..., description="分类")
    description: Optional[str] = Field(None, description="详细说明")
    tag_ids: List[int] = Field(default=[], description="关联的标签ID列表")

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('提示词标题不能为空')
        return v


class PromptCreate(PromptBase):
    """创建提示词的数据模型"""
    pass


class PromptUpdate(BaseModel):
    """更新提示词的数据模型"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    category: Optional[PromptCategory] = None
    description: Optional[str] = None
    tag_ids: Optional[List[int]] = None
    is_favorite: Optional[bool] = None
    is_active: Optional[bool] = None


class Prompt(PromptBase):
    """完整的提示词数据模型"""
    id: int
    variables: List[str] = Field(default=[], description="变量列表")
    usage_count: int = Field(default=0, description="使用次数")
    is_favorite: bool = Field(default=False, description="是否收藏")
    is_active: bool = Field(default=True, description="是否启用")
    created_at: datetime
    updated_at: datetime
    tags: List[Tag] = Field(default=[], description="关联的标签列表")

    class Config:
        from_attributes = True


class PromptCopyRequest(BaseModel):
    """复制提示词请求模型"""
    variables: Optional[Dict[str, str]] = Field(None, description="变量值映射")


class PromptCopyResponse(BaseModel):
    """复制提示词响应模型"""
    content: str = Field(..., description="替换后的完整文本")
    title: str = Field(..., description="提示词标题")
    variables_used: List[str] = Field(default=[], description="使用的变量列表")


class PromptStats(BaseModel):
    """提示词统计模型"""
    total_count: int = Field(..., description="总数量")
    by_category: Dict[str, int] = Field(default={}, description="按分类统计")
    top_prompts: List[Dict[str, Any]] = Field(default=[], description="最常用的提示词")


# Update forward references
ResearchProject.model_rebuild()  # Fix CommunicationLog forward reference