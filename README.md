# 🎓 USTS Research Dashboard

科研项目管理系统（本地化版本）

[![技术栈](https://img.shields.io/badge/技术栈-React+FastAPI-blue)](#-技术架构)
[![运行环境](https://img.shields.io/badge/运行环境-本地-orange)](#-本地运行)

---

## 📋 项目简介

USTS Research Dashboard 是一个科研项目管理平台，提供项目进度跟踪、合作者管理、交流记录和AI辅助功能。

### 主要功能

- 📊 **项目管理** - 研究项目全生命周期管理，支持多状态流转
- 👥 **合作者管理** - 合作者信息管理和项目关联
- 💡 **Ideas管理** - 研究想法收集、评估和项目转化
- 📚 **期刊库管理** - 期刊信息管理、标签分类、引用统计
- 🏷️ **标签管理** - 标签系统，支持期刊多维度分类
- 📝 **Prompts管理** - AI提示词模板库，支持变量替换和实时预览
- 🤖 **AI处理** - Excel文献批量处理，智能生成研究建议
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
- **想法记录** - 项目名称、描述、研究方法、来源、合作者
- **成熟度评估** - mature（成熟）/ immature（不成熟）
- **项目转化** - 将成熟的想法转化为正式研究项目
- **列表管理** - 带序号的列表展示

### Prompts管理
- **5个分类** - reading、writing、polishing、reviewer、horizontal
- **变量替换** - 自动提取 `{title}`、`{abstract}` 等变量
- **实时预览** - 复制时实时显示变量替换结果
- **一键复制** - 适配 ChatGPT/Claude 格式
- **使用统计** - 追踪使用次数，收藏常用 prompts

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

---

## 🏠 本地运行

### 快速启动
```bash
# 一键启动前后端
./start-local.sh

# 停止服务
./stop-local.sh
```

### 手动启动
```bash
# 后端
cd backend
source venv/bin/activate  # 如果有虚拟环境
python -m uvicorn main:app --host 127.0.0.1 --port 8080 --reload

# 前端（新终端）
cd frontend
PORT=3001 npm start
```

### 访问地址
- **前端**: http://localhost:3001
- **后端API文档**: http://localhost:8080/docs
- **健康检查**: http://localhost:8080/health

### 首次运行
1. 确保Python 3.8+和Node.js已安装
2. 后端依赖：`cd backend && pip install -r requirements.txt`
3. 前端依赖：`cd frontend && npm install`
4. 启动服务：`./start-local.sh`

---

## 🌐 项目说明

本项目已本地化运行，无需VPS部署。单用户模式，直接访问即可使用。

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

### 期刊库管理
- `GET /api/journals/` - 获取期刊列表（支持标签筛选、搜索）
- `POST /api/journals/` - 创建期刊
- `PUT /api/journals/{id}` - 更新期刊
- `DELETE /api/journals/{id}` - 删除期刊（检查引用关系）
- `GET /api/journals/{id}/stats` - 获取期刊统计信息
- `GET /api/journals/{id}/references` - 获取引用该期刊的Ideas和Projects

### 标签管理
- `GET /api/tags/` - 获取标签列表
- `POST /api/tags/` - 创建标签
- `PUT /api/tags/{id}` - 更新标签
- `DELETE /api/tags/{id}` - 删除标签（需检查是否被期刊使用）
- `GET /api/tags/{id}/journals` - 获取标签关联的期刊

---

## 🆕 最新更新 (v4.9)

### 期刊库增强
- ✅ 浏览统计：显示期刊浏览次数和期卷号数量
- ✅ 多维排序：支持按名称、总引用数、浏览次数排序
- ✅ 名称换行：期刊卡片名称支持自动换行（最多2行）
- ✅ 中文适配：中文期刊期号管理适配（卷号可选）

### Prompts 面板优化
- ✅ 变量替换修复：修复变量名映射和替换逻辑
- ✅ 剪贴板兼容：添加备用剪贴板方法，提升兼容性
- ✅ 实时预览：复制时实时显示变量替换结果
- ✅ 使用统计：备份中包含prompts数量统计

### Ideas & 项目管理
- ✅ 项目转换：Idea 一键转化为正式项目
- ✅ 状态流转：撰写中 → 审稿中 → 返修中 → 存档
- ✅ 列宽调整：所有页面表格列支持拖拽调整宽度

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
ps aux | grep uvicorn
tail -f logs/backend.log
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