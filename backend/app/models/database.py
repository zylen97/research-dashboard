from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Table, Index, UniqueConstraint, event
from sqlalchemy.orm import backref
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from app.core.config import settings

# Database configuration
DATABASE_URL = settings.get_database_url()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 启用SQLite外键约束（确保外键约束生效）
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """在每个数据库连接建立时启用外键约束"""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# Association table for many-to-many relationship between projects and collaborators
project_collaborators = Table(
    'project_collaborators',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('research_projects.id')),
    Column('collaborator_id', Integer, ForeignKey('collaborators.id'))
)

# Association table for many-to-many relationship between ideas and collaborators
idea_responsible_persons = Table(
    'idea_responsible_persons',
    Base.metadata,
    Column('idea_id', Integer, ForeignKey('ideas.id', ondelete='CASCADE')),
    Column('collaborator_id', Integer, ForeignKey('collaborators.id'))
)

# Association table for many-to-many relationship between journals and tags
journal_tags = Table(
    'journal_tags',
    Base.metadata,
    Column('journal_id', Integer, ForeignKey('journals.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime, default=datetime.utcnow)
)

# Association table for many-to-many relationship between prompts and tags (v4.8)
prompt_tags = Table(
    'prompt_tags',
    Base.metadata,
    Column('prompt_id', Integer, ForeignKey('prompts.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime, default=datetime.utcnow)
)

# Association table for many-to-many relationship between projects and collaborators

class Collaborator(Base):
    """合作者模型（极简版 - 只保留2个业务字段）"""
    __tablename__ = "collaborators"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    background = Column(Text, nullable=False)

    # 系统字段
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("ResearchProject", secondary=project_collaborators, back_populates="collaborators")
    ideas = relationship("Idea", secondary=idea_responsible_persons, back_populates="responsible_persons")

class ResearchProject(Base):
    """研究项目模型"""
    __tablename__ = "research_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    idea_description = Column(Text, nullable=False)  # idea描述
    research_method = Column(Text, nullable=True)  # 研究方法（从Ideas转化而来）
    source = Column(Text, nullable=True)  # 来源（已废弃，使用reference_paper和reference_journal）
    reference_paper = Column(Text, nullable=True)  # 参考论文
    reference_journal = Column(Text, nullable=True)  # 参考期刊
    target_journal = Column(Text, nullable=True)  # 投稿期刊
    status = Column(String(50), default="writing", nullable=False)  # writing, submitting, published
    progress = Column(Float, default=0.0)  # 进展百分比
    start_date = Column(DateTime, default=datetime.utcnow)
    expected_completion = Column(DateTime)
    is_todo = Column(Boolean, default=False, index=True)  # 待办事项标记
    todo_marked_at = Column(DateTime, nullable=True)  # 标记为待办的时间
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 我的身份字段
    my_role = Column(String(50), nullable=False, default='first_author')  # 我在研究中的身份

    # 研究方法外键（v4.7）
    research_method_id = Column(Integer, ForeignKey('research_methods.id'), nullable=True, comment="研究方法ID")

    # Relationships
    collaborators = relationship("Collaborator", secondary=project_collaborators, back_populates="projects")
    communication_logs = relationship("CommunicationLog", back_populates="project", cascade="all, delete-orphan")
    research_method_rel = relationship("ResearchMethod", foreign_keys=[research_method_id])



class ResearchMethod(Base):
    """研究方法模型（v4.7）"""
    __tablename__ = "research_methods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True, comment="研究方法名称")
    usage_count = Column(Integer, default=0, comment="使用次数")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    # Pydantic 配置，启用 ORM 模式
    class Config:
        from_attributes = True


class AuditLog(Base):
    """审计日志模型"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False)  # CREATE, UPDATE, DELETE, RESTORE
    ip_address = Column(String(45))
    old_values = Column(Text)  # JSON格式
    new_values = Column(Text)  # JSON格式
    changes = Column(Text)  # JSON格式
    created_at = Column(DateTime, default=datetime.utcnow)

class CommunicationLog(Base):
    """交流日志模型"""
    __tablename__ = "communication_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('research_projects.id'), nullable=False)
    collaborator_id = Column(Integer, ForeignKey('collaborators.id'), nullable=True)
    
    # Communication details
    communication_type = Column(String(50))  # meeting, email, chat, phone
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    outcomes = Column(Text)  # 会议结果或决定

    communication_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("ResearchProject", back_populates="communication_logs")
    collaborator = relationship("Collaborator")

class SystemConfig(Base):
    """系统配置模型 - 存储系统设置和AI配置信息"""
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, default="general", index=True)  # ai_api, system等
    description = Column(String(500))
    is_encrypted = Column(Boolean, default=False, index=True)  # 加密状态索引
    is_active = Column(Boolean, default=True, index=True)  # 启用状态索引

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 复合索引优化配置查询
    __table_args__ = (
        Index('idx_config_category_active', 'category', 'is_active'),
        Index('idx_config_encrypted_active', 'is_encrypted', 'is_active'),
    )


class Idea(Base):
    """Ideas管理模型 - 负责人外键化版本"""
    __tablename__ = "ideas"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(Text, nullable=False, comment="项目名称")
    project_description = Column(Text, nullable=False, comment="项目描述")
    research_method = Column(Text, nullable=False, comment="研究方法")
    source = Column(Text, nullable=True, comment="来源信息（已废弃，使用reference_paper和reference_journal）")
    reference_paper = Column(Text, nullable=True, comment="参考论文")
    reference_journal = Column(Text, nullable=True, comment="参考期刊")
    target_journal = Column(Text, nullable=True, comment="投稿期刊")
    responsible_person_id = Column(Integer, ForeignKey('collaborators.id'), nullable=True, comment="负责人ID（主负责人，可选）")
    maturity = Column(String(20), nullable=False, default='immature', comment="成熟度: mature/immature")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系属性
    responsible_person = relationship("Collaborator", foreign_keys=[responsible_person_id])
    responsible_persons = relationship("Collaborator", secondary=idea_responsible_persons, back_populates="ideas")

    # 索引优化
    __table_args__ = (
        Index('idx_ideas_maturity', 'maturity'),
        Index('idx_ideas_responsible_person_id', 'responsible_person_id'),
        Index('idx_ideas_created_at', 'created_at'),
    )


class Tag(Base):
    """期刊标签模型"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True, index=True, comment="标签名称（唯一）")
    description = Column(String(200), nullable=True, comment="标签描述")
    color = Column(String(20), nullable=True, default='blue', comment="前端显示颜色")

    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关联关系
    journals = relationship("Journal", secondary="journal_tags", back_populates="tags")


class Journal(Base):
    """期刊库模型"""
    __tablename__ = "journals"

    # 主键
    id = Column(Integer, primary_key=True, index=True)

    # 基础信息
    name = Column(String(200), nullable=False, unique=True, index=True, comment="期刊名称（唯一）")

    # 额外信息
    notes = Column(Text, nullable=True, comment="备注")

    # 期卷号跟踪字段（v3.6）
    latest_volume = Column(String(50), nullable=True, comment="最新卷号")
    latest_issue = Column(String(50), nullable=True, comment="最新期号")
    paper_count = Column(Integer, default=0, comment="论文总数")

    # 系统字段
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关联关系
    tags = relationship("Tag", secondary="journal_tags", back_populates="journals")

    # Pydantic 配置，启用 ORM 模式
    class Config:
        from_attributes = True


class JournalIssue(Base):
    """期刊期卷号浏览记录模型（v5.1）"""
    __tablename__ = "journal_issues"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey('journals.id', ondelete='CASCADE'), nullable=False)
    volume = Column(String(50), nullable=False, comment="卷号（中文期刊可留空字符串）")
    issue = Column(String(50), nullable=False, comment="期号")
    year = Column(Integer, nullable=False, comment="年份")
    marked_date = Column(DateTime, nullable=False, default=datetime.utcnow, comment="标记日期")
    notes = Column(Text, nullable=True, comment="备注")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建日期")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新日期")

    # 关联关系
    journal = relationship("Journal", backref=backref("issues", cascade="all, delete-orphan"))

    # 唯一约束：同一期刊的卷期组合唯一（空卷号时只检查期号）
    __table_args__ = (
        UniqueConstraint('journal_id', 'volume', 'issue', name='uq_journal_volume_issue'),
        Index('idx_journal_issues_journal_id', 'journal_id'),
        Index('idx_journal_issues_year', 'year'),
    )

    # Pydantic 配置
    class Config:
        from_attributes = True


class Prompt(Base):
    """提示词管理模型（v4.8）"""
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True, comment="提示词标题")
    content = Column(Text, nullable=False, comment="提示词内容")
    category = Column(String(50), nullable=False, index=True, comment="分类: reading/writing/polishing/reviewer/horizontal")
    description = Column(Text, nullable=True, comment="详细说明")
    variables = Column(Text, nullable=True, comment="变量列表JSON: [\"title\", \"abstract\"]")
    usage_count = Column(Integer, default=0, comment="使用次数")
    is_favorite = Column(Boolean, default=False, index=True, comment="是否收藏")
    is_active = Column(Boolean, default=True, index=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关联关系
    tags = relationship("Tag", secondary="prompt_tags", backref="prompts")

    # 索引优化
    __table_args__ = (
        Index('idx_prompts_category', 'category'),
        Index('idx_prompts_favorite', 'is_favorite'),
        Index('idx_prompts_usage', 'usage_count'),
        Index('idx_prompts_active', 'is_active'),
    )

    # Pydantic 配置
    class Config:
        from_attributes = True


# Create database tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Initialize database (alias for create_tables for compatibility)
def init_db():
    """初始化数据库，创建所有表"""
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表创建完成")

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()