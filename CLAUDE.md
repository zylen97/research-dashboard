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

## 🔧 快速修复
```bash
# 数据库错误
journalctl -u research-backend -n 50  # 看日志
cd backend && python migrations/migration.py  # 测试迁移

# API路由
@router.get("/")
async def get_items(request: Request, db: Session = Depends(get_db)):
    return success_response(data)
```

## ⚡ 核心规则
1. **部署**: 只用 deploy.sh
2. **数据库**: 只改 migration.py + 版本号
3. **测试**: 本地先测试
4. **此文件**: 未经指示不得修改 CLAUDE.md

---
**生产环境**: http://45.149.156.216:3001