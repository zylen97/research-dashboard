# Research Dashboard 项目规范（本地化版本）

## 🚀 启动命令
```bash
./start-local.sh          # 启动前后端服务
./stop-local.sh           # 停止所有服务
```

## 📦 数据库修改
```python
# backend/migrations/migration.py
MIGRATION_VERSION = "v2.x_your_feature"  # 1.改版本号

# 2.添加迁移代码
cursor.execute("CREATE TABLE ...")
cursor.execute("ALTER TABLE ... ADD COLUMN ...")

# 3.手动执行迁移
cd backend && python migrations/migration.py
```

## 🔧 故障排除
```bash
# 查看服务状态
ps aux | grep uvicorn
ps aux | grep react-scripts

# 查看日志
tail -f logs/backend.log
tail -f logs/frontend.log

# 数据库问题
cd backend && python migrations/migration.py  # 执行迁移
sqlite3 data/research_dashboard.db ".schema"  # 查看表结构

# 强制停止服务
pkill -f uvicorn
pkill -f react-scripts
```

## 🚨 数据库危险操作禁令
**以下操作绝对禁止，违反将导致数据灾难：**

1. **绝不重建表结构** - 永远不允许DROP TABLE + CREATE TABLE
2. **绝不修改字段名** - 只能添加新字段，不能删除或重命名现有字段
3. **Migration前必须验证** - 测试数据完整性，确保字段映射正确
4. **保持向后兼容** - 新字段必须有默认值，旧代码能正常工作
5. **一次一个Migration版本** - 绝不创建多个连续版本
6. **充分测试后再部署** - Migration必须在本地完全验证

**血的教训**: 2025-07-24因违反以上规则导致27条collaborator数据字段错位，API全部返回空数组

## ⚡ 核心规则
1. **启动**: 用 start-local.sh / stop-local.sh
2. **数据库**: 只改 migration.py + 版本号，手动执行
3. **认证**: 已移除，无需登录，单用户模式
4. **环境**: 统一使用 research_dashboard.db

## 🏠 本地运行信息
- **前端**: http://localhost:3001
- **后端API**: http://localhost:8080
- **API文档**: http://localhost:8080/docs
- **数据库**: `backend/data/research_dashboard.db`

## 📋 常用命令
```bash
# 启动服务
./start-local.sh

# 停止服务
./stop-local.sh

# 查看日志
tail -f logs/backend.log
tail -f logs/frontend.log

# 数据库操作
cd backend
sqlite3 data/research_dashboard.db
```

---
**说明**: 本项目已本地化，无需VPS部署。单用户模式，直接访问即可使用。
