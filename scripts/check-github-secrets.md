# 检查 GitHub Secrets 配置

## 1. 检查 VPS_SSH_KEY 格式

GitHub Secrets 中的 `VPS_SSH_KEY` 必须是完整的私钥，格式如下：

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...多行base64编码的内容...
...
-----END RSA PRIVATE KEY-----
```

或者是新格式：

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn...
...多行内容...
-----END OPENSSH PRIVATE KEY-----
```

## 2. 常见问题

### 问题1: 密钥格式错误
- **症状**: `invalid format` 或 `Load key "/home/runner/.ssh/id_rsa": invalid format`
- **原因**: 
  - 复制时丢失了换行符
  - 多了额外的空格
  - 使用了公钥而不是私钥
- **解决**: 重新复制完整的私钥内容

### 问题2: 权限问题
- **症状**: `Permissions 0644 for '/home/runner/.ssh/id_rsa' are too open`
- **原因**: Actions中需要设置正确的文件权限
- **解决**: 已在workflow中添加 `chmod 600`

### 问题3: 密钥不匹配
- **症状**: `Permission denied (publickey)`
- **原因**: GitHub的私钥与服务器的公钥不匹配
- **解决**: 确认服务器 `/root/.ssh/authorized_keys` 包含对应的公钥

## 3. 验证步骤

1. **在本地生成测试密钥对**：
```bash
ssh-keygen -t rsa -b 4096 -f test_deploy_key -N ""
```

2. **查看公钥**（添加到服务器）：
```bash
cat test_deploy_key.pub
```

3. **查看私钥**（添加到GitHub Secrets）：
```bash
cat test_deploy_key
```

4. **测试连接**：
```bash
ssh -i test_deploy_key -o StrictHostKeyChecking=no root@45.149.156.216
```

## 4. 更新 GitHub Secrets

1. 访问: https://github.com/zylen97/research-dashboard/settings/secrets/actions
2. 点击 `VPS_SSH_KEY` 旁边的更新按钮
3. 粘贴完整的私钥内容（包括BEGIN和END行）
4. 保存

## 5. 服务器端检查

在服务器上执行：

```bash
# 查看authorized_keys
cat /root/.ssh/authorized_keys

# 查看SSH日志
grep "github" /var/log/auth.log | tail -20

# 检查fail2ban
fail2ban-client status sshd
```