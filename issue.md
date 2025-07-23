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