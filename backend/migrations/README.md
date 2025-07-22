# 🔧 数据库迁移系统

## 💡 设计理念

**一个脚本搞定所有迁移** - 不再堆积大量一次性脚本文件

## 📁 文件结构

```
migrations/
├── migration.py          # 唯一的迁移脚本
├── README.md            # 本说明文档  
└── (已删除旧脚本)       # 清理完毕
```

## 🚀 使用流程

### 1️⃣ 需要数据库修改时

**编辑 `migration.py`：**

```python
# 1. 更新版本号
MIGRATION_VERSION = "v1.1_add_new_feature"

# 2. 在 run_migration() 函数中添加你的SQL操作
def run_migration():
    # 你的迁移代码
    cursor.execute("ALTER TABLE users ADD COLUMN new_field TEXT")
    logger.info("添加了新字段")
```

### 2️⃣ 部署时自动执行

```bash
# VPS上会自动执行：
./deploy-scripts/vps-update.sh
# └── 调用 python3 migrations/migration.py
```

### 3️⃣ 执行后自动跟踪

- ✅ 自动记录执行历史  
- ✅ 防止重复执行
- ✅ 备份原数据库

## 🎯 核心优势

| 旧方案 | 新方案 |
|--------|--------|
| ❌ 文件越积越多 | ✅ 只有一个文件 |
| ❌ 每次新建脚本 | ✅ 覆盖同一文件 |
| ❌ 需要手动清理 | ✅ 自动管理历史 |
| ❌ 遍历所有文件 | ✅ 只执行一个 |

## 📋 迁移历史跟踪

系统自动在数据库中创建 `migration_history` 表：

```sql
CREATE TABLE migration_history (
    id INTEGER PRIMARY KEY,
    version TEXT UNIQUE,           -- 版本号
    executed_at DATETIME          -- 执行时间
);
```

## 🔄 典型工作流

### 场景：需要给用户表添加新字段

1. **修改 migration.py**：
```python
MIGRATION_VERSION = "v1.2_add_user_avatar"

# 在 run_migration() 中添加：
cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
```

2. **提交代码**：
```bash
git add backend/migrations/migration.py
git commit -m "feat: Add user avatar field migration"
```

3. **部署**：
```bash
./deploy.sh  # 自动触发VPS更新和迁移
```

4. **结果**：
   - VPS数据库自动添加新字段
   - 迁移历史自动记录
   - 下次部署跳过此迁移

## ⚠️ 重要提醒

1. **版本号必须唯一** - 防止重复执行
2. **测试SQL语句** - 先在本地测试
3. **备份自动创建** - 出错时可恢复
4. **幂等性设计** - 多次执行不出错

## 🔍 验证迁移

```bash
# 连接VPS数据库查看
sqlite3 research_dashboard.db

# 查看迁移历史
SELECT * FROM migration_history;

# 验证具体变更
.schema users  # 查看表结构
```

## 🎉 总结

**原则**：One File to Rule Them All！

不再是迁移文件的"收集者"，而是迁移任务的"管理者"！