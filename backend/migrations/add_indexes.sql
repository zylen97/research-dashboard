-- 数据库性能优化：添加索引
-- 执行时间：2025-07-24
-- 注意：在生产环境执行前，请先在测试环境验证

-- ========================================
-- 1. 合作者表索引
-- ========================================

-- 姓名索引（用于搜索）
CREATE INDEX IF NOT EXISTS idx_collaborators_name 
ON collaborators(name);

-- 删除状态索引（大部分查询都会过滤已删除记录）
CREATE INDEX IF NOT EXISTS idx_collaborators_is_deleted 
ON collaborators(is_deleted);

-- 高年级标记索引
CREATE INDEX IF NOT EXISTS idx_collaborators_is_senior 
ON collaborators(is_senior);

-- 复合索引：删除状态+高年级（常见组合查询）
CREATE INDEX IF NOT EXISTS idx_collaborators_deleted_senior 
ON collaborators(is_deleted, is_senior);


-- ========================================
-- 2. 研究项目表索引
-- ========================================

-- 项目状态索引
CREATE INDEX IF NOT EXISTS idx_research_projects_status 
ON research_projects(status);

-- 待办事项索引
CREATE INDEX IF NOT EXISTS idx_research_projects_is_todo 
ON research_projects(is_todo);

-- 创建时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_research_projects_created_at 
ON research_projects(created_at);

-- 优先级索引
CREATE INDEX IF NOT EXISTS idx_research_projects_priority 
ON research_projects(priority);

-- 复合索引：状态+优先级（常见组合查询）
CREATE INDEX IF NOT EXISTS idx_projects_status_priority 
ON research_projects(status, priority);

-- 复合索引：状态+创建时间（用于获取最新的活跃项目）
CREATE INDEX IF NOT EXISTS idx_projects_status_created 
ON research_projects(status, created_at DESC);


-- ========================================
-- 3. 沟通记录表索引
-- ========================================

-- 项目ID索引（外键查询）
CREATE INDEX IF NOT EXISTS idx_communication_logs_project_id 
ON communication_logs(project_id);

-- 沟通日期索引（用于排序和筛选）
CREATE INDEX IF NOT EXISTS idx_communication_logs_date 
ON communication_logs(communication_date);

-- 复合索引：项目ID+日期（获取项目的沟通历史）
CREATE INDEX IF NOT EXISTS idx_logs_project_date 
ON communication_logs(project_id, communication_date DESC);


-- ========================================
-- 4. 想法表索引
-- ========================================

-- 实施状态索引
CREATE INDEX IF NOT EXISTS idx_ideas_is_implemented 
ON ideas(is_implemented);

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_ideas_created_at 
ON ideas(created_at);

-- 复合索引：实施状态+创建时间
CREATE INDEX IF NOT EXISTS idx_ideas_implemented_created 
ON ideas(is_implemented, created_at DESC);


-- ========================================
-- 5. 项目-合作者关联表索引
-- ========================================

-- 确保关联表有适当的索引
-- 注意：主键和外键通常会自动创建索引

-- 项目ID索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project 
ON project_collaborators(project_id);

-- 合作者ID索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_project_collaborators_collaborator 
ON project_collaborators(collaborator_id);


-- ========================================
-- 6. 审计日志表索引（如果存在）
-- ========================================

-- 用户ID索引
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
-- ON audit_logs(user_id);

-- 操作时间索引
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
-- ON audit_logs(created_at);

-- 目标类型和ID的复合索引
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_target 
-- ON audit_logs(target_type, target_id);


-- ========================================
-- 查询索引使用情况
-- ========================================

-- SQLite查询索引信息
-- .indexes

-- 查询表结构
-- .schema table_name

-- 分析查询计划
-- EXPLAIN QUERY PLAN SELECT ...


-- ========================================
-- 性能优化建议
-- ========================================

-- 1. 定期运行 ANALYZE 更新统计信息
-- ANALYZE;

-- 2. 定期清理数据库
-- VACUUM;

-- 3. 监控慢查询
-- 在应用层添加查询时间记录

-- 4. 考虑对大表进行分区（如果数据量很大）

-- 5. 定期检查索引使用情况，删除未使用的索引