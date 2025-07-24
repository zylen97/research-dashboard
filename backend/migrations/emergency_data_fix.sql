-- ===================================================================
-- 🚨 EMERGENCY DATA FIX - Research Dashboard
-- 紧急数据修复脚本
-- 
-- 问题：数据库字段映射严重错误
-- - created_at/updated_at字段存储了'senior'/'junior'字符串
-- - 导致Pydantic解析失败，API返回空数组
-- - 系统整体不可用
--
-- 执行前必读：
-- 1. 这个脚本会修改现有数据，请先备份数据库
-- 2. 在生产环境执行前，请先在测试环境验证
-- 3. 执行完成后检查API是否恢复正常
--
-- 创建时间：2025-07-24
-- ===================================================================

-- 开始事务，确保原子性
BEGIN TRANSACTION;

-- 步骤1：创建紧急备份表
-- ===========================================
DROP TABLE IF EXISTS collaborators_backup_emergency_20250724;
CREATE TABLE collaborators_backup_emergency_20250724 AS 
SELECT * FROM collaborators;

DROP TABLE IF EXISTS research_projects_backup_emergency_20250724;
CREATE TABLE research_projects_backup_emergency_20250724 AS 
SELECT * FROM research_projects WHERE 1;

DROP TABLE IF EXISTS ideas_backup_emergency_20250724;
CREATE TABLE ideas_backup_emergency_20250724 AS 
SELECT * FROM ideas WHERE 1;

-- 记录备份信息
INSERT INTO migration_history (version, executed_at) VALUES 
('EMERGENCY_BACKUP_20250724', datetime('now'));

-- 步骤2：诊断数据污染程度
-- ===========================================

-- 查看所有时间字段的数据类型污染
SELECT 'collaborators_created_at_errors' as table_field, COUNT(*) as error_count
FROM collaborators 
WHERE created_at IN ('senior', 'junior') OR created_at NOT LIKE '____-__-__%'

UNION ALL

SELECT 'collaborators_updated_at_errors', COUNT(*)
FROM collaborators 
WHERE updated_at IN ('senior', 'junior') OR updated_at NOT LIKE '____-__-__%'

UNION ALL

SELECT 'collaborators_deleted_at_errors', COUNT(*)
FROM collaborators 
WHERE deleted_at IN ('senior', 'junior', '') AND deleted_at IS NOT NULL;

-- 步骤3：修复collaborators表的字段映射错误
-- ===========================================

-- 修复created_at字段
UPDATE collaborators 
SET created_at = datetime('now')
WHERE created_at IN ('senior', 'junior') 
   OR created_at NOT LIKE '____-__-__%' 
   OR created_at IS NULL;

-- 修复updated_at字段
UPDATE collaborators 
SET updated_at = datetime('now')
WHERE updated_at IN ('senior', 'junior') 
   OR updated_at NOT LIKE '____-__-__%' 
   OR updated_at IS NULL;

-- 修复deleted_at字段（清理垃圾数据）
UPDATE collaborators 
SET deleted_at = NULL
WHERE deleted_at IN ('senior', 'junior', '');

-- 修复is_deleted字段，确保与deleted_at一致
UPDATE collaborators 
SET is_deleted = 0
WHERE deleted_at IS NULL;

UPDATE collaborators 
SET is_deleted = 1, deleted_at = datetime('now')
WHERE is_deleted = 1 AND deleted_at IS NULL;

-- 步骤4：修复research_projects表
-- ===========================================

UPDATE research_projects 
SET created_at = datetime('now')
WHERE created_at NOT LIKE '____-__-__%' 
   OR created_at IS NULL;

UPDATE research_projects 
SET updated_at = datetime('now')
WHERE updated_at NOT LIKE '____-__-__%' 
   OR updated_at IS NULL;

-- 修复todo_marked_at字段
UPDATE research_projects 
SET todo_marked_at = datetime('now')
WHERE is_todo = 1 AND todo_marked_at IS NULL;

UPDATE research_projects 
SET todo_marked_at = NULL
WHERE is_todo = 0 AND todo_marked_at IS NOT NULL;

-- 步骤5：修复ideas表
-- ===========================================

UPDATE ideas 
SET created_at = datetime('now')
WHERE created_at NOT LIKE '____-__-__%' 
   OR created_at IS NULL;

UPDATE ideas 
SET updated_at = datetime('now')
WHERE updated_at NOT LIKE '____-__-__%' 
   OR updated_at IS NULL;

-- 步骤6：数据完整性验证
-- ===========================================

-- 验证修复结果
SELECT 'Final_Verification' as check_type,
       'collaborators' as table_name,
       COUNT(*) as total_records,
       SUM(CASE WHEN created_at LIKE '____-__-__%' THEN 1 ELSE 0 END) as valid_created_at,
       SUM(CASE WHEN updated_at LIKE '____-__-__%' THEN 1 ELSE 0 END) as valid_updated_at,
       SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END) as deleted_count,
       SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) as active_count
FROM collaborators

UNION ALL

SELECT 'Final_Verification',
       'research_projects',
       COUNT(*),
       SUM(CASE WHEN created_at LIKE '____-__-__%' THEN 1 ELSE 0 END),
       SUM(CASE WHEN updated_at LIKE '____-__-__%' THEN 1 ELSE 0 END),
       SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END),
       SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END)
FROM research_projects

UNION ALL

SELECT 'Final_Verification',
       'ideas',
       COUNT(*),
       SUM(CASE WHEN created_at LIKE '____-__-__%' THEN 1 ELSE 0 END),
       SUM(CASE WHEN updated_at LIKE '____-__-__%' THEN 1 ELSE 0 END),
       SUM(CASE WHEN is_implemented = 1 THEN 1 ELSE 0 END),
       SUM(CASE WHEN is_implemented = 0 THEN 1 ELSE 0 END)
FROM ideas;

-- 步骤7：清理和索引优化
-- ===========================================

-- 重建统计信息
ANALYZE;

-- 清理数据库碎片
VACUUM;

-- 记录修复完成
INSERT INTO migration_history (version, executed_at) VALUES 
('EMERGENCY_DATA_FIX_20250724', datetime('now'));

-- 提交事务
COMMIT;

-- ===================================================================
-- 🎉 紧急修复完成！
-- 
-- 下一步操作：
-- 1. 重启后端服务：systemctl restart research-backend
-- 2. 检查API健康状态：curl http://localhost:8080/api/collaborators/
-- 3. 验证前端是否可以正常加载数据
-- 4. 查看日志确认没有Pydantic解析错误
--
-- 如果修复失败，可以从备份表恢复：
-- DROP TABLE collaborators;
-- ALTER TABLE collaborators_backup_emergency_20250724 RENAME TO collaborators;
-- ===================================================================