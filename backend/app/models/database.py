from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Table, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import secrets

# Database configuration
SQLITE_DATABASE_URL = "sqlite:///./research_dashboard.db"
engine = create_engine(SQLITE_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Association table for many-to-many relationship between projects and collaborators
project_collaborators = Table(
    'project_collaborators',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('research_projects.id')),
    Column('collaborator_id', Integer, ForeignKey('collaborators.id'))
)

# Association table for many-to-many relationship between users and teams
user_teams = Table(
    'user_teams',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('team_id', Integer, ForeignKey('teams.id')),
    Column('role', String(20), default='member'),  # admin, member
    Column('joined_at', DateTime, default=datetime.utcnow)
)

class Collaborator(Base):
    """合作者模型"""
    __tablename__ = "collaborators"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False, index=True)  # 多租户支持
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
    team = relationship("Team")

class ResearchProject(Base):
    """研究项目模型"""
    __tablename__ = "research_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False, index=True)  # 多租户支持
    title = Column(String(200), nullable=False, index=True)
    idea_description = Column(Text, nullable=False)  # idea描述
    status = Column(String(50), default="active")  # active, completed, paused
    progress = Column(Float, default=0.0)  # 进展百分比
    start_date = Column(DateTime, default=datetime.utcnow)
    expected_completion = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    collaborators = relationship("Collaborator", secondary=project_collaborators, back_populates="projects")
    communication_logs = relationship("CommunicationLog", back_populates="project", cascade="all, delete-orphan")
    team = relationship("Team")

class Literature(Base):
    """文献模型"""
    __tablename__ = "literature"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False, index=True)  # 多租户支持
    title = Column(String(500), nullable=False, index=True)
    authors = Column(String(500))
    journal = Column(String(200))
    year = Column(Integer)
    doi = Column(String(100))
    abstract = Column(Text)
    keywords = Column(String(500))
    citation_count = Column(Integer, default=0)
    
    # API validation results
    validation_status = Column(String(50), default="pending")  # pending, validated, rejected
    validation_score = Column(Float)  # API返回的匹配分数
    validation_reason = Column(Text)  # 验证原因
    
    # Status management
    status = Column(String(50), default="imported")  # imported, reviewed, converted_to_idea
    notes = Column(Text)  # 用户备注
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    team = relationship("Team")

class Idea(Base):
    """idea池模型"""
    __tablename__ = "ideas"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False, index=True)  # 多租户支持
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=False)
    source = Column(String(100))  # literature, manual, other
    source_literature_id = Column(Integer, ForeignKey('literature.id'), nullable=True)
    
    # Idea details
    difficulty_level = Column(String(20))  # easy, medium, hard
    estimated_duration = Column(String(50))  # 预计耗时
    required_skills = Column(String(500))  # 所需技能
    potential_impact = Column(String(20))  # low, medium, high
    
    # Status management
    status = Column(String(50), default="pool")  # pool, in_development, converted_to_project
    priority = Column(String(20), default="medium")  # low, medium, high
    tags = Column(String(500))  # 标签，逗号分隔
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    source_literature = relationship("Literature")
    team = relationship("Team")

class AuditLog(Base):
    """审计日志模型"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=True, index=True)  # 多租户支持，可为空
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
    team = relationship("Team")

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
    
    # Relationships
    teams = relationship("Team", secondary=user_teams, back_populates="members")
    created_teams = relationship("Team", back_populates="creator")

class Team(Base):
    """团队模型"""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    invite_code = Column(String(20), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    max_members = Column(Integer, default=10)
    
    creator_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", back_populates="created_teams")
    members = relationship("User", secondary=user_teams, back_populates="teams")
    
    def generate_invite_code(self):
        """生成唯一的邀请码"""
        self.invite_code = secrets.token_urlsafe(12)[:12].upper()

# Create database tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()