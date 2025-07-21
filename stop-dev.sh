#!/bin/bash

# 停止开发环境脚本

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}停止开发服务器...${NC}"

# 停止前端
if [ -f "tmp/frontend.pid" ]; then
    PID=$(cat tmp/frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✅ 前端服务已停止${NC}"
    else
        echo -e "${YELLOW}前端服务未运行${NC}"
    fi
    rm -f tmp/frontend.pid
else
    echo -e "${YELLOW}未找到前端服务PID文件${NC}"
fi

# 停止后端
if [ -f "tmp/backend.pid" ]; then
    PID=$(cat tmp/backend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✅ 后端服务已停止${NC}"
    else
        echo -e "${YELLOW}后端服务未运行${NC}"
    fi
    rm -f tmp/backend.pid
else
    echo -e "${YELLOW}未找到后端服务PID文件${NC}"
fi

# 清理日志文件
if [ -d "tmp" ]; then
    rm -f tmp/*.log
    echo -e "${GREEN}✅ 清理完成${NC}"
fi

echo -e "${GREEN}所有服务已停止${NC}"