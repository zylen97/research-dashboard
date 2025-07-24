# 🚨 502错误完整排查指南

## 立即行动步骤

### 🔥 紧急修复（5分钟内解决）

1. **SSH到VPS并上传脚本**
   ```bash
   # 本地执行：上传诊断脚本到VPS
   scp deploy-scripts/quick-diagnose-502.sh root@45.149.156.216:/var/www/research-dashboard/
   scp emergency-fix-502.sh root@45.149.156.216:/var/www/research-dashboard/
   
   # SSH到VPS
   ssh root@45.149.156.216
   cd /var/www/research-dashboard
   ```

2. **快速诊断**
   ```bash
   chmod +x quick-diagnose-502.sh
   ./quick-diagnose-502.sh
   ```

3. **根据诊断结果选择修复方案**
   - 如果显示"系统正常"：检查防火墙和DNS
   - 如果显示"backend异常"：重启backend服务
   - 如果显示"全部异常"：执行完整修复

4. **执行完整修复**
   ```bash
   chmod +x emergency-fix-502.sh
   ./emergency-fix-502.sh
   ```

---

## 系统架构流程

```
用户请求 → nginx(3001) → backend(8080) → database → response
             ↓失败         ↓失败           ↓失败
           502错误      502错误       API异常
```

### 502错误的5种原因

1. **Backend服务未启动** (80%的情况)
2. **数据库Migration失败** (15%的情况)  
3. **Nginx配置错误** (3%的情况)
4. **端口被占用** (1%的情况)
5. **系统资源不足** (1%的情况)

---

## 详细排查流程

### Phase 1: 服务状态检查 (2分钟)

```bash
# 1. 检查服务运行状态
systemctl status research-backend
systemctl status nginx

# 2. 检查端口监听
ss -tlnp | grep :8080  # backend端口
ss -tlnp | grep :3001  # nginx端口

# 3. 快速API测试
curl -I http://localhost:8080/api/health
curl -I http://localhost:3001/api/health
```

**预期结果**：
- ✅ 服务状态：active (running)
- ✅ 端口监听：正常显示进程PID
- ✅ API测试：HTTP/1.1 200 OK

### Phase 2: 数据库和Migration检查 (3分钟)

```bash
cd /var/www/research-dashboard/backend

# 1. 检查数据库文件
ls -la data/research_dashboard_prod.db

# 2. 检查数据库完整性
sqlite3 data/research_dashboard_prod.db "PRAGMA integrity_check;"

# 3. 检查migration状态
sqlite3 data/research_dashboard_prod.db "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 3;"

# 4. 手动执行migration（如果需要）
python3 migrations/migration.py
```

**常见问题**：
- ❌ 数据库文件不存在 → 初始化数据库
- ❌ Migration未完成 → 手动执行migration
- ❌ 字段映射错误 → v1.21版本会自动修复

### Phase 3: 应用启动检查 (2分钟)

```bash
# 1. 测试Python环境
python3 --version
python3 -c "import fastapi, uvicorn; print('依赖正常')"

# 2. 测试应用导入
cd /var/www/research-dashboard/backend
python3 -c "from main import app; print('应用导入成功')"

# 3. 查看错误日志
journalctl -u research-backend -n 20 --no-pager
```

### Phase 4: 网络和配置检查 (2分钟)

```bash
# 1. 检查nginx配置
nginx -t

# 2. 检查防火墙
ufw status

# 3. 检查系统资源
free -h
df -h
```

---

## 标准修复方案

### 🔧 方案A：服务重启 (适用于80%的情况)

```bash
# 停止服务
systemctl stop research-backend nginx

# 清理进程
pkill -f "python.*main.py"
pkill -f "uvicorn"

# 重启服务
systemctl start nginx
systemctl start research-backend

# 验证结果
sleep 5
curl -I http://localhost:3001/api/health
```

### 🔧 方案B：数据库修复 (适用于15%的情况)

```bash
cd /var/www/research-dashboard/backend

# 备份数据库
cp data/research_dashboard_prod.db data/research_dashboard_prod.db.backup.$(date +%Y%m%d_%H%M%S)

# 执行migration
python3 migrations/migration.py

# 重启backend
systemctl restart research-backend
```

### 🔧 方案C：完整重建 (适用于严重损坏情况)

```bash
# 1. 停止所有服务
systemctl stop research-backend nginx

# 2. 备份现有数据
cd /var/www/research-dashboard/backend
mkdir -p backups/emergency-$(date +%Y%m%d_%H%M%S)
cp -r data/ backups/emergency-$(date +%Y%m%d_%H%M%S)/

# 3. 重新初始化数据库
python3 -c "
import sys
sys.path.append('.')
from app.utils.db_init import init_database
init_database()
print('数据库重新初始化完成')
"

# 4. 重启服务
systemctl start nginx research-backend
```

---

## 预防措施

### 🛡️ 部署前检查

**在本地执行**：
```bash
# 运行部署前检查脚本
chmod +x deploy-scripts/pre-deploy-check.sh
./deploy-scripts/pre-deploy-check.sh
```

### 🛡️ 服务监控

**在VPS设置自动监控**：
```bash
# 上传监控脚本
scp deploy-scripts/service-monitor.sh root@45.149.156.216:/var/www/research-dashboard/

# 设置监控
chmod +x service-monitor.sh
./service-monitor.sh --daemon
```

### 🛡️ 定期维护

**每周执行**：
```bash
# 1. 数据库备份
cd /var/www/research-dashboard/backend
cp data/research_dashboard_prod.db data/research_dashboard_prod.db.weekly.$(date +%Y%m%d)

# 2. 日志清理
journalctl --vacuum-time=7d

# 3. 系统更新
apt update && apt upgrade -y
```

---

## 常见错误代码对照表

| HTTP状态码 | 含义 | 可能原因 | 修复方法 |
|----------|------|---------|---------|
| 502 | Bad Gateway | Backend服务异常 | 重启backend服务 |
| 503 | Service Unavailable | 服务暂时不可用 | 检查系统资源 |
| 504 | Gateway Timeout | 后端响应超时 | 检查数据库连接 |
| 500 | Internal Server Error | 应用内部错误 | 检查应用日志 |

---

## 紧急联系清单

### 🔧 立即可用的修复脚本

1. **quick-diagnose-502.sh** - 1分钟快速诊断
2. **emergency-fix-502.sh** - 5分钟完整修复
3. **pre-deploy-check.sh** - 部署前检查
4. **service-monitor.sh** - 服务监控

### 📋 关键命令速查

```bash
# 服务状态
systemctl status research-backend nginx

# 实时日志
journalctl -u research-backend -f

# API测试
curl -I http://localhost:3001/api/health

# 进程查看
ps aux | grep python | grep -v grep

# 端口查看
ss -tlnp | grep -E ":(3001|8080)"
```

### 🆘 当所有方法都失败时

1. **回滚到最近的备份**
2. **联系系统管理员**
3. **检查VPS提供商状态**
4. **考虑从git重新部署**

---

**记住：502错误95%都是backend服务的问题，先检查服务状态，再检查数据库，最后检查网络配置。**