#!/bin/bash

# 🔧 测试API认证和交流记录返回
echo "🔧 测试API认证和交流记录返回"
echo "时间: $(date)"

cd /var/www/research-dashboard/backend || exit 1

echo "1. 获取认证token："
python3 -c "
import requests, json

try:
    # 登录获取token
    login_data = {
        'username': 'zl',
        'password': '123'
    }
    
    response = requests.post('http://localhost:8080/api/auth/login', json=login_data)
    
    if response.status_code == 200:
        token_data = response.json()
        access_token = token_data['access_token']
        print(f'✅ 获取到认证token: {access_token[:50]}...')
        
        # 使用token调用研究项目API
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        api_response = requests.get('http://localhost:8080/api/research/', headers=headers)
        
        if api_response.status_code == 200:
            projects = api_response.json()
            print(f'✅ API返回 {len(projects)} 个项目')
            
            # 检查前3个项目的交流记录
            for i in range(min(3, len(projects))):
                project = projects[i]
                project_id = project.get('id')
                title = project.get('title', 'Unknown')[:40]
                comm_logs = project.get('communication_logs', [])
                
                print(f'\\n📋 项目 {project_id} ({title}):')
                print(f'   - communication_logs字段: {\"communication_logs\" in project}')
                print(f'   - 交流记录数量: {len(comm_logs)}')
                
                if comm_logs:
                    print('   - 交流记录详情:')
                    for j, log in enumerate(comm_logs[:2]):  # 显示前2条
                        log_id = log.get('id', 'N/A')
                        log_type = log.get('communication_type', 'Unknown')
                        log_title = log.get('title', 'No title')[:30]
                        log_content = log.get('content', 'No content')[:40]
                        print(f'     记录{j+1} (ID:{log_id}): {log_type} | {log_title} | {log_content}...')
                else:
                    print('   ⚠️  交流记录为空数组')
                    
        else:
            print(f'❌ API调用失败: {api_response.status_code} - {api_response.text[:100]}')
            
    else:
        print(f'❌ 登录失败: {response.status_code} - {response.text[:100]}')
        
except Exception as e:
    print(f'❌ 测试过程出错: {e}')
"

echo ""
echo "2. 检查前端配置的API地址："
if [ -f "../frontend/.env.production" ]; then
    echo "📄 前端生产环境配置:"
    cat ../frontend/.env.production | grep -E "(API|BASE)"
else
    echo "⚠️  未找到前端生产环境配置"
fi

echo ""
echo "3. 测试不同API端点的响应："
echo "🌐 测试单个项目详情API..."
python3 -c "
import requests, json

try:
    # 先登录
    login_data = {'username': 'zl', 'password': '123'}
    response = requests.post('http://localhost:8080/api/auth/login', json=login_data)
    
    if response.status_code == 200:
        token = response.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        
        # 测试获取第一个项目的详情
        detail_response = requests.get('http://localhost:8080/api/research/1', headers=headers)
        
        if detail_response.status_code == 200:
            project = detail_response.json()
            comm_logs = project.get('communication_logs', [])
            print(f'✅ 项目1详情API: {len(comm_logs)} 条交流记录')
            
            if comm_logs:
                first_log = comm_logs[0]
                print(f'首条记录结构: {list(first_log.keys())}')
        else:
            print(f'❌ 项目详情API失败: {detail_response.status_code}')
    else:
        print(f'❌ 认证失败')
        
except Exception as e:
    print(f'❌ 测试出错: {e}')
"

echo ""
echo "🏁 API测试完成！"
echo "如果交流记录能正确返回，问题可能在前端显示逻辑"