# Research Dashboard 项目规范

## 快速启动
```bash
./start-local.sh          # 启动前后端（http://localhost:3001）
./stop-local.sh           # 停止所有服务
```

## 数据库架构
- **主数据库**: `backend/data/research_dashboard.db`（单一数据库，无环境区分）
- **备份目录**: `backend/backups/YYYYMMDD_HHMMSS/`（保留最近7个）

**核心表**：research_projects, ideas, collaborators, journals, tags, journal_tags, communication_logs, audit_logs

**期刊系统**：
- 通过标签对期刊进行分类（标签完全可选）
- Ideas/Projects引用期刊通过reference_journal/target_journal字段
- 被引用期刊受删除保护

**变更记录**：
- v3.1_remove_language_field - 移除journals.language字段，改用标签系统
- v3.2_simplify_tags - 移除语言标签特殊验证，所有标签平等对待

## 数据库修改流程
```bash
# 1. 修改 backend/migrations/migration.py
MIGRATION_VERSION = "v3.x_feature_name"

# 2. 添加迁移代码
cursor.execute("ALTER TABLE ... ADD COLUMN ...")

# 3. 手动执行
cd backend && python migrations/migration.py
```

## 数据库操作禁令
**绝对禁止**：
1. DROP TABLE + CREATE TABLE（不允许重建表）
2. 删除或重命名字段（只能添加新字段，且必须有默认值）
3. 跳过本地验证直接部署Migration

**血的教训**：2025-07-24因重建表导致27条collaborator数据字段错位

## 故障排除
```bash
# 服务状态
ps aux | grep uvicorn && ps aux | grep react-scripts

# 日志
tail -f logs/backend.log

# 强制停止
pkill -f uvicorn && pkill -f react-scripts

# 数据库调试
cd backend && sqlite3 data/research_dashboard.db ".schema"
```
