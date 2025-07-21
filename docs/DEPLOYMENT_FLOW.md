# 部署流程（优化后）

## 🎯 三个组件的明确分工

### 1. deploy-scripts/deploy.sh - 智能部署工具
**职责**：智能检测修改并自动选择部署策略
```bash
./deploy-scripts/deploy.sh              # 智能检测并部署（推荐）
./deploy-scripts/deploy.sh --frontend   # 强制构建前端
./deploy-scripts/deploy.sh --backend    # 仅推送，不构建
./deploy-scripts/deploy.sh --all        # 构建并推送所有
./deploy-scripts/deploy.sh --dry-run    # 预览模式
./deploy-scripts/deploy.sh build        # 仅构建（兼容旧版）

# 智能功能：
# - 自动检测前端/后端/文档修改
# - 前端修改时才构建（节省时间）
# - 自动生成规范的提交信息
# - 支持预览模式查看将执行的操作
```

### 2. GitHub Actions - 自动化调度员
**职责**：监听代码推送，远程执行部署
```yaml
触发条件: git push 到 main 分支
执行操作:
  1. SSH 连接到 VPS
  2. 运行 deploy-scripts/vps-update.sh
```

### 3. deploy-scripts/vps-update.sh - VPS部署执行者
**职责**：在VPS上执行实际部署
```bash
./deploy-scripts/vps-update.sh
# 做什么：
# - git pull 最新代码
# - 解压并部署前端
# - 配置并重启后端
```

## 🔄 优化后的流程

```
你的操作              自动化流程              VPS上发生的事
    |                     |                      |
    v                     v                      v
1. 修改代码                                        
2. ./deploy-scripts/deploy.sh          
   - 检测修改类型     →  智能决策：        
   - 前端修改？          - 是 → 构建打包
   - 后端修改？          - 否 → 跳过构建
   - 生成提交信息     →  提交 + 推送  →  GitHub Actions 触发
                                            →  SSH 到 VPS
                                            →  运行 deploy-scripts/vps-update.sh
                                                 - git pull
                                                 - 解压 tar.gz（如果有）
                                                 - 部署文件
                                                 - 重启服务（如果需要）
                                            →  ✅ 部署完成！
```

## ✅ 修复的问题

1. **删除了重复的 git pull**
   - 之前：GitHub Actions 和 deploy-scripts/vps-update.sh 都执行
   - 现在：只在 deploy-scripts/vps-update.sh 中执行

2. **修正了错误提示**
   - 之前：build.sh 提示手动运行 deploy-scripts/vps-update.sh
   - 现在：正确提示会自动部署

3. **保留了灵活性**
   - deploy-scripts/vps-update.sh 保留 git pull
   - 原因：支持手动运行场景

## 📝 使用指南

### 日常部署（推荐）
```bash
# 智能部署 - 自动检测并执行
./deploy-scripts/deploy.sh

# 预览将要执行的操作
./deploy-scripts/deploy.sh --dry-run

# 等待自动部署完成（1-2分钟）
```

### 特殊场景
```bash
# 只想构建不部署
./deploy-scripts/deploy.sh build

# 强制构建前端（即使没有前端修改）
./deploy-scripts/deploy.sh --frontend

# 只推送后端（跳过前端构建）
./deploy-scripts/deploy.sh --backend

# 手动控制提交信息
./deploy-scripts/deploy.sh build
git add -A
git commit -m "feat: 自定义的详细提交说明"
git push
```

### 手动部署（特殊情况）
```bash
# SSH 到 VPS
ssh root@45.149.156.216

# 手动运行更新
cd /var/www/research-dashboard
./deploy-scripts/vps-update.sh
```

## 🎯 记住

- **deploy-scripts/deploy.sh** = 一键完成所有
- **deploy-scripts/deploy.sh build** = 只构建不部署
- **自动完成** = 不用手动操作VPS