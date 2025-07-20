from datetime import datetime, timedelta
from typing import Optional, Union
import os
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.models.database import User, Team, user_teams
from app.models.schemas import User as UserSchema, Team as TeamSchema

# JWT配置
SECRET_KEY = os.getenv("SECRET_KEY", "research-dashboard-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """加密密码"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """验证JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """用户认证"""
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user

def get_user_team(db: Session, user_id: int) -> Optional[Team]:
    """获取用户当前所在的团队"""
    # 查询用户团队关联
    result = db.query(user_teams).filter(user_teams.c.user_id == user_id).first()
    if result:
        team = db.query(Team).filter(Team.id == result.team_id, Team.is_active == True).first()
        return team
    return None

def create_user(db: Session, username: str, email: str, display_name: str, password: str) -> User:
    """创建用户"""
    hashed_password = get_password_hash(password)
    
    user = User(
        username=username,
        email=email,
        display_name=display_name,
        password_hash=hashed_password
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def join_team_by_invite_code(db: Session, user_id: int, invite_code: str) -> Optional[Team]:
    """通过邀请码加入团队"""
    # 查找团队
    team = db.query(Team).filter(
        Team.invite_code == invite_code,
        Team.is_active == True
    ).first()
    
    if not team:
        return None
    
    # 检查用户是否已经在团队中
    existing = db.query(user_teams).filter(
        user_teams.c.user_id == user_id,
        user_teams.c.team_id == team.id
    ).first()
    
    if existing:
        return team
    
    # 检查团队成员数量限制
    member_count = db.query(user_teams).filter(user_teams.c.team_id == team.id).count()
    if member_count >= team.max_members:
        return None
    
    # 添加用户到团队
    stmt = user_teams.insert().values(
        user_id=user_id,
        team_id=team.id,
        role="member",
        joined_at=datetime.utcnow()
    )
    db.execute(stmt)
    db.commit()
    
    return team

def create_team(db: Session, user_id: int, name: str, description: str = None, max_members: int = 10) -> Team:
    """创建团队"""
    team = Team(
        name=name,
        description=description,
        creator_id=user_id,
        max_members=max_members
    )
    
    # 生成邀请码
    team.generate_invite_code()
    
    # 确保邀请码唯一
    while db.query(Team).filter(Team.invite_code == team.invite_code).first():
        team.generate_invite_code()
    
    db.add(team)
    db.commit()
    
    # 创建者自动加入团队并设为管理员
    stmt = user_teams.insert().values(
        user_id=user_id,
        team_id=team.id,
        role="admin",
        joined_at=datetime.utcnow()
    )
    db.execute(stmt)
    db.commit()
    
    db.refresh(team)
    return team

def get_team_members(db: Session, team_id: int) -> list:
    """获取团队成员列表"""
    query = db.query(User, user_teams.c.role, user_teams.c.joined_at).join(
        user_teams, User.id == user_teams.c.user_id
    ).filter(user_teams.c.team_id == team_id)
    
    results = query.all()
    
    members = []
    for user, role, joined_at in results:
        members.append({
            "user": user,
            "role": role,
            "joined_at": joined_at
        })
    
    return members