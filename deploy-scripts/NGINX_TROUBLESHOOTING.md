# 🔧 Nginx 问题诊断速查表

针对 Research Dashboard 项目的nginx配置问题快速诊断和解决方案。

## 🚨 常见问题快速解决

### 问题1: 502 Bad Gateway 错误
**现象**: 访问 `http://45.149.156.216:3001/api/ideas-management` 返回502错误

**快速诊断**:
```bash
./deploy-scripts/diagnose-nginx-config.sh --quick
```

**可能原因**:
- ❌ 后端服务(端口8080)未运行
- ❌ nginx配置错误
- ❌ 防火墙阻塞

**解决方案**:
```bash
# 1. 检查后端服务
sudo systemctl status research-backend
sudo systemctl restart research-backend

# 2. 检查nginx配置
sudo nginx -t
sudo systemctl reload nginx

# 3. 自动修复
./deploy-scripts/diagnose-nginx-config.sh --fix
```

---

### 问题2: 重定向丢失端口号
**现象**: `http://45.149.156.216:3001/api/ideas-management` → `http://45.149.156.216/api/ideas-management/`

**快速诊断**:
```bash
./deploy-scripts/diagnose-nginx-config.sh --logs-only
```

**可能原因**:
- ❌ nginx location配置有trailing slash问题
- ❌ proxy_pass配置不当
- ❌ server_name配置缺少端口信息

**解决方案**:
```bash
# 检查并修复nginx配置
sudo nano /etc/nginx/sites-enabled/research-dashboard-3001

# 确保配置如下:
location /api/ {
    proxy_pass http://localhost:8080/;
    proxy_set_header Host $host:$server_port;
    # 其他配置...
}

# 重载配置
sudo nginx -t && sudo systemctl reload nginx
```

---

### 问题3: 服务启动失败
**现象**: 后端服务无法启动或频繁重启

**快速诊断**:
```bash
journalctl -u research-backend -f
```

**可能原因**:
- ❌ Python环境问题
- ❌ 数据库连接失败
- ❌ 端口被占用

**解决方案**:
```bash
# 检查端口占用
netstat -tuln | grep :8080

# 检查服务日志
journalctl -u research-backend -n 50

# 重启服务
sudo systemctl restart research-backend
```

---

## 🔍 诊断脚本使用指南

### 完整诊断（推荐）
```bash
./deploy-scripts/diagnose-nginx-config.sh
```
- ✅ 检查所有组件状态
- ✅ 分析配置文件
- ✅ 测试连接
- ✅ 提供修复建议

### 快速检查
```bash
./deploy-scripts/diagnose-nginx-config.sh --quick
```
- ⚡ 跳过外部连接测试
- ⚡ 适合服务器内部排查

### 自动修复
```bash
./deploy-scripts/diagnose-nginx-config.sh --fix
```
- 🔧 自动重启相关服务
- 🔧 修复常见配置问题
- 🔧 重新测试连接

### 仅查看日志
```bash
./deploy-scripts/diagnose-nginx-config.sh --logs-only
```
- 📋 显示nginx错误日志
- 📋 显示访问日志
- 📋 筛选相关错误信息

---

## 📋 问题分类矩阵

| 症状 | 可能原因 | 诊断命令 | 修复方案 |
|------|---------|----------|----------|
| 502错误 | 后端服务未运行 | `--quick` | 重启research-backend |
| 重定向问题 | nginx配置错误 | `--logs-only` | 修改location配置 |
| 连接超时 | 防火墙阻塞 | 完整诊断 | 开放端口3001 |
| 服务异常 | Python环境问题 | `journalctl` | 检查依赖和环境 |

---

## 🛠️ 手动修复步骤

### 步骤1: 验证服务状态
```bash
# 检查nginx
sudo systemctl status nginx

# 检查后端服务
sudo systemctl status research-backend

# 检查端口监听
netstat -tuln | grep -E ':(3001|8080) '
```

### 步骤2: 检查配置文件
```bash
# 测试nginx配置语法
sudo nginx -t

# 查看当前配置
sudo cat /etc/nginx/sites-enabled/research-dashboard-3001
```

### 步骤3: 测试连接
```bash
# 测试本地后端
curl -I http://localhost:8080/api/

# 测试nginx代理
curl -I http://localhost:3001/api/ideas-management

# 测试外部访问
curl -I http://45.149.156.216:3001/api/ideas-management
```

### 步骤4: 重启服务
```bash
# 重启后端
sudo systemctl restart research-backend

# 重载nginx
sudo systemctl reload nginx

# 验证状态
sudo systemctl status nginx research-backend
```

---

## 🚀 预防性维护

### 每日检查
```bash
# 运行健康检查
./deploy-scripts/diagnose-nginx-config.sh --quick

# 检查日志
tail -f /var/log/nginx/error.log
```

### 每周维护
```bash
# 完整诊断
./deploy-scripts/diagnose-nginx-config.sh

# 清理日志（如果过大）
sudo logrotate /etc/logrotate.d/nginx
```

---

## 📞 紧急情况处理

### 如果网站完全无法访问
```bash
# 1. 立即检查服务状态
sudo systemctl status nginx research-backend

# 2. 查看最近的错误
journalctl -xe

# 3. 重启所有服务
sudo systemctl restart nginx research-backend

# 4. 运行诊断
./deploy-scripts/diagnose-nginx-config.sh --fix
```

### 如果自动修复失败
```bash
# 1. 备份当前配置
sudo cp /etc/nginx/sites-enabled/research-dashboard-3001 /tmp/nginx-backup

# 2. 使用项目中的标准配置
sudo cp deployment/nginx-3001.conf /etc/nginx/sites-available/research-dashboard-3001

# 3. 测试并重载
sudo nginx -t && sudo systemctl reload nginx
```

---

## 📧 获取帮助

如果问题仍然存在，收集以下信息：
1. 诊断脚本的完整输出
2. nginx错误日志最近50行
3. 后端服务状态和日志
4. 系统基本信息（内存、磁盘、网络）

使用以下命令收集信息：
```bash
./deploy-scripts/diagnose-nginx-config.sh > diagnosis-report.txt 2>&1
```