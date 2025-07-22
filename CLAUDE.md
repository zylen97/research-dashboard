# USTS Research Dashboard - Claude Code 开发指南

本文档为Claude Code开发USTS科研管理系统提供核心指导。

## 🎯 项目核心信息

- **项目名称**：USTS Research Dashboard (USTS科研管理系统)
- **技术栈**：React + TypeScript + Ant Design (前端) | FastAPI + SQLAlchemy + SQLite (后端)
- **生产环境**：http://45.149.156.216:3001
- **GitHub仓库**：https://github.com/zylen97/research-dashboard

## 🚀 部署系统（⚠️ 最重要）

### 正确的部署方式
```bash
# ✅ 必须使用这个命令部署
./deploy-scripts/deploy.sh

# 可选参数
./deploy-scripts/deploy.sh --frontend  # 仅前端
./deploy-scripts/deploy.sh --backend   # 仅后端
./deploy-scripts/deploy.sh --all       # 前后端

# ❌ 禁止直接推送
# git add . && git commit -m "xxx" && git push
```

### 部署流程
```
本地开发 → ./deploy-scripts/deploy.sh → GitHub → GitHub Actions → VPS自动部署
```

### 核心文件（禁止删除）
- `deploy-scripts/deploy.sh` - 智能部署脚本
- `deploy-scripts/vps-update.sh` - VPS更新脚本
- `.github/workflows/` - GitHub Actions配置

## 🏗️ 项目结构

```
research-dashboard/
├── frontend/              # React前端
│   ├── src/components/    # 组件（collaborator/common/system）
│   ├── src/hooks/         # 自定义Hooks
│   ├── src/utils/         # 工具函数
│   └── src/config/api.ts  # API配置（统一）
├── backend/               # FastAPI后端
│   ├── app/routes/        # API路由
│   ├── app/utils/         # 工具（crud_base.py, response.py）
│   ├── app/core/          # 核心配置
│   └── migrations/        # 数据库迁移
├── deploy-scripts/        # 部署脚本（核心）
└── .github/workflows/     # CI/CD
```

## 💾 数据库管理

### 环境隔离
- **开发**：`backend/data/research_dashboard_dev.db`
- **生产**：`backend/data/research_dashboard_prod.db`

### 迁移操作
```python
# 1. 修改版本号
MIGRATION_VERSION = "v1.4_add_feature"

# 2. 添加SQL操作
cursor.execute("ALTER TABLE xxx ADD COLUMN yyy VARCHAR(255)")

# 3. 部署
./deploy-scripts/deploy.sh --backend
```

## 📝 开发规范

### 前端
- **组件**：`frontend/src/components/`
- **Hooks**：`frontend/src/hooks/`
- **API**：`frontend/src/services/api.ts`
- **配置**：`frontend/src/config/api.ts`

### 后端
- **路由**：`backend/app/routes/`
- **模型**：`backend/app/models/`
- **工具**：`backend/app/utils/`（crud_base.py, response.py）
- **配置**：`backend/app/core/config.py`

### 代码风格
- **前端**：TypeScript严格类型，React Hooks
- **后端**：PEP 8规范，类型注解
- **提交**：语义化提交（feat/fix/docs）

## 🔑 重要功能

### 认证系统
- JWT令牌，7天有效期
- 预置用户：zl, zz, yq, dj (密码：123)

### 项目管理
- 状态：active/completed/paused
- 待办：is_todo字段，todo_marked_at时间戳

### 合作者系统
- 高级合作者：is_senior字段
- 软删除：is_deleted字段

### AI批量匹配
- 多提供商支持（OpenAI、Anthropic）
- 并发处理，性能监控

### 系统配置
- 加密存储敏感信息
- 配置测试功能

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