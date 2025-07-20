# 🌐 快速网络访问配置

让团队成员通过广域网访问您的研究看板

## 方案选择

### 🚀 方案一：快速测试（推荐新手）
使用ngrok免费服务，5分钟内让团队访问

### 💰 方案二：免费云部署（推荐长期使用）
部署到Vercel+Railway，永久免费访问

### 🔧 方案三：自建服务器（技术用户）
VPS部署，完全控制

---

## 🚀 方案一：ngrok快速测试

### 第1步：安装ngrok
```bash
# macOS
brew install ngrok/ngrok/ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Windows
# 下载 https://ngrok.com/download 并解压到系统路径
```

### 第2步：注册并配置
1. 访问 https://dashboard.ngrok.com/signup
2. 注册免费账号
3. 复制authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
4. 配置token:
```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### 第3步：启动服务
```bash
# 在项目根目录运行
./setup-network.sh
```

### 第4步：分享访问地址
脚本运行后会显示类似：
```
🎉 成功！您的应用现在可以通过以下地址访问：
==========================
🌐 前端地址: https://abc123.ngrok.io
🔗 后端地址: https://def456.ngrok.io
==========================

📤 分享给团队成员：
团队成员访问: https://abc123.ngrok.io
```

**把前端地址分享给团队成员即可！**

---

## 💰 方案二：免费云部署

### 成本分析
- **前端**: Vercel (100%免费)
- **后端**: Railway ($0/月 + $5信用额度)
- **数据库**: Railway PostgreSQL (免费500MB)
- **域名**: 可选，Railway提供免费子域名
- **总成本**: 第一年完全免费，之后约$5/月

### 部署步骤

#### 1. 后端部署到Railway
```bash
# 安装Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 创建项目
railway new

# 部署后端
cd backend
railway up
```

#### 2. 前端部署到Vercel
```bash
# 安装Vercel CLI
npm install -g vercel

# 部署
cd frontend
vercel --prod
```

#### 3. 配置环境变量
在Railway后端项目中设置：
```
DATABASE_URL=postgresql://...  # Railway自动提供
SECRET_KEY=your-jwt-secret-key
```

在Vercel前端项目中设置：
```
REACT_APP_API_URL=https://your-railway-backend.up.railway.app
```

---

## 🔧 方案三：自建服务器

### VPS推荐（按成本排序）
1. **Vultr**: $2.50/月起
2. **DigitalOcean**: $4/月起  
3. **Linode**: $5/月起
4. **阿里云/腾讯云**: ¥24/月起

### 快速部署脚本
```bash
# 在VPS上运行
curl -sSL https://raw.githubusercontent.com/your-repo/deploy.sh | bash
```

---

## 📱 移动端访问优化

所有方案都支持手机访问，界面已优化：
- 响应式设计
- 移动端导航
- 触摸友好的交互

---

## 🔒 安全注意事项

### ngrok方案
- ✅ 免费快速
- ⚠️ 地址8小时后变化
- ⚠️ 无自定义域名

### 云部署方案  
- ✅ 永久固定地址
- ✅ 自定义域名
- ✅ HTTPS加密
- ✅ 专业稳定

### 自建服务器
- ✅ 完全控制
- ✅ 自定义配置
- ⚠️ 需要技术维护

---

## 🆘 常见问题

### Q: ngrok地址经常变化怎么办？
A: 升级到ngrok付费版($8/月)获得固定域名，或使用云部署方案

### Q: 团队成员无法访问怎么办？
A: 检查防火墙设置，确保ngrok/云服务正常运行

### Q: 数据安全吗？
A: 所有方案都使用HTTPS加密，数据按团队隔离

### Q: 免费额度用完了怎么办？
A: Railway每月提供$5免费额度，小团队通常足够使用

---

## 📞 技术支持

如果遇到问题：
1. 查看 `logs/` 目录下的错误日志
2. 检查 `network-info.txt` 文件
3. 重启服务: `./setup-network.sh`

**推荐流程**: 先用ngrok测试 → 确认可用后部署到云端