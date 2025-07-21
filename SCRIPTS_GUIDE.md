# 脚本使用指南

## 🚀 核心脚本说明

### 开发环境

#### `start-dev.sh`
一键启动开发环境的脚本。
```bash
./start-dev.sh
```
功能：
- 检查环境依赖
- 设置开发环境配置
- 安装前后端依赖
- 同时启动前端(3001)和后端(8080)

#### `stop-dev.sh`
停止开发环境的脚本。
```bash
./stop-dev.sh
```
功能：
- 优雅停止前后端服务
- 清理临时文件

### 构建部署

#### `deploy.sh`
一键构建并部署的脚本。
```bash
./deploy.sh          # 构建并自动部署（推荐）
./deploy.sh build    # 仅构建，不推送
```
功能：
- 使用生产环境配置
- 构建前端代码
- 打包成 tar.gz
- 自动提交并推送（触发部署）
- 支持仅构建模式

### VPS管理

#### `vps-update.sh`
VPS自动更新脚本（GitHub Actions调用）。
```bash
# 在VPS上运行
./vps-update.sh
```
功能：
- 拉取最新代码
- 部署前端（解压tar.gz）
- 更新后端（重启服务）
- 应用生产环境配置

#### `vps-check-status.sh`
检查VPS服务状态。
```bash
# 在VPS上运行
./vps-check-status.sh
```
功能：
- 显示系统资源使用
- 检查服务运行状态
- 查看日志

### 备份管理

#### `deployment/backup-research.sh`
自动备份数据库脚本。
功能：
- 每天自动备份数据库
- 保留最近7天的备份

#### `deployment/backup-restore.sh`
手动备份和恢复脚本。
```bash
# 备份
./deployment/backup-restore.sh backup

# 恢复
./deployment/backup-restore.sh restore
```

#### `deployment/setup-backup.sh`
初始化备份系统（一次性运行）。

#### `deployment/setup-firewall.sh`
配置防火墙规则（一次性运行）。

## 🔄 典型工作流

### 日常开发
```bash
# 1. 启动开发环境
./start-dev.sh

# 2. 编写代码...

# 3. 停止服务
./stop-dev.sh
```

### 部署到生产
```bash
# 方式1：一键部署（推荐）
./deploy.sh

# 方式2：仅构建不部署
./deploy.sh build

# 方式3：手动控制
./deploy.sh build    # 先构建
git add -A           # 手动提交
git commit -m "feat: 详细的提交说明"
git push             # 手动推送
```

### VPS维护
```bash
# SSH登录VPS后

# 检查状态
./vps-check-status.sh

# 手动更新（如果需要）
./vps-update.sh

# 备份数据
./deployment/backup-restore.sh backup
```

## 📌 注意事项

1. **开发脚本**只在本地使用
2. **VPS脚本**只在服务器上使用
3. **build.sh**在本地运行，生成的文件会被推送到git
4. **备份脚本**建议定期运行，保护数据安全