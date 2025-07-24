from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes import research, collaborators, validation, audit, auth, backup, config, ideas
from app.routes import idea_discovery
from app.utils.db_init import init_database, init_users, create_sample_data
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware, RequestValidationMiddleware, AuthMiddleware
from app.middleware.error_handler import setup_exception_handlers
from app.core.config import settings
import logging

# 配置日志
logging.basicConfig(**settings.get_log_config())
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info(f"🚀 正在启动研究看板 API - 环境: {settings.ENVIRONMENT}")
    logger.info(f"📁 数据库路径: {settings.DATABASE_URL}")
    logger.info(f"🌐 CORS 允许的源: {', '.join(settings.CORS_ORIGINS)}")
    
    init_database()
    init_users()  # 初始化用户账号
    # create_sample_data()  # 暂时禁用示例数据，避免多租户约束问题
    
    logger.info(f"✅ 应用启动成功！监听地址: {settings.HOST}:{settings.PORT}")
    
    yield  # 应用运行期间
    
    # 关闭时执行（如果需要）
    logger.info("👋 正在关闭应用...")

app = FastAPI(
    title="Research Dashboard API", 
    version="1.0.0",
    docs_url="/docs" if settings.IS_DEVELOPMENT else None,  # 生产环境隐藏文档
    redoc_url="/redoc" if settings.IS_DEVELOPMENT else None,
    lifespan=lifespan
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

# 安全中间件 - 注意：最后添加的中间件最先执行
# 顺序：AuthMiddleware -> RateLimitMiddleware -> RequestValidationMiddleware -> SecurityHeadersMiddleware -> CORSMiddleware
app.add_middleware(AuthMiddleware)  # 认证中间件放在最后添加，这样它会在CORS之后执行
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestValidationMiddleware, max_content_length=2 * 1024 * 1024)  # 2MB
app.add_middleware(RateLimitMiddleware, calls=120, period=60)  # 每分钟120次请求

# 设置统一错误处理
setup_exception_handlers(app)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(collaborators.router, prefix="/api/collaborators", tags=["collaborators"])
app.include_router(idea_discovery.router, prefix="/api/ideas", tags=["idea-discovery"])
app.include_router(ideas.router, prefix="/api/ideas-management", tags=["ideas-management"])
app.include_router(validation.router, prefix="/api/validation", tags=["validation"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])
app.include_router(config.router, prefix="/api/config", tags=["configuration"])

@app.get("/")
async def root():
    return {"message": "Research Dashboard API"}

@app.get("/api/health")
async def global_health_check():
    """全局健康检查 - 不需要认证"""
    from datetime import datetime
    return {
        "status": "healthy",
        "service": "research-dashboard-api",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
        "endpoints": {
            "ideas_management": "/api/ideas-management/health",
            "auth": "/api/auth/login"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.HOST, 
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower()
    )