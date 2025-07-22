# 项目部署和开发规范

## 核心部署流程
1. **目标环境**：本项目的最终运行环境是VPS服务器(45.149.156.216:3001)
   - 本地开发只是代码编写阶段，真正的功能实现在VPS上
   - 所有代码修改都需要考虑VPS部署后的实际运行效果
   - 通过GitHub Actions自动化部署到VPS

2. **核心部署脚本**：deploy-scripts/目录下的脚本是部署系统的核心，禁止删除！
   - `deploy.sh` - 本地智能部署脚本（检测修改类型，构建前端，推送代码）
   - `vps-update.sh` - VPS服务器更新脚本（拉取代码，部署前端，重启后端）
   - 这两个脚本协同工作，实现完整的自动化部署流程

3. **部署操作规范**：所有代码修改必须通过./deploy.sh提交，禁止直接使用git命令！
   - ✅ 正确：`./deploy.sh` (自动检测修改类型，智能部署)
   - ❌ 错误：`git add . && git commit && git push` (绕过部署检测)
   - 部署脚本会自动构建前端、生成规范提交信息、触发VPS更新

4. **开发工作流**：本地开发 → 测试验证 → ./deploy.sh → VPS自动部署
   - 前端修改：本地开发 → npm run build → ./deploy.sh → VPS部署静态文件
   - 后端修改：本地开发 → 测试API → ./deploy.sh → VPS重启服务
   - 数据库修改：更新migration.py → ./deploy.sh → VPS执行迁移

## 数据库迁移系统规范
5. **统一迁移文件**：使用单一migration.py文件，禁止创建多个迁移脚本！
   - 路径：`backend/migrations/migration.py`
   - 架构原理：覆盖式迁移管理，而非累积式文件堆叠
   - 核心优势：保持migrations目录整洁，只维护一个迁移文件

6. **迁移操作流程**：修改数据库时更新migration.py内容，系统自动处理执行
   - 更新版本号：`MIGRATION_VERSION = "v1.x_description"`
   - 添加SQL操作：在`run_migration()`函数中编写数据库修改代码
   - 自动跟踪：系统创建migration_history表记录执行历史
   - 防重复执行：相同版本号的迁移只会执行一次

7. **迁移工作流**：编辑migration.py → ./deploy.sh → VPS自动执行迁移
   - ✅ 正确：修改migration.py版本号和SQL → 部署
   - ❌ 错误：创建新的迁移文件 add_xxx.py
   - 部署时vps-update.sh会自动调用migration.py进行数据库更新