# 🚨 紧急：SSH连接问题修复指南

## 当前状况
- **问题**: SSH在握手阶段被服务器关闭 (`kex_exchange_identification: Connection closed by remote host`)
- **Web服务**: ✅ 正常运行 (http://45.149.156.216:3001)
- **API**: ✅ 正常响应
- **SSH端口**: ✅ 22端口开放但拒绝连接

## 🔧 紧急修复步骤

### 步骤1：通过VPS控制面板访问

1. **登录VPS提供商控制面板**
2. **找到VNC/Console/终端选项**
3. **使用root账号登录**

### 步骤2：检查并修复SSH

在VNC终端中执行：

```bash
# 1. 检查SSH服务状态
systemctl status sshd

# 2. 查看SSH错误日志
journalctl -u sshd -n 100 | grep -E "(error|fail|denied|closed)"

# 3. 检查SSH配置
sshd -t

# 4. 检查fail2ban是否封禁了IP
fail2ban-client status sshd
# 解封所有IP
fail2ban-client unban --all

# 5. 重启SSH服务
systemctl restart sshd

# 6. 检查系统资源
df -h  # 磁盘空间
free -m  # 内存
```

### 步骤3：临时修复SSH配置

```bash
# 备份当前配置
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# 创建临时安全配置
cat > /etc/ssh/sshd_config.temp << 'EOF'
Port 22
PermitRootLogin yes
PubkeyAuthentication yes
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
MaxStartups 10:30:100
MaxSessions 10
EOF

# 测试配置
sshd -t -f /etc/ssh/sshd_config.temp

# 如果测试通过，应用配置
mv /etc/ssh/sshd_config.temp /etc/ssh/sshd_config
systemctl restart sshd
```

### 步骤4：手动部署代码

既然Web服务正常，执行部署：

```bash
cd /var/www/research-dashboard
git pull origin main
systemctl restart research-backend
systemctl restart nginx
```

### 步骤5：修复GitHub Actions SSH密钥

```bash
# 确保authorized_keys正确
mkdir -p /root/.ssh
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# 检查密钥
cat /root/.ssh/authorized_keys
```

## 📱 联系VPS提供商

如果以上步骤无法解决，可能需要：
1. 联系技术支持
2. 请求重置SSH服务
3. 检查是否有DDoS防护触发

## 🔄 预防措施

部署完成后，创建SSH备份访问：

```bash
# 1. 安装备用SSH（端口2222）
echo "Port 2222" >> /etc/ssh/sshd_config
systemctl restart sshd

# 2. 创建SSH自动恢复脚本
cat > /root/ssh-monitor.sh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet sshd; then
    systemctl restart sshd
    echo "SSH restarted at $(date)" >> /var/log/ssh-monitor.log
fi
EOF

chmod +x /root/ssh-monitor.sh
echo "*/5 * * * * /root/ssh-monitor.sh" | crontab -
```

## ⚡ 快速命令汇总

```bash
# 一键诊断
systemctl status sshd && fail2ban-client status && df -h && free -m

# 一键修复尝试
systemctl restart sshd && fail2ban-client unban --all
```

---
**紧急联系**: 如果需要协助，请联系VPS技术支持。