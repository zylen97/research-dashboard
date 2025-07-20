from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import timedelta
from pydantic import BaseModel, Field
from typing import Optional
from app.models.database import get_db, User, Team
from app.models.schemas import (
    UserCreate, UserLogin, TeamCreate, TeamJoin, 
    Token, User as UserSchema, Team as TeamSchema
)
from app.utils.auth import (
    authenticate_user, create_user, create_team, 
    join_team_by_invite_code, get_user_team,
    create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """用户注册"""
    try:
        # 检查用户名和邮箱是否已存在
        existing_user = db.query(User).filter(
            (User.username == user_data.username) | (User.email == user_data.email)
        ).first()
        
        if existing_user:
            if existing_user.username == user_data.username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
        
        # 创建用户
        user = create_user(
            db=db,
            username=user_data.username,
            email=user_data.email,
            display_name=user_data.display_name,
            password=user_data.password
        )
        
        return {
            "message": "User registered successfully",
            "user_id": user.id,
            "username": user.username
        }
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """用户登录"""
    # 验证用户凭据
    user = authenticate_user(db, user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 获取用户所在的团队
    team = get_user_team(db, user.id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of any team. Please join a team first."
        )
    
    # 更新最后登录时间
    from datetime import datetime
    user.last_login = datetime.utcnow()
    db.commit()
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "team_id": team.id,
            "username": user.username
        },
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserSchema.from_orm(user),
        team=TeamSchema.from_orm(team)
    )

class TeamCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    max_members: int = Field(default=10, ge=2, le=50)
    username: str
    password: str

@router.post("/create-team", response_model=dict)
async def create_new_team(
    request: TeamCreateRequest,
    db: Session = Depends(get_db)
):
    """创建团队（需要用户凭据）"""
    # 验证用户
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 检查用户是否已经在团队中
    existing_team = get_user_team(db, user.id)
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of a team"
        )
    
    try:
        # 创建团队
        team = create_team(
            db=db,
            user_id=user.id,
            name=request.name,
            description=request.description,
            max_members=request.max_members
        )
        
        return {
            "message": "Team created successfully",
            "team_id": team.id,
            "team_name": team.name,
            "invite_code": team.invite_code
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create team"
        )

class TeamJoinRequest(BaseModel):
    invite_code: str = Field(..., max_length=20)
    username: str
    password: str

@router.post("/join-team", response_model=Token)
async def join_team(
    request: TeamJoinRequest,
    db: Session = Depends(get_db)
):
    """加入团队"""
    # 验证用户
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 检查用户是否已经在团队中
    existing_team = get_user_team(db, user.id)
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of a team"
        )
    
    # 尝试加入团队
    team = join_team_by_invite_code(db, user.id, request.invite_code)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code or team is full"
        )
    
    # 更新最后登录时间
    from datetime import datetime
    user.last_login = datetime.utcnow()
    db.commit()
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "team_id": team.id,
            "username": user.username
        },
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserSchema.from_orm(user),
        team=TeamSchema.from_orm(team)
    )

@router.get("/me", response_model=dict)
async def get_current_user_info(
    current_user: User = Depends(lambda request: request.state.current_user),
    current_team: Team = Depends(lambda request: request.state.current_team)
):
    """获取当前用户信息"""
    return {
        "user": UserSchema.from_orm(current_user),
        "team": TeamSchema.from_orm(current_team)
    }

@router.get("/team/members")
async def get_team_members(
    current_team: Team = Depends(lambda request: request.state.current_team),
    db: Session = Depends(get_db)
):
    """获取团队成员列表"""
    from app.utils.auth import get_team_members
    
    members = get_team_members(db, current_team.id)
    
    return {
        "team_id": current_team.id,
        "team_name": current_team.name,
        "members": [
            {
                "user": UserSchema.from_orm(member["user"]),
                "role": member["role"],
                "joined_at": member["joined_at"]
            }
            for member in members
        ]
    }