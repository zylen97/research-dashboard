# SSH 紧急修复指南

## 当前问题
- SSH连接被拒绝: `Connection closed by 45.149.156.216 port 22`
- Web服务正常运行 (http://45.149.156.216:3001)
- 服务器在线但SSH服务可能已崩溃

## 可能的原因
1. SSH服务崩溃或停止
2. SSH配置文件错误
3. 防火墙规则阻止了SSH
4. fail2ban或其他安全软件阻止了连接
5. 磁盘空间满了

## 解决方案

### 方案1: 通过VPS控制面板
1. 登录VPS提供商控制面板
2. 使用VNC/Console访问服务器
3. 执行以下命令：
```bash
# 检查SSH服务状态
systemctl status sshd

# 重启SSH服务
systemctl restart sshd

# 检查防火墙
ufw status
ufw allow 22/tcp

# 检查fail2ban
fail2ban-client status sshd
fail2ban-client unban --all

# 检查磁盘空间
df -h
```

### 方案2: 通过Web Shell (如果已安装)
如果安装了web-based terminal，可以通过它访问。

### 方案3: 救援模式
1. 在VPS控制面板启动救援模式
2. 挂载系统盘
3. 修复SSH配置

### 方案4: 临时Web部署方案
由于Web服务正常，可以创建一个临时的Web端点来触发部署：

```python
# 在backend/main.py添加临时部署端点
@app.post("/emergency-deploy-endpoint-2024")
async def emergency_deploy():
    import subprocess
    try:
        result = subprocess.run(["/var/www/research-dashboard/deploy-scripts/vps-update.sh"], 
                              capture_output=True, text=True)
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

## 预防措施
1. 设置SSH备用端口
2. 配置SSH密钥认证
3. 定期备份SSH配置
4. 监控SSH服务状态
5. 设置自动重启脚本

## 紧急联系
如果以上方法都无法解决，请联系VPS提供商技术支持。