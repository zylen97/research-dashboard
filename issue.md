1.添加交流记录显示这个错误：api.ts:216 
 POST http://45.149.156.216:3001/api/research/6/logs 422 (Unprocessable Entity)
api.ts:63 API Error: 
s_ {message: 'Request failed with status code 422', name: 'AxiosError', code: 'ERR_BAD_REQUEST', config: {…}, request: XMLHttpRequest, …}
code
: 
"ERR_BAD_REQUEST"
config
: 
{transitional: {…}, adapter: Array(3), transformRequest: Array(1), transformResponse: Array(1), timeout: 30000, …}
message
: 
"Request failed with status code 422"
name
: 
"AxiosError"
request
: 
XMLHttpRequest {onreadystatechange: null, readyState: 4, timeout: 30000, withCredentials: false, upload: XMLHttpRequestUpload, …}
response
: 
{data: {…}, status: 422, statusText: 'Unprocessable Entity', headers: H_, config: {…}, …}
status
: 
422
stack
: 
"AxiosError: Request failed with status code 422\n    at V_ (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1111270)\n    at XMLHttpRequest.g (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1115865)\n    at PH.request (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1124252)\n    at async onFinish (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1241777)"
[[Prototype]]
: 
Error
api.ts:88 请求数据验证失败: 
{detail: Array(2)}
(anonymous)	@	api.ts:88
Promise.then		
createCommunicationLog	@	api.ts:216
onFinish	@	CommunicationLogModal.tsx:94
Promise.then		
onOk	@	CommunicationLogModal.tsx:266
CommunicationLogModal.tsx:105 提交交流日志失败: 
s_ {message: 'Request failed with status code 422', name: 'AxiosError', code: 'ERR_BAD_REQUEST', config: {…}, request: XMLHttpRequest, …}
code
: 
"ERR_BAD_REQUEST"
config
: 
{transitional: {…}, adapter: Array(3), transformRequest: Array(1), transformResponse: Array(1), timeout: 30000, …}
message
: 
"Request failed with status code 422"
name
: 
"AxiosError"
request
: 
XMLHttpRequest {onreadystatechange: null, readyState: 4, timeout: 30000, withCredentials: false, upload: XMLHttpRequestUpload, …}
response
: 
{data: {…}, status: 422, statusText: 'Unprocessable Entity', headers: H_, config: {…}, …}
status
: 
422
stack
: 
"AxiosError: Request failed with status code 422\n    at V_ (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1111270)\n    at XMLHttpRequest.g (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1115865)\n    at PH.request (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1124252)\n    at async onFinish (http://45.149.156.216:3001/static/js/main.4cf73adc.js:2:1241777)"
[[Prototype]]
: 
Error
2.

2.系统设置面板应该改为AI配置管理面板
3.现在AI配置管理面板是添加配置到列表的逻辑，改为只有一个固定的AI配置，输入密钥和地址和默认模型后，直接进行联通测试，其他如提供商，最大token，温度参数等选项全部删除。现在是创建逻辑，可以有很多在列表里，我要变成只有一个固定的，我就调用那个。
4.idea发掘系统中的文献，还是没有增加批量删除
5.idea发掘系统，每个人的面板里面，应该加入一层文件夹选项，在文件夹中导入文献，文件夹可以修改，删除，命名（初始的是一个根文件夹），这样更符合实际的需求