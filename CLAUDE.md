

## ⚠️ 关键注意事项

### 部署相关（最重要）
- **必须**使用`./deploy-scripts/deploy.sh`部署
- **禁止**直接git push
- **必须**保留deploy-scripts目录
- **验证**：使用`backend/test_integration.py`检查系统

### 数据库相关
- **必须**使用单一migration.py管理迁移
- **必须**更新版本号避免重复执行

### 开发相关
- **避免**硬编码配置
- **建议**本地测试后部署

## 🔧 开发工具使用

### 前端Hooks
```typescript
// 模态框表单管理
const { isModalVisible, showModal, handleSubmit } = useModalForm();

// 表格CRUD操作
const { data, loading, handleDelete, refresh } = useTableCRUD();
```

### 后端工具
```python
# CRUD基类
from app.utils.crud_base import CRUDBase

# 统一响应
from app.utils.response import create_response
```

### 系统验证
```bash
# 运行集成验证
cd backend && python test_integration.py
```

## 🎯 常用开发任务

### 添加新功能
1. 开发功能（前端组件+后端API）
2. 本地测试
3. 部署：`./deploy-scripts/deploy.sh`

### 修复Bug
1. 定位问题
2. 修复代码
3. 验证修复
4. 部署：`./deploy-scripts/deploy.sh`

### 数据库修改
1. 编辑`backend/migrations/migration.py`
2. 更新`MIGRATION_VERSION`
3. 部署：`./deploy-scripts/deploy.sh --backend`

---

⚡ **核心原则**：所有代码修改都必须通过`./deploy-scripts/deploy.sh`部署到VPS！

🚀 **Ultra Think**：代码写好 → 智能部署脚本 → 生产环境！