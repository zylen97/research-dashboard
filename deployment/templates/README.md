# 多端口Web应用部署模板

这些模板文件帮助您在同一VPS上部署多个Web应用到不同端口。

## 文件说明

### 1. `nginx-template.conf`
Nginx配置模板，用于快速创建新应用的反向代理配置。

**支持的变量：**
- `{{PORT}}` - Web应用监听端口
- `{{SERVER_IP}}` - 服务器IP地址  
- `{{WEB_ROOT}}` - 前端文件根目录
- `{{API_PATH}}` - API路径前缀
- `{{BACKEND_PORT}}` - 后端服务端口

### 2. `deploy-new-app.sh`
新应用部署脚本模板，自动化部署流程。

**需要配置的变量：**
- `{{APP_NAME}}` - 应用名称
- `{{APP_PORT}}` - 前端端口
- `{{BACKEND_PORT}}` - 后端端口
- `{{REPO_URL}}` - Git仓库地址
- `{{BUILD_COMMAND}}` - 构建命令
- `{{BUILD_OUTPUT}}` - 构建输出目录

## 使用方法

### 快速部署新应用

1. **复制并配置部署脚本**
   ```bash
   cp deploy-new-app.sh deploy-my-blog.sh
   ```

2. **编辑配置变量**
   ```bash
   # 示例配置
   APP_NAME="my-blog"
   APP_PORT="3002"
   BACKEND_PORT="8081"
   REPO_URL="https://github.com/username/my-blog.git"
   BUILD_COMMAND="npm install && npm run build"
   BUILD_OUTPUT="build"
   ```

3. **运行部署脚本**
   ```bash
   sudo bash deploy-my-blog.sh
   ```

### 手动配置Nginx

1. **复制配置模板**
   ```bash
   cp nginx-template.conf nginx-3002.conf
   ```

2. **替换变量**
   ```bash
   sed -i 's/{{PORT}}/3002/g' nginx-3002.conf
   sed -i 's/{{SERVER_IP}}/45.149.156.216/g' nginx-3002.conf
   sed -i 's|{{WEB_ROOT}}|/var/www/my-blog|g' nginx-3002.conf
   sed -i 's|{{API_PATH}}|/api|g' nginx-3002.conf
   sed -i 's/{{BACKEND_PORT}}/8081/g' nginx-3002.conf
   ```

3. **部署配置**
   ```bash
   sudo cp nginx-3002.conf /etc/nginx/sites-available/my-blog-3002
   sudo ln -s /etc/nginx/sites-available/my-blog-3002 /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

## 端口分配建议

| 端口 | 用途 | 示例应用 |
|------|------|----------|
| 3001 | Research Dashboard | 当前项目 |
| 3002 | 个人博客 | Hugo/Hexo博客 |
| 3003 | 项目展示 | Portfolio网站 |
| 3004 | 工具集合 | 在线工具站 |
| 3005 | 实验项目 | 测试应用 |

## 防火墙配置

确保在部署新应用前开放相应端口：

```bash
sudo ufw allow 3002
sudo ufw allow 3003
# ... 更多端口
```

或者运行防火墙配置脚本：
```bash
sudo bash ../setup-firewall.sh
```

## 故障排除

### 检查端口占用
```bash
sudo netstat -tlnp | grep :3002
```

### 检查Nginx配置
```bash
sudo nginx -t
sudo systemctl status nginx
```

### 查看应用日志
```bash
sudo tail -f /var/log/nginx/error.log
sudo journalctl -u nginx -f
```

### 测试端口连通性
```bash
curl http://localhost:3002
curl http://45.149.156.216:3002
```

## 注意事项

1. **端口范围**：建议使用3001-3010范围内的端口
2. **后端端口**：后端API使用8080-8090范围，不对外开放
3. **域名配置**：如有域名，可以配置子域名指向不同端口
4. **SSL证书**：生产环境建议配置HTTPS
5. **备份**：部署前备份重要数据和配置文件

## 相关文件

- `../nginx-3001.conf` - Research Dashboard的Nginx配置
- `../setup-firewall.sh` - 防火墙配置脚本
- `../../.github/workflows/deploy.yml` - CI/CD部署脚本