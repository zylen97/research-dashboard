from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Table, Index
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
    """合作者模型"""
    __tablename__ = "collaborators"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    gender = Column(String(10))
    class_name = Column(String(100))  # 班级
    future_plan = Column(Text)  # 未来规划
    background = Column(Text)  # 具体情况和背景
    contact_info = Column(String(200))  # 联系方式
    is_senior = Column(Boolean, default=False)  # 高级合作者标记
    is_deleted = Column(Boolean, default=False)  # 软删除标记
    deleted_at = Column(DateTime, nullable=True)  # 删除时间
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
    status = Column(String(50), default="active")  # active, completed, paused
    progress = Column(Float, default=0.0)  # 进展百分比
    start_date = Column(DateTime, default=datetime.utcnow)
    expected_completion = Column(DateTime)
    is_todo = Column(Boolean, default=False, index=True)  # 待办事项标记
    todo_marked_at = Column(DateTime, nullable=True)  # 标记为待办的时间
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # 改为外键关联
    ip_address = Column(String(45))
    old_values = Column(Text)  # JSON格式
    new_values = Column(Text)  # JSON格式
    changes = Column(Text)  # JSON格式
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")

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
    action_items = Column(Text)  # 待办事项
    
    communication_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("ResearchProject", back_populates="communication_logs")
    collaborator = relationship("Collaborator")

class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # 关系定义

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
    created_by_id = Column(Integer, ForeignKey('users.id'), index=True)
    updated_by_id = Column(Integer, ForeignKey('users.id'), index=True)
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_configs")
    updated_by = relationship("User", foreign_keys=[updated_by_id], backref="updated_configs")
    
    # 复合索引优化配置查询
    __table_args__ = (
        Index('idx_config_category_active', 'category', 'is_active'),
        Index('idx_config_encrypted_active', 'is_encrypted', 'is_active'),
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