# VPS临时文件管理规范

## 🎯 目的
防止VPS上的临时文件与Git代码库冲突，建立标准的文件管理规范。

## 📁 目录结构

### VPS专用临时目录
```
/tmp/research-dashboard/
├── scripts/          # 临时脚本文件
│   ├── status-check.sh
│   ├── debug-info.sh
│   └── backup-restore.sh
├── logs/             # 临时日志文件  
│   ├── deploy-debug.log
│   └── status-check.log
└── temp/             # 其他临时文件
    ├── config-backup.txt
    └── test-data.json
```

## 🔧 使用规范

### 1. 创建临时脚本
```bash
# ✅ 正确方式 - 使用专用目录
VPS_TEMP_DIR="/tmp/research-dashboard"
mkdir -p "$VPS_TEMP_DIR/scripts"
cat > "$VPS_TEMP_DIR/scripts/status-check.sh" << 'EOF'
#!/bin/bash
# 状态检查脚本
EOF

# ❌ 错误方式 - 在项目目录创建
# cat > "/var/www/research-dashboard/vps-check-backup.sh"
```

### 2. 临时文件命名规范
- 使用描述性名称：`status-check.sh` ✅
- 避免通用名称：`check.sh` ❌  
- 包含时间戳：`backup-20250723.sh` ✅
- 使用统一前缀：`vps-debug-info.sh` ✅

### 3. 自动清理机制
临时目录会在以下情况自动清理：
- 系统重启时（/tmp目录特性）
- 部署脚本运行时
- 定期清理任务

## 🛠 实用工具脚本

### VPS临时目录初始化
```bash
# 在VPS上运行此命令初始化临时目录
init_vps_temp_dir() {
    VPS_TEMP_DIR="/tmp/research-dashboard"
    mkdir -p "$VPS_TEMP_DIR"/{scripts,logs,temp}
    chmod 755 "$VPS_TEMP_DIR"
    echo "VPS临时目录已初始化: $VPS_TEMP_DIR"
}
```

### 快速创建调试脚本
```bash
# 使用此函数创建调试脚本
create_debug_script() {
    local script_name="$1"
    local vps_temp_dir="/tmp/research-dashboard/scripts"
    mkdir -p "$vps_temp_dir"
    
    cat > "$vps_temp_dir/$script_name" << 'EOF'
#!/bin/bash
# 自动生成的调试脚本
echo "=== 调试信息 ==="
date
pwd
git log -1 --oneline
EOF
    
    chmod +x "$vps_temp_dir/$script_name"
    echo "调试脚本已创建: $vps_temp_dir/$script_name"
}
```

## ⚠️ 注意事项

1. **绝对不要**在项目目录 `/var/www/research-dashboard/` 下创建临时文件
2. **始终使用** `/tmp/research-dashboard/` 目录存放临时文件
3. **及时清理**不再需要的临时文件
4. **使用描述性命名**便于识别文件用途

## 🔍 故障排除

如果仍然遇到Git冲突：
1. 检查是否有文件在项目目录下
2. 运行 `git status` 查看未跟踪文件
3. 使用 `git clean -fd` 强制清理
4. 参考部署脚本的预清理机制

---
此规范确保VPS运维操作不会干扰代码版本控制，提高部署成功率。