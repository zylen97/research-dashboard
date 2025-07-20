# 🌐 研究看板 - 网络访问指南

让您的团队成员通过广域网访问研究看板

## 🚀 快速开始

### 方法一：一键启动（推荐）
```bash
./start-with-network.sh
```
- 自动检测环境并配置最佳访问方式
- 支持本地开发和网络访问
- 如果安装了ngrok，自动配置网络穿透

### 方法二：手动ngrok配置
```bash
# 1. 安装ngrok
brew install ngrok/ngrok/ngrok

# 2. 注册并配置token
ngrok config add-authtoken YOUR_TOKEN

# 3. 启动服务
./setup-network.sh
```

## 📋 三种访问方案对比

| 方案 | 成本 | 设置难度 | 稳定性 | 适用场景 |
|------|------|----------|--------|----------|
| ngrok免费版 | 免费 | ⭐⭐ | ⭐⭐ | 临时测试 |
| 云部署 | $0-5/月 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 长期使用 |
| VPS自建 | $2.5+/月 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 完全控制 |

## 🎯 推荐使用流程

### 第一次使用（测试）
```bash
# 1. 快速测试
./start-with-network.sh

# 2. 选择"网络访问"模式
# 3. 获得访问地址，分享给团队成员
# 4. 确认功能正常
```

### 长期使用（生产）
参考 `quick-network-setup.md` 进行云部署

## 🔧 环境配置

### 前端环境变量
复制 `frontend/.env.example` 为 `frontend/.env.local`：
```bash
# 本地开发
REACT_APP_API_URL=http://localhost:8080

# ngrok网络访问
REACT_APP_API_URL=https://abc123.ngrok.io

# 云部署
REACT_APP_API_URL=https://your-backend.railway.app
```

### 自动检测逻辑
系统按以下优先级选择API地址：
1. 环境变量 `REACT_APP_API_URL`
2. 开发环境：`http://localhost:8080`
3. 生产环境：相对路径 `/api`

## 📱 移动端访问

所有方案都支持移动端：
- 响应式界面设计
- 触摸优化交互
- 移动端导航菜单

团队成员用手机访问同一地址即可。

## 🔒 安全说明

### 数据安全
- JWT认证保护所有API
- 团队数据完全隔离
- HTTPS加密传输（ngrok/云部署）

### 访问控制
- 邀请码机制控制团队成员
- 无公开注册，只能通过邀请加入
- 支持团队管理员和普通成员角色

## 🆘 故障排除

### 常见问题

**Q: ngrok地址无法访问？**
```bash
# 检查ngrok状态
curl http://localhost:4040/api/tunnels

# 重启ngrok
pkill ngrok
./start-with-network.sh
```

**Q: 前端无法连接后端？**
- 检查 `frontend/.env.local` 配置
- 确认后端地址正确
- 查看浏览器控制台错误

**Q: 团队成员注册失败？**
- 确认邀请码正确（12位大写字母数字）
- 检查网络连接
- 查看后端日志

### 日志查看
```bash
# 查看服务状态
cat network-info.txt

# 查看后端日志
tail -f backend/server.log

# 查看ngrok日志
tail -f ngrok.log
```

## 📞 技术支持

### 调试信息收集
遇到问题时，请提供：
1. 操作系统和版本
2. `network-info.txt` 内容
3. 浏览器控制台错误
4. 后端日志相关部分

### 进阶配置
- 自定义域名配置
- SSL证书设置
- 负载均衡配置
- 数据库优化

详细配置请参考 `quick-network-setup.md`

---

**总结**：先用 `./start-with-network.sh` 快速测试，确认可用后考虑云部署方案。