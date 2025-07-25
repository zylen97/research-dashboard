# Deployment Configuration Guide

## Nginx 配置说明

### 当前配置文件：

1. **nginx.conf** - 默认80端口配置
   - 用于：标准HTTP访问 (http://45.149.156.216)
   - 状态：备用配置

2. **nginx-3001.conf** - 3001端口配置 ⭐ **推荐使用**
   - 用于：当前生产环境 (http://45.149.156.216:3001)
   - 状态：**正在使用中**

### 部署步骤：

```bash
# 使用3001端口配置（推荐）
sudo cp nginx-3001.conf /etc/nginx/sites-available/research-dashboard-3001
sudo ln -sf /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 快速切换端口：

**切换到80端口：**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/research-dashboard
sudo ln -sf /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**切换到3001端口（默认）：**
```bash
sudo cp nginx-3001.conf /etc/nginx/sites-available/research-dashboard-3001  
sudo ln -sf /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 系统服务配置

### Backend Service
- 配置文件：`research-backend.service`
- 当前Worker数：2个
- 运行端口：8080

### 服务管理命令：
```bash
# 查看服务状态
sudo systemctl status research-backend

# 重启服务
sudo systemctl restart research-backend

# 查看日志
sudo journalctl -u research-backend -f
```