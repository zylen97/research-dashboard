# VPS更新指南

## 快速使用

每次推送代码到GitHub后，在VPS上运行：

```bash
cd /var/www/research-dashboard
./vps-update.sh
```

## 强制重新构建

如果网站版本没有更新（比如显示旧版本），使用强制构建：

```bash
cd /var/www/research-dashboard
./vps-update.sh --force-build
```

## 功能说明

这个脚本会自动：

1. **拉取最新代码** - 从GitHub获取最新版本
2. **智能检测更改** - 只在需要时构建
3. **备份当前版本** - 防止更新失败
4. **蓝绿部署** - 零停机时间更新
5. **自动重启服务** - 确保后端更新生效
6. **显示状态信息** - 清晰的更新过程

## 第一次使用

1. 将脚本上传到VPS：
```bash
# 在VPS上
cd /var/www/research-dashboard
git pull
chmod +x vps-update.sh
```

2. 运行脚本：
```bash
./vps-update.sh
```

## 脚本特点

- ✅ **自动备份** - 每次更新前备份当前版本
- ✅ **智能构建** - 只在前端有更改时构建
- ✅ **零停机** - 使用蓝绿部署策略
- ✅ **错误处理** - 构建失败时不会影响当前运行的网站
- ✅ **状态显示** - 清晰显示更新前后的版本

## 常见问题

**Q: 更新失败怎么办？**
A: 脚本会保留备份，可以在 `/var/www/backup/` 找到之前的版本

**Q: 如何查看更新日志？**
A: 脚本会显示Git提交信息和版本变化

**Q: 需要手动安装npm依赖吗？**
A: 不需要，脚本会自动检测package.json变化并安装

## 注意事项

- 确保在 `/var/www/research-dashboard` 目录下运行
- 需要root权限或sudo权限
- 首次运行可能需要输入GitHub凭据（如果是私有仓库）