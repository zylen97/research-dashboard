# Research Dashboard 项目规范

## 🚀 部署命令
```bash
./deploy-scripts/deploy.sh          # 全部部署
./deploy-scripts/deploy.sh --backend # 仅后端
```

## 📦 数据库修改
```python
# backend/migrations/migration.py
MIGRATION_VERSION = "v1.12_your_feature"  # 1.改版本号

# 2.添加迁移代码
cursor.execute("CREATE TABLE ...")
cursor.execute("ALTER TABLE ... ADD COLUMN ...")

# 3.部署自动执行
./deploy-scripts/deploy.sh
```

## 🔧 故障排除
```bash
# 查看服务状态
systemctl status research-backend
journalctl -u research-backend -n 50  # 看日志

# 数据库问题
cd backend && python migrations/migration.py  # 测试迁移

# 健康检查
./deploy-scripts/deploy.sh --health-check

# 快速回滚
./deploy-scripts/rollback.sh

# 系统验证
./deploy-scripts/verify-deployment.sh
```

## ⚡ 核心规则
1. **部署**: 只用 deploy.sh
2. **数据库**: 只改 migration.py + 版本号
3. **测试**: 本地先测试
4. **回滚**: 用 rollback.sh 快速回滚
5. **此文件**: 未经指示不得修改 CLAUDE.md

## 📋 常用命令
```bash
# 常规部署
./deploy-scripts/deploy.sh

# 查看帮助
./deploy-scripts/deploy.sh --help

# 快速部署（跳过测试）
./deploy-scripts/deploy.sh --skip-tests

# 预览部署
./deploy-scripts/deploy.sh --dry-run

# 紧急回滚
./deploy-scripts/rollback.sh
```

---
**生产环境**: http://45.149.156.216:3001