import time
import logging
from typing import Dict, List
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """速率限制中间件"""
    
    def __init__(self, app, calls: int = 60, period: int = 60):
        """
        初始化速率限制中间件
        
        Args:
            app: FastAPI应用实例
            calls: 时间窗口内允许的请求次数
            period: 时间窗口（秒）
        """
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.client_requests: Dict[str, List[float]] = {}
    
    async def dispatch(self, request: Request, call_next):
        """处理请求，应用速率限制"""
        client_ip = self.get_client_ip(request)
        current_time = time.time()
        
        # 获取或初始化客户端请求记录
        if client_ip not in self.client_requests:
            self.client_requests[client_ip] = []
        
        # 清理过期的请求记录
        self.client_requests[client_ip] = [
            req_time for req_time in self.client_requests[client_ip]
            if current_time - req_time < self.period
        ]
        
        # 检查是否超出限制
        if len(self.client_requests[client_ip]) >= self.calls:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Too many requests.",
                    "retry_after": self.period
                }
            )
        
        # 记录当前请求
        self.client_requests[client_ip].append(current_time)
        
        response = await call_next(request)
        return response
    
    def get_client_ip(self, request: Request) -> str:
        """获取客户端IP地址"""
        # 检查代理头部
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """安全头部中间件"""
    
    async def dispatch(self, request: Request, call_next):
        """添加安全头部"""
        response = await call_next(request)
        
        # 添加安全头部
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """请求验证中间件"""
    
    def __init__(self, app, max_content_length: int = 1024 * 1024):  # 1MB
        """
        初始化请求验证中间件
        
        Args:
            app: FastAPI应用实例
            max_content_length: 最大请求体大小（字节）
        """
        super().__init__(app)
        self.max_content_length = max_content_length
    
    async def dispatch(self, request: Request, call_next):
        """验证请求"""
        # 检查请求体大小
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_content_length:
            logger.warning(f"Request too large: {content_length} bytes from {request.client.host}")
            return JSONResponse(
                status_code=413,
                content={
                    "detail": f"Request too large. Maximum size is {self.max_content_length} bytes."
                }
            )
        
        # 检查恶意路径
        path = str(request.url.path)
        if self.contains_malicious_patterns(path):
            logger.warning(f"Malicious path detected: {path} from {request.client.host}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid request path."}
            )
        
        response = await call_next(request)
        return response
    
    def contains_malicious_patterns(self, path: str) -> bool:
        """检查路径是否包含恶意模式"""
        malicious_patterns = [
            "../", "..\\", "..", 
            "<script", "javascript:", 
            "union select", "drop table",
            "exec(", "eval(",
            "%2e%2e", "%252e",
        ]
        
        path_lower = path.lower()
        return any(pattern in path_lower for pattern in malicious_patterns)