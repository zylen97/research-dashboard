# Research Dashboard 项目规范

## 🚀 部署
```bash
./deploy-scripts/deploy.sh          # 自动部署所有
./deploy-scripts/deploy.sh --backend # 仅后端
./deploy-scripts/deploy.sh --frontend # 仅前端
```

## 📦 数据库迁移
```python
# backend/migrations/migration.py
MIGRATION_VERSION = "v1.12_feature_name"  # 更新版本号
# 添加迁移代码...
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
2. **永远更新** MIGRATION_VERSION
3. **永远测试** 本地后再部署

---
**生产环境**: http://45.149.156.216:3001