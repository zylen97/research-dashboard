#!/bin/bash

# 🧪 Git冲突防护机制测试脚本
# 用于验证VPS部署脚本是否能正确处理潜在的Git冲突文件

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Git冲突防护机制测试 ===${NC}"
echo "测试时间: $(date)"
echo ""

# 测试项目根目录（如果在VPS上运行，需要调整路径）
PROJECT_ROOT="${PROJECT_ROOT:-/var/www/research-dashboard}"

if [ ! -d "$PROJECT_ROOT" ]; then
    PROJECT_ROOT="$(pwd)"
    echo -e "${YELLOW}⚠️ 使用当前目录作为测试根目录: $PROJECT_ROOT${NC}"
fi

echo -e "${BLUE}📁 测试项目目录: $PROJECT_ROOT${NC}"
echo ""

# 1. 测试.gitignore规则
echo -e "${YELLOW}🔍 测试1: 验证.gitignore规则${NC}"

test_gitignore() {
    local test_files=(
        "vps-check-backup.sh"
        "debug-info.sh" 
        "temp-script.sh"
        "deployment_test.md"
        ".deploy_trigger"
        "status_check.sh"
    )
    
    cd "$PROJECT_ROOT"
    
    for file in "${test_files[@]}"; do
        # 创建测试文件
        echo "# Test file" > "$file"
        
        # 检查是否被.gitignore忽略
        if git check-ignore "$file" >/dev/null 2>&1; then
            echo -e "  ✅ $file - 正确被忽略"
            rm -f "$file"
        else
            echo -e "  ❌ $file - 未被忽略，可能造成冲突！"
            rm -f "$file"
        fi
    done
}

test_gitignore
echo ""

# 2. 测试VPS临时目录创建
echo -e "${YELLOW}🔍 测试2: VPS临时目录管理${NC}"

test_temp_dir() {
    local VPS_TEMP_DIR="/tmp/research-dashboard"
    
    # 清理现有目录
    rm -rf "$VPS_TEMP_DIR" 2>/dev/null || true
    
    # 创建目录结构
    mkdir -p "$VPS_TEMP_DIR"/{scripts,logs,temp}
    chmod 755 "$VPS_TEMP_DIR"
    
    # 验证目录结构
    if [ -d "$VPS_TEMP_DIR/scripts" ] && [ -d "$VPS_TEMP_DIR/logs" ] && [ -d "$VPS_TEMP_DIR/temp" ]; then
        echo -e "  ✅ VPS临时目录结构创建成功"
        
        # 测试文件创建
        echo "#!/bin/bash\necho 'test'" > "$VPS_TEMP_DIR/scripts/test-script.sh"
        chmod +x "$VPS_TEMP_DIR/scripts/test-script.sh"
        
        if [ -x "$VPS_TEMP_DIR/scripts/test-script.sh" ]; then
            echo -e "  ✅ 临时脚本创建和权限设置正确"
        else
            echo -e "  ❌ 临时脚本权限设置失败"
        fi
        
        # 清理测试文件
        rm -f "$VPS_TEMP_DIR/scripts/test-script.sh"
    else
        echo -e "  ❌ VPS临时目录创建失败"
    fi
}

test_temp_dir
echo ""

# 3. 模拟冲突文件清理
echo -e "${YELLOW}🔍 测试3: 冲突文件清理机制${NC}"

test_conflict_cleanup() {
    cd "$PROJECT_ROOT"
    
    # 创建模拟冲突文件
    local conflict_files=(
        "vps-check-backup.sh"
        "debug-temp.sh"
        "deployment_debug.md"
        ".deploy_test"
    )
    
    echo "创建模拟冲突文件..."
    for file in "${conflict_files[@]}"; do
        echo "# Conflict test file - $(date)" > "$file"
        echo -e "  📝 创建: $file"
    done
    
    echo ""
    echo "执行清理逻辑..."
    
    # 模拟部署脚本的清理逻辑
    local CONFLICT_PATTERNS=(
        "*-check*.sh"
        "*-backup*.sh" 
        "*-debug*.sh"
        "*-temp*.sh"
        "vps-*.sh"
        ".deploy_*"
        "deployment_*"
        "*.deploy.tmp"
        "*_check.sh"
        "*_backup.sh"
        "DEPLOYMENT_TEST.md"
    )
    
    local cleaned_count=0
    for pattern in "${CONFLICT_PATTERNS[@]}"; do
        for file in $pattern; do
            if [ -f "$file" ]; then
                rm -f "$file"
                echo -e "  🗑️  清理: $file"
                ((cleaned_count++))
            fi
        done 2>/dev/null || true
    done
    
    echo ""
    if [ $cleaned_count -gt 0 ]; then
        echo -e "  ✅ 成功清理 $cleaned_count 个冲突文件"
    else
        echo -e "  ⚠️  没有找到匹配的冲突文件"
    fi
    
    # 验证清理结果
    remaining_files=$(find . -maxdepth 1 -name "*-check*.sh" -o -name "*-backup*.sh" -o -name "vps-*.sh" 2>/dev/null | wc -l)
    if [ "$remaining_files" -eq 0 ]; then
        echo -e "  ✅ 所有冲突文件已清理完毕"
    else
        echo -e "  ❌ 仍有 $remaining_files 个冲突文件残留"
    fi
}

test_conflict_cleanup
echo ""

# 4. Git工作目录状态检查
echo -e "${YELLOW}🔍 测试4: Git工作目录状态${NC}"

test_git_status() {
    cd "$PROJECT_ROOT"
    
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "  ✅ Git仓库检测正常"
        
        # 检查工作目录状态
        if git diff-index --quiet HEAD --; then
            echo -e "  ✅ 工作目录干净，无未提交更改"
        else
            echo -e "  ⚠️  工作目录有未提交更改"
        fi
        
        # 检查未跟踪文件
        untracked_files=$(git ls-files --other --exclude-standard | wc -l)
        if [ "$untracked_files" -eq 0 ]; then
            echo -e "  ✅ 无未跟踪文件"
        else
            echo -e "  ⚠️  发现 $untracked_files 个未跟踪文件"
            git ls-files --other --exclude-standard | head -5 | sed 's/^/    - /'
        fi
    else
        echo -e "  ❌ 当前目录不是Git仓库"
    fi
}

test_git_status
echo ""

# 5. 生成测试报告
echo -e "${BLUE}📊 测试总结${NC}"
echo "测试完成时间: $(date)"
echo ""
echo -e "${GREEN}✅ 防冲突机制测试完成${NC}"
echo ""
echo "建议："
echo "1. 确保.gitignore规则覆盖所有潜在冲突文件"
echo "2. 在VPS上运行此脚本验证实际环境"
echo "3. 定期检查VPS临时目录的清理情况"
echo ""
echo -e "${YELLOW}💡 在VPS上运行: /tmp/research-dashboard/scripts/test-conflict-prevention.sh${NC}"