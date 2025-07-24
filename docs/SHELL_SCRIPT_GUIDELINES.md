# Shell脚本编写规范

## 🎯 目标
建立统一的Shell脚本编写标准，提高代码质量，减少错误，提升维护性。

## 📋 基本规范

### 1. 文件头部
每个Shell脚本必须包含以下头部：

```bash
#!/bin/bash

# 脚本名称和用途的简短描述
# 作者：[作者名]
# 创建时间：[日期]
# 最后修改：[日期]

set -e  # 遇到错误立即退出
```

### 2. 变量命名

#### 规则
- 使用描述性的变量名
- 全局变量使用大写字母和下划线
- 局部变量使用小写字母和下划线
- 只读变量使用 `readonly` 声明

#### 示例
```bash
# 全局变量
PROJECT_ROOT="/var/www/project"
readonly CONFIG_FILE="/etc/project.conf"

# 局部变量（在函数内）
function process_data() {
    local input_file="$1"
    local output_dir="$2"
    local temp_file="/tmp/processing.tmp"
}
```

### 3. 函数定义

#### 规则
- 函数名使用小写字母和下划线
- 函数内的变量必须使用 `local` 声明
- 函数前添加简短注释说明用途

#### 示例
```bash
# 处理日志文件
process_log_file() {
    local log_file="$1"
    local output_file="$2"
    
    if [ ! -f "$log_file" ]; then
        echo "错误：日志文件不存在: $log_file" >&2
        return 1
    fi
    
    # 处理逻辑...
}
```

### 4. 错误处理

#### 基本原则
- 使用 `set -e` 在脚本开头
- 重要操作后检查返回值
- 提供有意义的错误信息
- 使用错误退出函数

#### 示例
```bash
# 错误处理函数
error_exit() {
    local message="$1"
    local exit_code="${2:-1}"
    echo "错误: $message" >&2
    exit "$exit_code"
}

# 使用示例
cp "$source_file" "$dest_file" || error_exit "文件复制失败"
```

### 5. 参数处理

#### 基本检查
```bash
# 检查参数数量
if [ $# -lt 2 ]; then
    echo "用法: $0 <输入文件> <输出目录>" >&2
    exit 1
fi

# 赋值给描述性变量
input_file="$1"
output_dir="$2"

# 验证参数
[ -f "$input_file" ] || error_exit "输入文件不存在: $input_file"
[ -d "$output_dir" ] || error_exit "输出目录不存在: $output_dir"
```

### 6. 文件路径处理

#### 规则
- 始终使用绝对路径或相对于已知基准的路径
- 使用 `"$var"` 引用变量避免空格问题
- 检查文件/目录存在性

#### 示例
```bash
# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 安全的文件操作
if [ -f "$config_file" ]; then
    source "$config_file"
fi
```

## 🚫 常见错误和避免方法

### 1. `local` 关键字使用错误

❌ **错误**：在函数外使用 `local`
```bash
# 脚本主体中
local var="value"  # 错误！
```

✅ **正确**：只在函数内使用 `local`
```bash
my_function() {
    local var="value"  # 正确
}

# 脚本主体中
var="value"  # 正确
```

### 2. 变量引用错误

❌ **错误**：不使用引号
```bash
cp $source_file $dest_file  # 如果路径有空格会出错
```

✅ **正确**：使用双引号
```bash
cp "$source_file" "$dest_file"
```

### 3. 路径拼接错误

❌ **错误**：简单字符串拼接
```bash
full_path=$dir/$file  # 可能产生双斜杠
```

✅ **正确**：使用路径拼接函数或检查
```bash
full_path="$dir/$file"
# 或者
full_path=$(realpath "$dir/$file")
```

### 4. 缺少错误检查

❌ **错误**：不检查命令执行结果
```bash
mkdir /some/path
cd /some/path
```

✅ **正确**：检查每个关键操作
```bash
mkdir /some/path || error_exit "创建目录失败"
cd /some/path || error_exit "进入目录失败"
```

## 🔧 推荐工具

### 1. ShellCheck
静态分析工具，用于发现Shell脚本中的问题：

```bash
# 安装
sudo apt-get install shellcheck

# 使用
shellcheck script.sh
```

### 2. 语法检查
在执行前检查语法：

```bash
bash -n script.sh
```

### 3. 调试模式
开发时使用调试模式：

```bash
bash -x script.sh  # 显示执行的每一行
```

## 📝 脚本模板

创建新脚本时使用此模板：

```bash
#!/bin/bash

# [脚本用途描述]
# 作者：[作者名]
# 创建时间：$(date +%Y-%m-%d)

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 错误处理函数
error_exit() {
    local message="$1"
    local exit_code="${2:-1}"
    echo -e "${RED}错误: $message${NC}" >&2
    exit "$exit_code"
}

# 主函数
main() {
    # 参数检查
    if [ $# -lt 1 ]; then
        echo "用法: $0 <参数>" >&2
        exit 1
    fi
    
    # 主要逻辑
    echo -e "${GREEN}脚本执行成功${NC}"
}

# 执行主函数
main "$@"
```

## 🔍 质量检查

使用项目提供的检查工具：

```bash
# 执行全面检查
./scripts/check-shell-scripts.sh

# 查看检查报告
cat shell-check-report.txt
```

## 📚 参考资源

- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
- [ShellCheck Wiki](https://github.com/koalaman/shellcheck/wiki)
- [Advanced Bash-Scripting Guide](https://tldp.org/LDP/abs/html/)

遵循这些规范将显著提高Shell脚本的质量和可维护性！