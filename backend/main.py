from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import research, collaborators, literature, ideas, validation, audit, auth
from app.utils.db_init import init_database, create_sample_data
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware, RequestValidationMiddleware, AuthMiddleware

app = FastAPI(
    title="Research Dashboard API", 
    version="1.0.0",
    docs_url="/docs",  # 限制文档访问
    redoc_url="/redoc"
)

# CORS middleware - 安全配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
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

@app.get("/")
async def root():
    return {"message": "Research Dashboard API"}

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    init_database()
    create_sample_data()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)