# 🎓 USTS Research Dashboard

科研项目管理系统

[![部署状态](https://img.shields.io/badge/部署-生产环境-brightgreen)](http://45.149.156.216:3001)
[![技术栈](https://img.shields.io/badge/技术栈-React+FastAPI-blue)](#-技术架构)

---

## 📋 项目简介

USTS Research Dashboard 是一个科研项目管理平台，提供项目进度跟踪、合作者管理、交流记录和AI辅助功能。

### 主要功能

- 📊 **项目管理** - 研究项目全生命周期管理，支持多状态流转
- 👥 **合作者管理** - 合作者信息管理和项目关联
- 💡 **Ideas管理** - 研究想法收集、评估和项目转化
- 🤖 **AI处理** - Excel文献批量处理，智能生成研究建议
- 📄 **模板系统** - Prompt模板管理，提高AI交互效率
- 💾 **数据备份** - 自动备份和恢复功能

---

## 🚀 核心功能

### 研究项目看板

#### 项目状态管理
- **撰写中** (active) - 项目正在进行中
- **暂停** (paused) - 项目暂时搁置
- **审稿中** (reviewing) - 提交审稿阶段
- **返修中** (revising) - 审稿后修改阶段
- **存档** (completed) - 项目已完成归档

#### 项目功能
- **项目预览** - 点击预览图标查看项目完整信息
- **交流日志** - 记录项目相关的所有交流活动
- **待办标记** - 标记需要优先处理的项目
- **进度跟踪** - 百分比形式的项目进度管理
- **存档过滤** - 默认隐藏存档项目，可通过开关切换显示

### 合作者管理
- **信息管理** - 合作者基本信息、联系方式、背景等
- **批量导入** - 支持Excel文件批量导入合作者
- **高级/普通分类** - 区分高级合作者和普通合作者
- **软删除机制** - 安全的删除和恢复功能

### Ideas管理
- **想法记录** - 项目名称、描述、研究方法、来源、负责人
- **成熟度评估** - mature（成熟）/ immature（不成熟）
- **项目转化** - 将成熟的想法转化为正式研究项目
- **列表管理** - 带序号的列表展示

### AI智能处理

#### 支持的AI模型
- Claude系列 (Claude 3.7 Sonnet, Sonnet 4, Opus 4)
- GPT系列 (GPT-4, GPT-4o, GPT-4.1)
- DeepSeek系列 (DeepSeek V3, R1)
- 自定义API端点

#### Excel文献处理
- 批量处理文献摘要和标题
- 生成研究迁移建议
- 支持并发处理（0-50）
- 中文文件名支持

### 数据管理
- **自动备份** - 定期自动备份数据库
- **手动备份** - 支持手动创建备份并添加说明
- **备份恢复** - 一键恢复到指定备份版本
- **数据迁移** - 版本化的数据库迁移脚本

---

## 🔧 技术架构

### 前端技术
- React 18 + TypeScript
- Ant Design 5.x UI组件库
- React Query 数据状态管理
- React Router v6 路由管理
- Axios HTTP请求

### 后端技术
- FastAPI Web框架
- SQLAlchemy 2.x ORM
- Pydantic v2 数据验证
- SQLite 数据库
- JWT 认证

### 部署架构
- Nginx 反向代理
- Systemd 服务管理
- 自动化部署脚本

---

## 🌐 访问地址

- **主站**: http://45.149.156.216:3001
- **API文档**: http://45.149.156.216:8080/docs

---

## 🚀 部署指南

### 快速部署
```bash
# 自动检测并部署修改的部分
./deploy-scripts/deploy.sh

# 指定部署内容
./deploy-scripts/deploy.sh --frontend   # 仅前端
./deploy-scripts/deploy.sh --backend    # 仅后端
./deploy-scripts/deploy.sh --dry-run    # 预览模式
```

### 系统要求
- Python 3.8+
- Node.js 16+
- 2GB+ 内存
- 10GB+ 存储空间

---

## 🛠️ 开发指南

### 本地开发

#### 后端启动
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

#### 前端启动
```bash
cd frontend
npm install
npm start
```

### 数据库管理
```bash
# 执行迁移
cd backend && python migrations/migration.py

# 数据备份
./deployment/backup-restore.sh backup

# 数据恢复
./deployment/backup-restore.sh restore
```

---

## 📖 API接口

### 认证
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 项目管理
- `GET /api/research/` - 获取项目列表
- `POST /api/research/` - 创建项目
- `PUT /api/research/{id}` - 更新项目
- `DELETE /api/research/{id}` - 删除项目
- `GET /api/research/{id}/logs` - 获取交流日志
- `POST /api/research/{id}/todo` - 标记待办
- `DELETE /api/research/{id}/todo` - 取消待办

### 合作者管理
- `GET /api/collaborators/` - 获取合作者列表
- `POST /api/collaborators/` - 创建合作者
- `POST /api/collaborators/upload` - Excel批量导入
- `DELETE /api/collaborators/{id}` - 删除合作者

### Ideas管理
- `GET /api/ideas/` - 获取Ideas列表
- `POST /api/ideas/` - 创建Idea
- `PUT /api/ideas/{id}` - 更新Idea
- `DELETE /api/ideas/{id}` - 删除Idea
- `POST /api/ideas/{id}/convert-to-project` - 转换为项目

### AI处理
- `POST /api/ideas/process-excel` - Excel文件AI处理
- `GET /api/config/ai/providers` - 获取AI配置
- `POST /api/config/ai/test` - 测试AI连接

### Prompt管理
- `GET /api/prompts/` - 获取模板列表
- `POST /api/prompts/` - 创建模板
- `PUT /api/prompts/{id}` - 更新模板
- `DELETE /api/prompts/{id}` - 删除模板

---

## 🆕 最新更新 (v2.1.0)

### 项目管理优化
- ✅ 新增项目状态：审稿中、返修中
- ✅ 项目预览功能：快速查看项目完整信息
- ✅ 存档过滤：默认隐藏已存档项目
- ✅ 列表优化：移除描述列，界面更简洁

### 状态系统
- 撰写中 → 审稿中 → 返修中 → 存档
- 支持暂停状态
- 状态颜色区分，便于识别

---

## 🆕 未来开发计划

- 文献分工看，勾选功能
- 自动生成文献综述列表的功能


---



## 🐛 故障排除

### 常见问题

1. **端口占用**
```bash
lsof -i :3001
lsof -i :8080
kill -9 <PID>
```

2. **服务状态检查**
```bash
systemctl status research-backend
journalctl -u research-backend -f
```

3. **AI配置问题**
- 检查API密钥配置
- 确认模型选择正确
- 验证网络连接

4. **数据库问题**
- 检查迁移版本
- 查看migration.py日志
- 必要时从备份恢复

---

## 📄 许可证

本项目采用 MIT 许可证

---

## 📞 联系方式

- 问题反馈：[GitHub Issues](https://github.com/zylen97/research-dashboard/issues)
- 功能建议：通过Issues提交

---

**© 2025 Zylen Copyright - All Rights Reserved**