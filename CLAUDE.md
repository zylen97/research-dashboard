# Research Dashboard 项目规范

## 🚀 部署
```bash
./deploy-scripts/deploy.sh          # 自动部署所有
./deploy-scripts/deploy.sh --backend # 仅后端
./deploy-scripts/deploy.sh --frontend # 仅前端
```

## 📦 数据库迁移（全自动）

### 修改数据库结构
```python
# 1. 编辑 backend/migrations/migration.py
MIGRATION_VERSION = "v1.12_your_feature"  # 改版本号

# 2. 在 run_migration() 中添加
if MIGRATION_VERSION == "v1.12_your_feature":
    cursor.execute("CREATE TABLE ...")
    cursor.execute("ALTER TABLE ... ADD COLUMN ...")

# 3. 部署即自动执行
./deploy-scripts/deploy.sh
```

### 常见数据库问题
- **缺少表/字段**: 更新migration.py → 部署
- **数据不一致**: 在migration中添加UPDATE语句
- **需要回滚**: 使用自动生成的.backup文件

### 快速诊断
```bash
# 查看错误日志
journalctl -u research-backend -n 50 | grep -i error
# 手动测试迁移
cd backend && python migrations/migration.py
```

## 🏗️ 项目结构
```
frontend/
├── src/
│   ├── components/   # 通用组件
│   ├── pages/       # 页面组件
│   ├── services/    # API调用
│   └── hooks/       # 自定义hooks
backend/
├── app/
│   ├── routes/      # API路由
│   ├── models/      # 数据模型
│   └── utils/       # 工具函数
└── migrations/      # 数据库迁移
```

## 💡 常用代码模板

### 前端API调用
```typescript
import { api } from '@/services/api';
const data = await api.get('/api/endpoint');
```

### 后端路由
```python
from app.utils.response import success_response
@router.get("/")
async def get_items(request: Request, db: Session = Depends(get_db)):
    return success_response(data)
```

## ⚡ 核心规则
1. **永远使用** deploy.sh 部署
2. **永远更新** MIGRATION_VERSION（每次改数据库）
3. **永远测试** 本地后再部署
4. **一个文件** backend/migrations/migration.py 管理所有迁移

---
**生产环境**: http://45.149.156.216:3001