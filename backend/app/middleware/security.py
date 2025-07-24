import time
import logging
from typing import Dict, List
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """速率限制中间件"""

    def __init__(self, app, calls: int = 60, period: int = 60, max_clients: int = 10000):
        """
        初始化速率限制中间件

        Args:
            app: FastAPI应用实例
            calls: 时间窗口内允许的请求次数
            period: 时间窗口（秒）
            max_clients: 最大缓存客户端数量
        """
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.max_clients = max_clients
        self.client_requests: Dict[str, List[float]] = {}
        self.last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next):
        """处理请求，应用速率限制"""
        client_ip = self.get_client_ip(request)
        current_time = time.time()
        path = request.url.path
        
        # 添加调试日志
        if path.startswith('/'):
            logger.info(f"RateLimitMiddleware: Processing {path} from {client_ip}")

        # 定期清理所有过期记录（每分钟一次）
        if current_time - self.last_cleanup > 60:
            self._cleanup_expired_records(current_time)
            self.last_cleanup = current_time

        # 获取或初始化客户端请求记录
        if client_ip not in self.client_requests:
            # 检查是否超过最大客户端数量
            if len(self.client_requests) >= self.max_clients:
                self._cleanup_expired_records(current_time, force=True)
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

    def _cleanup_expired_records(self, current_time: float, force: bool = False):
        """清理过期的请求记录"""
        if force:
            # 强制清理：删除最老的一半客户端
            sorted_clients = sorted(
                self.client_requests.items(),
                key=lambda x: max(x[1]) if x[1] else 0
            )
            half = len(sorted_clients) // 2
            for client_ip, _ in sorted_clients[:half]:
                del self.client_requests[client_ip]
            logger.info(f"Force cleaned {half} client records")
        else:
            # 常规清理：删除所有请求都过期的客户端
            expired_clients = []
            for client_ip, requests in self.client_requests.items():
                # 清理过期请求
                valid_requests = [
                    req_time for req_time in requests
                    if current_time - req_time < self.period
                ]
                if not valid_requests:
                    expired_clients.append(client_ip)
                else:
                    self.client_requests[client_ip] = valid_requests

            # 删除没有有效请求的客户端
            for client_ip in expired_clients:
                del self.client_requests[client_ip]

            if expired_clients:
                logger.debug(f"Cleaned up {len(expired_clients)} expired client records")

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
        path = request.url.path
        
        # 添加调试日志
        if path.startswith('/'):
            logger.info(f"RequestValidationMiddleware: Processing {path}")
        
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


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT认证中间件"""

    def __init__(self, app):
        super().__init__(app)
        # 不需要认证的路径
        self.public_paths = {
            "/",
            "/docs", 
            "/redoc",
            "/openapi.json",
            "/auth/login",
            "/health",  # 健康检查
            "/ideas-management/health",  # Ideas健康检查
        }

    async def dispatch(self, request: Request, call_next):
        """验证JWT token"""
        from app.utils.auth import verify_token
        from app.models.database import get_db, User

        # 检查是否为公开路径
        current_path = request.url.path
        logger.info(f"AuthMiddleware: Checking path '{current_path}' against public_paths: {self.public_paths}")
        
        if current_path in self.public_paths:
            logger.info(f"AuthMiddleware: Public path accessed, allowing: {current_path}")
            return await call_next(request)
        
        # 记录被拦截的路径以便调试
        logger.info(f"AuthMiddleware: Auth required for path: {current_path}")

        # 获取Authorization头
        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authorization header"}
            )

        # 提取token
        token = authorization.replace("Bearer ", "")
        payload = verify_token(token)

        if not payload:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"}
            )

        # 获取用户信息
        user_id = payload.get("user_id")

        if not user_id:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid token payload"}
            )

        # 验证用户是否仍然有效
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active).first()

            if not user:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "User not found or inactive"}
                )

            # 将用户信息添加到请求状态中
            request.state.current_user = user

        finally:
            db.close()

        return await call_next(request)
