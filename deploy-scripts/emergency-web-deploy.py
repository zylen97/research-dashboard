#!/usr/bin/env python3
"""
紧急Web部署脚本
当SSH无法访问时，通过Web API触发部署
"""

import requests
import json
import sys
import time

def trigger_web_deploy():
    """通过Web API触发部署"""
    base_url = "http://45.149.156.216:3001"
    
    print("🚨 SSH连接失败，尝试通过Web API部署...")
    
    # 1. 检查服务是否在线
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Web服务正常运行")
        else:
            print(f"⚠️ Web服务响应异常: {response.status_code}")
    except Exception as e:
        print(f"❌ 无法连接到Web服务: {str(e)}")
        return False
    
    # 2. 尝试通过emergency endpoint部署（如果存在）
    emergency_endpoint = f"{base_url}/emergency-deploy-endpoint-2024"
    try:
        print("🔄 尝试触发紧急部署...")
        response = requests.post(emergency_endpoint, timeout=60)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 部署结果: {result}")
            return True
        else:
            print(f"❌ 部署失败: {response.status_code}")
            print(f"响应: {response.text}")
    except requests.exceptions.ConnectionError:
        print("❌ 紧急部署端点不存在")
    except Exception as e:
        print(f"❌ 部署错误: {str(e)}")
    
    return False

def check_deployment_status():
    """检查部署后的状态"""
    base_url = "http://45.149.156.216:3001"
    
    print("\n🔍 检查部署状态...")
    endpoints = [
        "/health",
        "/api/health",
        "/auth/health"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            status = "✅" if response.status_code == 200 else "❌"
            print(f"{status} {endpoint}: {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: 连接失败")

def manual_deploy_instructions():
    """手动部署说明"""
    print("\n📋 手动部署步骤：")
    print("1. 登录VPS提供商控制面板")
    print("2. 使用VNC/Console访问服务器")
    print("3. 执行以下命令：")
    print("   cd /var/www/research-dashboard")
    print("   git pull")
    print("   systemctl restart research-backend")
    print("   systemctl restart nginx")
    print("\n4. 修复SSH：")
    print("   systemctl restart sshd")
    print("   systemctl status sshd")

if __name__ == "__main__":
    print("🚨 SSH紧急部署工具 🚨")
    print("=" * 50)
    
    # 尝试Web部署
    success = trigger_web_deploy()
    
    if success:
        time.sleep(5)  # 等待部署完成
        check_deployment_status()
    else:
        print("\n⚠️ 自动部署失败，请按照以下步骤手动部署：")
        manual_deploy_instructions()
        
    print("\n💡 提示：SSH问题解决方案请查看 emergency-ssh-fix.md")