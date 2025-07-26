# 🎓 USTS Research Dashboard

**现代化科研管理系统 - AI赋能的研究项目协作平台**

[![部署状态](https://img.shields.io/badge/部署-生产环境-brightgreen)](http://45.149.156.216:3001)
[![技术栈](https://img.shields.io/badge/技术栈-React+FastAPI-blue)](#-技术架构)
[![版权](https://img.shields.io/badge/版权-Zylen%20Copyright-orange)](#-版权)

---

## 🌟 项目简介

USTS Research Dashboard 是一个为科研团队打造的现代化项目管理平台，集成了AI智能分析、协作管理、文献处理等核心功能。系统采用微服务架构，提供高性能的并发处理能力和直观的用户体验。

### ✨ 核心特色

- 🤖 **AI智能分析** - 集成多种AI模型，支持Excel文献批量处理和智能建议生成
- 📊 **项目看板** - 直观的研究项目管理界面，支持进度跟踪和日志记录
- 👥 **协作管理** - 完整的合作者信息管理，支持批量导入和数据验证
- 💡 **Idea管理** - 从想法到项目的完整转化流程，支持成熟度评估
- 📄 **智能模板** - 可自定义的Prompt模板系统，提升AI交互效率
- 🔄 **实时同步** - 基于React Query的数据同步机制，确保界面实时更新

---

## 🚀 核心功能

### 📋 研究项目管理
- **项目看板**：可视化项目状态，支持拖拽排序和分类管理
- **进度跟踪**：实时更新项目进展，支持里程碑设置
- **日志记录**：详细的项目活动记录，支持富文本编辑
- **数据统计**：项目完成率、时间分析等数据可视化

### 👥 合作者管理
- **信息管理**：完整的合作者档案，包括联系方式、专业领域等
- **批量操作**：支持Excel文件批量导入，自动数据验证
- **关系网络**：可视化展示合作关系和项目参与情况
- **智能搜索**：多维度搜索和筛选功能

### 💡 Idea面板
- **想法收集**：结构化记录研究想法和创新概念
- **成熟度评估**：系统化评估想法的可行性和发展潜力
- **项目转化**：一键将成熟想法转化为正式研究项目
- **序号管理**：清晰的列表序号，便于追踪和引用

### 🤖 AI智能处理
- **多模型支持**：
  - Claude系列 (3.7 Sonnet, Sonnet 4, Opus 4)
  - GPT系列 (GPT-4, GPT-4o, GPT-4.1)
  - DeepSeek系列 (V3, R1)
  - 自定义API兼容

- **Excel文献分析**：
  - 批量处理学术文献摘要和标题
  - 智能生成研究迁移建议
  - 并发处理配置（0-50个并发）
  - 中文文件名完美支持

- **Prompt模板系统**：
  - 可视化模板管理界面
  - 支持模板创建、编辑、删除
  - 实时模板选择和预览
  - 模板复用和分享机制

### 📄 数据管理
- **自动备份**：系统自动创建数据备份，支持一键恢复
- **数据迁移**：版本化的数据库迁移机制
- **导入导出**：支持多种格式的数据导入导出

---

## 🔧 技术架构

### 前端技术栈
```typescript
├── React 18 + TypeScript        # 现代化前端框架
├── Ant Design 5.x              # 企业级UI组件库
├── React Query (TanStack)       # 数据状态管理和缓存
├── React Router v6              # 路由管理
├── Axios                        # HTTP请求库
└── 响应式设计                    # 移动端适配
```

### 后端技术栈
```python
├── FastAPI                      # 现代Python Web框架
├── SQLAlchemy 2.x              # ORM数据库操作
├── Pydantic v2                 # 数据验证和序列化
├── AsyncIO                     # 异步编程支持
├── HTTPX                       # 异步HTTP客户端
└── SQLite                      # 轻量级数据库
```

### AI集成架构
```yaml
AI配置管理:
  - 文件配置存储: 简化的配置管理机制
  - 内存缓存: 高性能配置访问
  - HTTP客户端复用: 优化网络性能
  - 并发控制: 智能信号量管理

API兼容性:
  - OpenAI标准: 兼容GPT系列模型
  - Anthropic: 原生Claude支持
  - 自定义端点: 灵活的API配置
```

### 部署架构
```bash
生产环境:
├── Nginx          # 反向代理和静态文件服务
├── Systemd        # 服务进程管理
├── 自动化部署      # GitHub Actions + 部署脚本
└── 监控日志        # 系统状态监控
```

---

## 🎨 界面设计

### 响应式布局
- **三栏设计**：左侧导航、主内容区、功能面板
- **移动端适配**：抽屉式导航，触摸友好的交互
- **主题系统**：统一的设计语言和颜色方案
- **版权标识**：右下角Zylen Copyright标识

### 用户体验
- **实时反馈**：操作状态实时显示，loading和错误处理
- **智能提示**：丰富的Tooltip和帮助信息
- **快捷操作**：批量操作、快捷键支持
- **数据可视化**：图表展示和统计分析

---

## 🌐 生产环境

### 🔗 访问地址
- **主站**: http://45.149.156.216:3001
- **API文档**: http://45.149.156.216:8080/docs
- **OpenAPI**: http://45.149.156.216:8080/openapi.json

### 🚀 部署方式

#### 智能部署脚本
```bash
# 自动检测修改类型并部署
./deploy-scripts/deploy.sh

# 特定部署选项
./deploy-scripts/deploy.sh --frontend   # 仅前端
./deploy-scripts/deploy.sh --backend    # 仅后端
./deploy-scripts/deploy.sh --dry-run    # 预览模式

# VPS服务器部署（用于远程部署）
./deploy-scripts/vps-update.sh          # 拉取代码并更新服务器
```

#### 部署特性
- 🔍 **智能检测**：自动识别前端/后端修改
- 📝 **规范提交**：生成语义化提交信息
- ⚡ **性能优化**：按需构建，节省时间
- 🔄 **自动回滚**：部署失败时的快速恢复

### 系统要求
- **OS**: Ubuntu 20.04+ / CentOS 8+
- **Python**: 3.8+ (推荐 3.9+)
- **Node.js**: 16+ (推荐 18 LTS)
- **内存**: 最小2GB，推荐4GB+
- **存储**: 最小10GB，推荐50GB+

---

## 📖 API接口

### 🔐 认证系统
```http
POST /api/auth/login        # 用户登录
GET  /api/auth/me          # 获取用户信息
```

### 📋 项目管理
```http
GET    /api/research/                    # 项目列表
POST   /api/research/                    # 创建项目
PUT    /api/research/{id}               # 更新项目
DELETE /api/research/{id}               # 删除项目
GET    /api/research/{id}/logs          # 项目日志
```

### 👥 合作者管理
```http
GET  /api/collaborators/              # 合作者列表
POST /api/collaborators/              # 创建合作者
POST /api/collaborators/upload       # Excel批量上传
```

### 💡 Idea管理
```http
GET  /api/ideas/                           # Idea列表
POST /api/ideas/                           # 创建Idea
POST /api/ideas/{id}/convert-to-project   # 转换为项目
```

### 🤖 AI处理
```http
POST /api/idea-discovery/process-excel    # Excel文件AI处理
GET  /api/settings/ai/config              # AI配置管理
POST /api/settings/ai/test                # 连接测试
```

### 📄 Prompt管理
```http
GET    /api/prompts/        # Prompt列表
POST   /api/prompts/        # 创建Prompt
PUT    /api/prompts/{id}    # 更新Prompt
DELETE /api/prompts/{id}    # 删除Prompt
```

### API特性
- **认证**: JWT Bearer Token，7天有效期
- **响应格式**: 统一JSON格式 `{success, data, message}`
- **错误处理**: 详细错误码和描述
- **性能**: <2秒响应，支持50个并发

---

## 🛠️ 开发指南

### 本地开发环境

#### 后端启动
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
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
# 数据库迁移
cd backend && python migrations/migration.py

# 备份数据
./deployment/backup-restore.sh backup

# 恢复数据
./deployment/backup-restore.sh restore
```

### 代码质量
- **前端**: TypeScript严格模式，ESLint规范
- **后端**: PEP 8规范，类型注解完整
- **测试**: 单元测试和集成测试
- **性能**: React Query缓存优化

---

## 🆕 版本更新

### 最新版本 (v2.0.0 - 2025-07-27)

#### 🎯 核心功能升级
- ✅ **Idea面板重命名**：更简洁的名称和用户体验
- ✅ **序号列表**：Idea列表增加序号显示
- ✅ **Prompt同步优化**：修复模板选择实时更新问题
- ✅ **版权标识**：添加Zylen Copyright水印

#### 🤖 AI功能增强
- ✅ **配置管理重构**：简化的文件配置机制
- ✅ **并发处理优化**：支持0-50个并发请求配置
- ✅ **模型支持扩展**：新增多个AI模型选择
- ✅ **中文文件名支持**：完美支持中文Excel文件

#### 🔧 技术架构优化
- ✅ **React Query集成**：统一的数据状态管理
- ✅ **HTTP客户端复用**：提升网络性能
- ✅ **错误处理增强**：更友好的错误提示
- ✅ **响应式设计**：移动端适配优化

#### 📊 性能提升
- ⚡ **5倍并发能力**：AI处理性能大幅提升
- ⚡ **实时数据同步**：组件间数据自动更新
- ⚡ **智能缓存**：减少不必要的网络请求
- ⚡ **构建优化**：前端打包体积优化

---

## 🔮 未来规划

### 短期目标 (Q2 2025)
- [ ] 数据可视化仪表板
- [ ] 高级搜索和过滤功能
- [ ] 批量操作功能增强
- [ ] 导出报告功能 (PDF/Excel)

### 中期目标 (Q3-Q4 2025)
- [ ] 多语言支持 (English/中文)
- [ ] 实时协作功能
- [ ] 移动端PWA应用
- [ ] 第三方集成 (Google Scholar, PubMed)

### 长期愿景 (2026+)
- [ ] 微服务架构升级
- [ ] 容器化部署 (Docker/K8s)
- [ ] 云原生支持
- [ ] AI助手深度集成

---

## 🤝 参与贡献

### 贡献流程
1. **Fork** 项目到个人仓库
2. **创建** 功能分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 代码变更 (`git commit -m 'Add AmazingFeature'`)
4. **推送** 到分支 (`git push origin feature/AmazingFeature`)
5. **创建** Pull Request

### 开发规范
- **代码风格**: 遵循项目现有规范
- **提交信息**: 使用语义化提交 (feat/fix/docs)
- **测试覆盖**: 新功能需包含测试用例
- **文档更新**: 重要变更需更新文档

### 质量标准
```typescript
{
  "代码质量": "⭐⭐⭐⭐⭐",
  "可维护性": "⭐⭐⭐⭐⭐", 
  "性能表现": "⭐⭐⭐⭐⭐",
  "用户体验": "⭐⭐⭐⭐⭐",
  "API响应": "<2秒",
  "并发支持": "50个请求"
}
```

---

## 🐛 故障排除

### 常见问题

#### 1. 端口占用
```bash
# 查看端口使用
lsof -i :3001
lsof -i :8080

# 终止进程
kill -9 <PID>
```

#### 2. AI配置问题
- 检查API密钥是否正确
- 确认网络连接稳定
- 查看并发数配置是否合理
- 验证模型选择是否支持

#### 3. Prompt同步问题
- 刷新页面重新加载
- 检查网络连接状态
- 清除浏览器缓存

#### 4. Excel处理失败
- 确认文件包含"摘要"和"标题"列
- 检查AI配置是否正确
- 查看文件大小是否过大

#### 5. 部署问题
```bash
# 查看服务状态
systemctl status research-backend

# 查看日志
journalctl -u research-backend -f

# 重启服务
sudo systemctl restart research-backend
```

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 团队信息

- **维护者**: USTS Research Team
- **架构师**: Full-Stack Development Team
- **技术支持**: [GitHub Issues](https://github.com/zylen97/research-dashboard/issues)

## 🙏 致谢

感谢所有贡献者、测试用户和开源社区的支持！

---

## 📞 联系我们

- 📧 **问题反馈**: [GitHub Issues](https://github.com/zylen97/research-dashboard/issues)
- 💬 **功能建议**: 通过Issues提交功能请求
- 📖 **使用帮助**: 查看在线文档或联系维护团队

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个星标！**

*由 ❤️ 和 ☕ 驱动，为科研效率而生*

**© 2025 Zylen Copyright - All Rights Reserved**

</div>