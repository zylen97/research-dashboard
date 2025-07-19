# Research Dashboard 快速启动指南

## 🎯 超快启动 (3步搞定)

```bash
# 1. 安装依赖
./setup.sh

# 2. 启动服务
./run.sh

# 3. 访问 http://localhost:3001
```

## 📋 启动方式对比

| 脚本 | 运行方式 | 适用场景 | 特点 |
|------|----------|----------|------|
| `./run.sh` | 前台运行 | 开发测试 | ✅ 简单快速<br>✅ 实时日志<br>❌ 关闭终端即停止 |
| `./start.sh` | 后台运行 | 生产使用 | ✅ 后台运行<br>✅ 进程管理<br>✅ 日志文件<br>✅ 自动重启 |

## 🔧 脚本详解

### setup.sh - 环境安装
```bash
./setup.sh
```
- 检查 Python3、Node.js、pip、npm
- 安装后端 Python 依赖
- 安装前端 Node.js 依赖
- 设置脚本执行权限

### run.sh - 快速启动 (推荐新手)
```bash
./run.sh
```
- 停止现有服务
- 启动后端 (8080端口)
- 启动前端 (3001端口) 
- 按回车键停止

### start.sh - 生产启动
```bash
./start.sh
```
- 检查依赖和端口
- 后台启动所有服务
- 生成PID文件和日志
- 自动打开浏览器

### stop.sh - 停止服务
```bash
./stop.sh
```
- 优雅停止所有服务
- 清理PID文件
- 强制清理端口占用

## 📂 文件结构

```
research-dashboard/
├── setup.sh         # 📦 环境安装脚本
├── run.sh           # 🚀 快速启动脚本 
├── start.sh         # ⚡ 生产启动脚本
├── stop.sh          # 🛑 停止服务脚本
├── logs/            # 📋 日志文件目录
├── pids/            # 🔍 进程ID文件目录
├── backend/         # 🔧 FastAPI后端
├── frontend/        # 🎨 React前端
└── README.md        # 📖 完整说明文档
```

## 🌐 访问地址

- **主界面**: http://localhost:3001
- **后端API**: http://localhost:8080  
- **API文档**: http://localhost:8080/docs

## 🐛 常见问题

### 端口被占用
```bash
# 查看端口占用
lsof -i :8080
lsof -i :3001

# 强制停止
./stop.sh
```

### 依赖安装失败
```bash
# 重新安装
./setup.sh

# 手动安装Python依赖
cd backend && pip install -r requirements.txt

# 手动安装Node依赖  
cd frontend && npm install
```

### 服务启动失败
```bash
# 查看日志
tail -f logs/backend.log
tail -f logs/frontend.log

# 重新启动
./stop.sh && ./start.sh
```

## 💡 使用建议

1. **首次使用**: 先运行 `./setup.sh` 安装依赖
2. **开发调试**: 使用 `./run.sh` 可以看到实时日志
3. **长期运行**: 使用 `./start.sh` 后台运行更稳定
4. **关闭服务**: 记得运行 `./stop.sh` 优雅停止

Happy coding! 🎉