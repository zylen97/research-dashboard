from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import research, collaborators, literature, ideas, validation, audit, auth, backup
from app.utils.db_init import init_database, init_users, create_sample_data
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware, RequestValidationMiddleware, AuthMiddleware
from app.core.config import settings
import logging

# 配置日志
logging.basicConfig(**settings.get_log_config())
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Research Dashboard API", 
    version="1.0.0",
    docs_url="/docs" if settings.IS_DEVELOPMENT else None,  # 生产环境隐藏文档
    redoc_url="/redoc" if settings.IS_DEVELOPMENT else None
)

# CORS middleware - 使用配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization"
    ],
)

# 安全中间件
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestValidationMiddleware, max_content_length=2 * 1024 * 1024)  # 2MB
app.add_middleware(RateLimitMiddleware, calls=120, period=60)  # 每分钟120次请求
# app.add_middleware(AuthMiddleware)  # 暂时注释掉，等前端准备好再启用

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(collaborators.router, prefix="/api/collaborators", tags=["collaborators"])
app.include_router(literature.router, prefix="/api/literature", tags=["literature"])
app.include_router(ideas.router, prefix="/api/ideas", tags=["ideas"])
app.include_router(validation.router, prefix="/api/validation", tags=["validation"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])

@app.get("/")
async def root():
    return {"message": "Research Dashboard API"}

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    logger.info(f"🚀 正在启动研究看板 API - 环境: {settings.ENVIRONMENT}")
    logger.info(f"📁 数据库路径: {settings.DATABASE_URL}")
    logger.info(f"🌐 CORS 允许的源: {', '.join(settings.CORS_ORIGINS)}")
    
    init_database()
    init_users()  # 初始化用户账号
    # create_sample_data()  # 暂时禁用示例数据，避免多租户约束问题
    
    logger.info(f"✅ 应用启动成功！监听地址: {settings.HOST}:{settings.PORT}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.HOST, 
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower()
    )