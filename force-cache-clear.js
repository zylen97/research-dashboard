// 强制清除浏览器缓存的内联脚本
// 添加时间戳强制刷新

console.log('🔄 强制清除缓存，版本:', new Date().getTime());

// 检查API配置
import('./config/api.js').then(api => {
    console.log('📡 当前API配置:', api.API_CONFIG.BASE_URL);
    console.log('🌐 当前位置:', window.location.href);
});