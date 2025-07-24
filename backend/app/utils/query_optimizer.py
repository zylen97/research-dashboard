"""
数据库查询优化工具
提供查询优化、缓存、批量操作等功能
"""
from typing import List, Dict, Any, Optional, TypeVar, Generic, Callable
from sqlalchemy.orm import Session, Query, selectinload, joinedload, subqueryload
from sqlalchemy import and_, or_, func
from functools import lru_cache, wraps
from datetime import datetime, timedelta
import hashlib
import json
import redis
from contextlib import contextmanager

T = TypeVar('T')


class QueryOptimizer(Generic[T]):
    """
    查询优化器基类
    提供常用的查询优化方法
    """
    
    def __init__(self, model: T, session: Session):
        self.model = model
        self.session = session
        self.query = session.query(model)
    
    def with_relations(self, *relations: str) -> 'QueryOptimizer[T]':
        """
        预加载关联数据，避免N+1查询
        
        使用示例：
        projects = QueryOptimizer(ResearchProject, db)
            .with_relations('collaborators', 'communication_logs')
            .get_all()
        """
        for relation in relations:
            # 使用selectinload进行独立查询，避免笛卡尔积
            self.query = self.query.options(selectinload(getattr(self.model, relation)))
        return self
    
    def with_joined_load(self, *relations: str) -> 'QueryOptimizer[T]':
        """
        使用JOIN加载关联数据
        适用于一对一或多对一关系
        """
        for relation in relations:
            self.query = self.query.options(joinedload(getattr(self.model, relation)))
        return self
    
    def with_subquery_load(self, *relations: str) -> 'QueryOptimizer[T]':
        """
        使用子查询加载关联数据
        适用于需要额外过滤的关联查询
        """
        for relation in relations:
            self.query = self.query.options(subqueryload(getattr(self.model, relation)))
        return self
    
    def paginate(self, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        """
        分页查询，同时返回总数
        """
        # 使用子查询获取总数，避免重复查询
        total = self.query.count()
        
        # 计算分页参数
        offset = (page - 1) * per_page
        items = self.query.offset(offset).limit(per_page).all()
        
        return {
            'items': items,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }
    
    def batch_create(self, items: List[Dict[str, Any]]) -> List[T]:
        """
        批量创建，使用bulk_insert_mappings提高性能
        """
        self.session.bulk_insert_mappings(self.model, items)
        self.session.commit()
        return items
    
    def batch_update(self, updates: List[Dict[str, Any]]) -> None:
        """
        批量更新，使用bulk_update_mappings
        updates: [{'id': 1, 'field': 'value'}, ...]
        """
        self.session.bulk_update_mappings(self.model, updates)
        self.session.commit()
    
    def get_all(self) -> List[T]:
        """获取所有结果"""
        return self.query.all()
    
    def get_first(self) -> Optional[T]:
        """获取第一个结果"""
        return self.query.first()
    
    def filter_by(self, **kwargs) -> 'QueryOptimizer[T]':
        """添加过滤条件"""
        self.query = self.query.filter_by(**kwargs)
        return self
    
    def order_by(self, *args) -> 'QueryOptimizer[T]':
        """添加排序"""
        self.query = self.query.order_by(*args)
        return self


class CachedQuery:
    """
    查询缓存装饰器
    """
    
    def __init__(self, cache_key_prefix: str, ttl: int = 300):
        """
        Args:
            cache_key_prefix: 缓存键前缀
            ttl: 缓存过期时间（秒）
        """
        self.cache_key_prefix = cache_key_prefix
        self.ttl = ttl
        self._cache = {}  # 简单的内存缓存，生产环境应使用Redis
    
    def __call__(self, func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = self._generate_cache_key(args, kwargs)
            
            # 检查缓存
            if cache_key in self._cache:
                cached_data, cached_time = self._cache[cache_key]
                if datetime.now() - cached_time < timedelta(seconds=self.ttl):
                    return cached_data
            
            # 执行查询
            result = func(*args, **kwargs)
            
            # 存入缓存
            self._cache[cache_key] = (result, datetime.now())
            
            return result
        
        return wrapper
    
    def _generate_cache_key(self, args, kwargs) -> str:
        """生成缓存键"""
        key_data = {
            'prefix': self.cache_key_prefix,
            'args': str(args),
            'kwargs': str(sorted(kwargs.items()))
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def invalidate(self, pattern: Optional[str] = None):
        """清除缓存"""
        if pattern:
            # 清除匹配模式的缓存
            keys_to_remove = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            # 清除所有缓存
            self._cache.clear()


# Redis缓存实现（生产环境推荐）
class RedisCache:
    """
    Redis缓存实现
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client = redis.from_url(redis_url)
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        data = self.redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300):
        """设置缓存"""
        self.redis_client.setex(key, ttl, json.dumps(value))
    
    def delete(self, pattern: str):
        """删除匹配的缓存"""
        keys = self.redis_client.keys(pattern)
        if keys:
            self.redis_client.delete(*keys)


# 查询性能监控
class QueryProfiler:
    """
    查询性能分析器
    """
    
    def __init__(self):
        self.queries = []
    
    @contextmanager
    def profile(self, description: str = ""):
        """
        性能分析上下文管理器
        
        使用示例：
        with QueryProfiler().profile("获取项目列表"):
            projects = db.query(ResearchProject).all()
        """
        start_time = datetime.now()
        yield
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        self.queries.append({
            'description': description,
            'duration': duration,
            'timestamp': start_time
        })
        
        # 慢查询警告
        if duration > 1.0:
            print(f"⚠️ 慢查询警告: {description} 耗时 {duration:.2f}秒")
    
    def get_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        if not self.queries:
            return {'total_queries': 0}
        
        total_duration = sum(q['duration'] for q in self.queries)
        avg_duration = total_duration / len(self.queries)
        slow_queries = [q for q in self.queries if q['duration'] > 1.0]
        
        return {
            'total_queries': len(self.queries),
            'total_duration': total_duration,
            'average_duration': avg_duration,
            'slow_queries': slow_queries,
            'queries': self.queries
        }


# 常用查询示例
class OptimizedQueries:
    """
    优化后的常用查询示例
    """
    
    @staticmethod
    @CachedQuery('collaborators_stats', ttl=600)
    def get_collaborators_with_stats(db: Session) -> List[Dict[str, Any]]:
        """
        获取合作者统计信息
        使用子查询避免N+1问题
        """
        from sqlalchemy import func
        from ..models import Collaborator, ResearchProject, project_collaborators
        
        # 子查询：每个合作者的项目数
        project_count_subquery = (
            db.query(
                project_collaborators.c.collaborator_id,
                func.count(project_collaborators.c.project_id).label('project_count')
            )
            .join(ResearchProject, ResearchProject.id == project_collaborators.c.project_id)
            .filter(ResearchProject.status == 'active')
            .group_by(project_collaborators.c.collaborator_id)
            .subquery()
        )
        
        # 主查询
        results = (
            db.query(
                Collaborator,
                func.coalesce(project_count_subquery.c.project_count, 0).label('project_count')
            )
            .outerjoin(
                project_count_subquery,
                Collaborator.id == project_count_subquery.c.collaborator_id
            )
            .filter(Collaborator.is_deleted == False)
            .all()
        )
        
        return [
            {
                'collaborator': collaborator,
                'project_count': project_count
            }
            for collaborator, project_count in results
        ]
    
    @staticmethod
    def get_projects_with_relations(db: Session, status: Optional[str] = None) -> List[Any]:
        """
        获取项目及其关联数据
        使用selectinload避免N+1查询
        """
        from ..models import ResearchProject
        
        query = db.query(ResearchProject).options(
            selectinload(ResearchProject.collaborators),
            selectinload(ResearchProject.communication_logs)
        )
        
        if status:
            query = query.filter(ResearchProject.status == status)
        
        return query.all()


# 数据库索引建议
DATABASE_INDEX_SUGGESTIONS = """
-- 为常用查询添加索引

-- 合作者表索引
CREATE INDEX idx_collaborators_name ON collaborators(name);
CREATE INDEX idx_collaborators_is_deleted ON collaborators(is_deleted);
CREATE INDEX idx_collaborators_is_senior ON collaborators(is_senior);

-- 研究项目表索引
CREATE INDEX idx_research_projects_status ON research_projects(status);
CREATE INDEX idx_research_projects_is_todo ON research_projects(is_todo);
CREATE INDEX idx_research_projects_created_at ON research_projects(created_at);
CREATE INDEX idx_research_projects_priority ON research_projects(priority);

-- 沟通记录表索引
CREATE INDEX idx_communication_logs_project_id ON communication_logs(project_id);
CREATE INDEX idx_communication_logs_date ON communication_logs(communication_date);

-- 复合索引（用于常见的组合查询）
CREATE INDEX idx_projects_status_priority ON research_projects(status, priority);
CREATE INDEX idx_collaborators_deleted_senior ON collaborators(is_deleted, is_senior);

-- 想法表索引
CREATE INDEX idx_ideas_is_implemented ON ideas(is_implemented);
CREATE INDEX idx_ideas_created_at ON ideas(created_at);
"""