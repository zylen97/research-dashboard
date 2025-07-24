#!/bin/bash

# 简单的执行脚本，供手动在VPS上运行

echo "📍 执行登录问题调查..."
echo "请在VPS上运行以下命令："
echo ""
echo "cd /var/www/research-dashboard"
echo "git pull"
echo "chmod +x deploy-scripts/investigate_login_issue.sh"
echo "./deploy-scripts/investigate_login_issue.sh > investigation_report.txt 2>&1"
echo ""
echo "然后查看 investigation_report.txt 文件内容"