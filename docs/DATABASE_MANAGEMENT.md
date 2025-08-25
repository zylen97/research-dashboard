# 数据库管理指南

## 🗄️ 数据库架构

### 环境隔离
```
本地开发环境                    VPS生产环境
     ↓                            ↓
research_dashboard_dev.db    research_dashboard_prod.db
     ↓                            ↓
   测试数据                      真实数据
```

## 📊 数据库文件位置

### 本地开发
```bash
backend/data/research_dashboard_dev.db
```

### VPS生产
```bash
/var/www/research-dashboard/backend/data/research_dashboard_prod.db
```

## 🔧 常用操作

### 1. 查看数据库内容

#### 本地开发数据库
```bash
cd backend
sqlite3 data/research_dashboard_dev.db

# SQLite命令
.tables                          # 查看所有表
SELECT * FROM research_projects; # 查看项目
SELECT * FROM users;             # 查看用户
.quit                           # 退出
```

#### VPS生产数据库
```bash
# SSH登录VPS
ssh root@45.149.156.216

# 进入项目目录
cd /var/www/research-dashboard/backend

# 查看数据库
sqlite3 data/research_dashboard_prod.db
```

### 2. 备份数据库

#### 备份开发数据库
```bash
cp backend/data/research_dashboard_dev.db backend/data/backup_dev_$(date +%Y%m%d).db
```

#### 备份生产数据库（重要！）
```bash
# 在VPS上
./deployment/backup-restore.sh backup
```

### 3. 重置数据库

#### 重置开发数据库（安全）
```bash
# 删除旧数据库
rm backend/data/research_dashboard_dev.db

# 重启服务，会自动创建新数据库
./stop-dev.sh
./start-dev.sh
```

#### 重置生产数据库（危险！）
```
⚠️ 警告：这会删除所有用户数据！
请先备份！
```

## 🚀 数据迁移场景

### 场景1：将开发数据部署到生产

```bash
# 1. 备份生产数据（重要！）
ssh root@45.149.156.216 "cd /var/www/research-dashboard && ./deployment/backup-restore.sh backup"

# 2. 上传开发数据库到VPS
scp backend/data/research_dashboard_dev.db root@45.149.156.216:/tmp/new_data.db

# 3. 在VPS上替换（谨慎！）
ssh root@45.149.156.216
cd /var/www/research-dashboard/backend/data
cp research_dashboard_prod.db research_dashboard_prod.db.backup
cp /tmp/new_data.db research_dashboard_prod.db
systemctl restart research-backend
```

### 场景2：从生产复制数据到开发（调试用）

```bash
# 1. 下载生产数据库
scp root@45.149.156.216:/var/www/research-dashboard/backend/data/research_dashboard_prod.db ./prod_copy.db

# 2. 备份开发数据库
cp backend/data/research_dashboard_dev.db backend/data/dev_backup.db

# 3. 使用生产数据副本
cp prod_copy.db backend/data/research_dashboard_dev.db

# 4. 重启开发服务
./stop-dev.sh
./start-dev.sh
```

## 🛡️ 最佳实践

### 1. 数据隔离原则
- ✅ 开发环境用测试数据
- ✅ 生产环境用真实数据
- ✅ 两个环境互不干扰
- ❌ 不要在生产环境测试

### 2. 备份策略
- 每天自动备份生产数据
- 重要操作前手动备份
- 保留最近7天的备份

### 3. 数据安全
- 生产数据库文件不要提交到Git
- 定期下载生产备份到安全位置
- 敏感数据要加密

## 🔍 调试技巧

### 查看当前使用的数据库
```python
# 临时添加到后端代码
from app.core.config import settings
print(f"当前数据库: {settings.DATABASE_URL}")
```

### 比较两个数据库
```bash
# 导出表结构
sqlite3 backend/data/research_dashboard_dev.db .schema > dev_schema.sql
sqlite3 prod_copy.db .schema > prod_schema.sql

# 比较差异
diff dev_schema.sql prod_schema.sql
```

## ⚠️ 注意事项

1. **永远不要**直接修改生产数据库文件
2. **总是**在修改前备份
3. **测试**所有数据库操作先在开发环境进行
4. **记录**所有对生产数据库的修改

## 💡 快速答案

**Q: 开发和生产用同一个数据库吗？**
A: 不是！完全独立的两个数据库。

**Q: 为什么要分开？**
A: 安全！测试不会影响真实数据。

**Q: 如何同步数据？**
A: 正常情况不需要同步。特殊需求可以导出导入。

**Q: 生产数据会自动到开发吗？**
A: 不会！需要手动复制。

**Q: 我该在哪里测试？**
A: 永远在开发环境测试！