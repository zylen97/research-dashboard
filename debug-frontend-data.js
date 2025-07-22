// 🔍 前端数据调试脚本 - 在浏览器控制台运行
console.log("🔍 开始调试前端数据接收...");

// 1. 检查当前页面的项目数据
const checkPageData = () => {
  console.log("📊 检查页面数据:");
  
  // 尝试从React组件状态中获取数据
  const reactFiberKey = Object.keys(window).find(key => key.startsWith('_reactInternalFiber'));
  if (reactFiberKey) {
    console.log("Found React fiber, trying to access component state...");
  }
  
  // 检查全局变量
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log("React DevTools available");
  }
};

// 2. 手动调用API检查数据
const testAPI = async () => {
  console.log("🌐 手动测试API调用:");
  
  try {
    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error("❌ 没有找到认证token");
      return;
    }
    
    console.log("✅ 找到token:", token.substring(0, 50) + "...");
    
    // 调用API
    const response = await fetch('/api/research/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error("❌ API调用失败:", response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log("✅ API响应成功，项目数量:", data.length);
    
    // 检查前3个项目的communication_logs
    data.slice(0, 3).forEach((project, index) => {
      console.log(`\n📋 项目 ${index + 1} (ID: ${project.id}): ${project.title}`);
      console.log("  - communication_logs存在:", 'communication_logs' in project);
      console.log("  - communication_logs类型:", typeof project.communication_logs);
      console.log("  - communication_logs值:", project.communication_logs);
      
      if (project.communication_logs && Array.isArray(project.communication_logs)) {
        console.log("  - 数组长度:", project.communication_logs.length);
        if (project.communication_logs.length > 0) {
          const firstLog = project.communication_logs[0];
          console.log("  - 首条记录结构:", Object.keys(firstLog));
          console.log("  - 首条记录内容:", firstLog);
        }
      } else {
        console.log("  ❌ communication_logs不是数组或为空");
      }
      
      // 检查latest_communication字段
      console.log("  - latest_communication:", project.latest_communication);
    });
    
  } catch (error) {
    console.error("❌ API测试出错:", error);
  }
};

// 3. 检查前端组件逻辑
const checkFrontendLogic = () => {
  console.log("🔧 检查前端组件逻辑:");
  
  // 模拟组件渲染逻辑
  const mockRecord = {
    id: 1,
    title: "测试项目",
    communication_logs: [
      {
        id: 1,
        communication_type: "meeting",
        title: "测试会议",
        content: "测试内容"
      }
    ]
  };
  
  console.log("🧪 模拟数据:", mockRecord);
  
  // 模拟渲染逻辑
  const logs = mockRecord.communication_logs || [];
  console.log("📊 logs变量:", logs);
  console.log("📊 logs.length:", logs.length);
  
  if (logs.length > 0) {
    const latestLog = logs[logs.length - 1];
    const displayText = `${latestLog.communication_type}: ${latestLog.title}`;
    console.log("✅ 应该显示:", displayText);
  } else {
    console.log("❌ 会显示: 暂无交流记录");
  }
};

// 4. 执行所有检查
const runAllChecks = async () => {
  console.log("🚀 开始完整调试...\n");
  
  checkPageData();
  console.log("\n" + "=".repeat(50));
  
  await testAPI();
  console.log("\n" + "=".repeat(50));
  
  checkFrontendLogic();
  console.log("\n🏁 调试完成!");
};

// 立即执行
runAllChecks();