from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Table, Index, UniqueConstraint
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

# Association table for many-to-many relationship between projects and collaborators
project_collaborators = Table(
    'project_collaborators',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('research_projects.id')),
    Column('collaborator_id', Integer, ForeignKey('collaborators.id'))
)

# Association table for many-to-many relationship between projects and collaborators

class Collaborator(Base):
    """合作者模型（极简版 - 只保留3个业务字段）"""
    __tablename__ = "collaborators"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    background = Column(Text, nullable=False)
    is_senior = Column(Boolean, default=True)

    # 系统字段
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("ResearchProject", secondary=project_collaborators, back_populates="collaborators")

class ResearchProject(Base):
    """研究项目模型"""
    __tablename__ = "research_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    idea_description = Column(Text, nullable=False)  # idea描述
    research_method = Column(Text, nullable=True)  # 研究方法（从Ideas转化而来）
    source = Column(Text, nullable=True)  # 来源（从Ideas转化而来）
    target_journal = Column(Text, nullable=True)  # (拟)投稿期刊
    status = Column(String(50), default="active")  # active, completed, paused
    progress = Column(Float, default=0.0)  # 进展百分比
    start_date = Column(DateTime, default=datetime.utcnow)
    expected_completion = Column(DateTime)
    is_todo = Column(Boolean, default=False, index=True)  # 待办事项标记
    todo_marked_at = Column(DateTime, nullable=True)  # 标记为待办的时间
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 我的身份字段
    my_role = Column(String(50), nullable=False, default='other_author')  # 我在研究中的身份

    # Relationships
    collaborators = relationship("Collaborator", secondary=project_collaborators, back_populates="projects")
    communication_logs = relationship("CommunicationLog", back_populates="project", cascade="all, delete-orphan")



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
    """Ideas管理模型 - 重新设计版本"""
    __tablename__ = "ideas"
    
    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(Text, nullable=False, comment="项目名称")
    project_description = Column(Text, nullable=True, comment="项目描述")
    research_method = Column(Text, nullable=False, comment="研究方法")
    source = Column(Text, nullable=True, comment="来源信息")
    responsible_person = Column(String(100), nullable=False, comment="负责人")
    maturity = Column(String(20), nullable=False, default='immature', comment="成熟度: mature/immature")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 索引优化
    __table_args__ = (
        Index('idx_ideas_maturity', 'maturity'),
        Index('idx_ideas_responsible_person', 'responsible_person'),
        Index('idx_ideas_created_at', 'created_at'),
    )


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